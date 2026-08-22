import {
  normalizeVaultPath,
  readFrontmatterMapping,
  splitFrontmatter,
} from '../domain/markdown-parser';
import type {
  Diagnostic,
  IndexFreshness,
  ProjectEntity,
} from '../domain/model';
import {
  renderTaskTemplate,
  type TaskTemplateContext,
} from '../domain/templates/task-template';
import type { IndexSnapshot } from '../indexing/index-snapshot';
import type { VaultReader } from '../ports/vault-reader';
import type {
  TemplateResolver,
  TemplateSelection,
  TemplateVariantOption,
} from './template-resolver';

/** The `template_for` kind this service resolves and creates. */
const TASK_TEMPLATE_KIND = 'task';

export type TaskCreationFields = Omit<
  TaskTemplateContext,
  'status' | 'projectTitle' | 'projectPath'
>;

export interface TaskCreationProposalInput {
  readonly operationId: string;
  readonly projectPath: string;
  readonly targetPath: string;
  readonly templateVariant?: string;
  readonly createOnBoard?: boolean;
  readonly task: TaskCreationFields;
  readonly templateInputs?: Readonly<Record<string, unknown>>;
}

export interface ProposalEntityRef {
  readonly kind: 'project';
  readonly path: string;
  readonly fingerprint: string;
}

export interface TaskCreationProposal {
  readonly ok: true;
  readonly operation_id: string;
  readonly action: 'Create task';
  readonly index_revision: number;
  readonly index_freshness: IndexFreshness;
  readonly project_ref: ProposalEntityRef;
  readonly diff_summary: string;
  readonly frontmatter_changes: readonly {
    readonly path: string;
    readonly before: null;
    readonly after: Readonly<Record<string, unknown>>;
  }[];
  readonly template: {
    readonly kind: 'task';
    readonly source: TemplateSelection['source'];
    readonly variant: string;
    readonly reference: string;
    readonly path: string;
    readonly fingerprint: string;
  };
  readonly read_set: readonly {
    readonly role: 'project' | 'template';
    readonly path: string;
    readonly fingerprint: string;
  }[];
  readonly preconditions: readonly {
    readonly kind: 'path_absent';
    readonly path: string;
  }[];
  readonly created_files: readonly {
    readonly path: string;
    readonly content: string;
  }[];
  readonly expected_postconditions: readonly {
    readonly kind: 'entity_indexed';
    readonly entity: 'task';
    readonly path: string;
    readonly project_path: string;
  }[];
  readonly diagnostics: readonly Diagnostic[];
}

export interface TaskCreationProposalFailure {
  readonly ok: false;
  readonly operation_id: string;
  readonly action: 'Create task';
  readonly index_revision: number;
  readonly index_freshness: IndexFreshness;
  readonly project_ref: ProposalEntityRef | null;
  readonly diagnostics: readonly Diagnostic[];
}

export type TaskCreationProposalResult =
  TaskCreationProposal | TaskCreationProposalFailure;

/**
 * Builds an exact one-file task proposal. This service can read the current
 * target for collision detection but has no write capability; a later typed
 * coordinator must recheck its read set and commit only after confirmation.
 */
export class TaskCreationProposalService {
  readonly #getSnapshot: () => IndexSnapshot;
  readonly #vault: VaultReader;
  readonly #templates: TemplateResolver;

  public constructor(
    getSnapshot: () => IndexSnapshot,
    vault: VaultReader,
    templates: TemplateResolver,
  ) {
    this.#getSnapshot = getSnapshot;
    this.#vault = vault;
    this.#templates = templates;
  }

  /** Variants the shared catalog can select, `default` first. */
  public async listTemplateVariants(): Promise<
    readonly TemplateVariantOption[]
  > {
    return await this.#templates.listVariants(TASK_TEMPLATE_KIND);
  }

  public async propose(
    input: TaskCreationProposalInput,
  ): Promise<TaskCreationProposalResult> {
    const snapshot = this.#getSnapshot();
    const operationId = input.operationId.trim();
    if (operationId.length === 0) {
      return failure(snapshot, '', null, [
        diagnostic(
          '',
          'proposal.operation_id.invalid',
          'Operation ID must be a non-empty string.',
          'operation_id',
        ),
      ]);
    }

    const projectPath = normalizeVaultPath(input.projectPath);
    const entity = snapshot.getEntity(projectPath);
    const project = entity?.kind === 'project' ? entity : null;
    if (project === null) {
      return failure(snapshot, operationId, null, [
        diagnostic(
          projectPath,
          'proposal.project.not_found',
          'The selected project is not indexed as a project note.',
          'project',
          'Select a valid project and rebuild the index if needed.',
        ),
      ]);
    }
    const projectRef = ref(project);

    if (snapshot.freshness !== 'current') {
      return failure(snapshot, operationId, projectRef, [
        diagnostic(
          project.path,
          'proposal.index.not_current',
          'Task creation is disabled while the project index is not current.',
          undefined,
          'Wait for indexing to finish, then build a new proposal.',
        ),
      ]);
    }

    const projectErrors = project.diagnostics.filter(
      (issue) => issue.severity === 'error',
    );
    if (projectErrors.length > 0) {
      return failure(snapshot, operationId, projectRef, projectErrors);
    }

    const projectLink = wikiLink(project.path);
    if (projectLink === null) {
      return failure(snapshot, operationId, projectRef, [
        diagnostic(
          project.path,
          'proposal.project.link_unsafe',
          'The selected project path cannot be represented as one wiki link.',
          'project',
          'Rename the project note to remove closing bracket pairs.',
        ),
      ]);
    }

    const resolution = await this.#templates.resolve(
      TASK_TEMPLATE_KIND,
      project.path,
      input.templateVariant,
    );
    if (!resolution.ok || resolution.selected === null) {
      return failure(snapshot, operationId, projectRef, resolution.diagnostics);
    }

    const selected = resolution.selected;
    const rendered = renderTaskTemplate({
      template: selected.template,
      context: {
        ...input.task,
        status: input.createOnBoard === true ? 'todo' : 'backlog',
        projectTitle: project.title,
        projectPath: project.path,
      },
      invariants: {
        projectLink,
        targetPath: input.targetPath,
      },
      inputs: input.templateInputs,
    });
    const diagnostics = [...resolution.diagnostics, ...rendered.diagnostics];
    if (!rendered.ok || rendered.note === null) {
      return failure(snapshot, operationId, projectRef, diagnostics);
    }

    const split = splitFrontmatter(rendered.note.content);
    const frontmatter =
      split === null ? null : readFrontmatterMapping(split.yaml);
    if (frontmatter === null || !frontmatter.ok) {
      diagnostics.push(
        diagnostic(
          rendered.note.targetPath,
          'proposal.output.frontmatter_invalid',
          'The rendered task does not contain readable frontmatter.',
          undefined,
          'Correct the selected template and build a new proposal.',
        ),
      );
      return failure(snapshot, operationId, projectRef, diagnostics);
    }
    const existing = await this.#vault.readMarkdownNote(
      rendered.note.targetPath,
    );
    if (existing !== null) {
      diagnostics.push(
        diagnostic(
          rendered.note.targetPath,
          'proposal.target.exists',
          'The proposed task path already exists.',
          'target_path',
          'Choose a different target path; Project Weave never overwrites on create.',
        ),
      );
      return failure(snapshot, operationId, projectRef, diagnostics);
    }

    return {
      ok: true,
      operation_id: operationId,
      action: 'Create task',
      index_revision: snapshot.revision,
      index_freshness: snapshot.freshness,
      project_ref: projectRef,
      diff_summary: `Create task "${input.task.title}" at ${rendered.note.targetPath} using ${selected.reference}.`,
      frontmatter_changes: [
        {
          path: rendered.note.targetPath,
          before: null,
          after: frontmatter.value,
        },
      ],
      template: {
        kind: 'task',
        source: selected.source,
        variant: selected.variant,
        reference: selected.reference,
        path: selected.template.path,
        fingerprint: selected.fingerprint,
      },
      read_set: [
        {
          role: 'project',
          path: project.path,
          fingerprint: project.fingerprint,
        },
        {
          role: 'template',
          path: selected.template.path,
          fingerprint: selected.fingerprint,
        },
      ],
      preconditions: [{ kind: 'path_absent', path: rendered.note.targetPath }],
      created_files: [
        { path: rendered.note.targetPath, content: rendered.note.content },
      ],
      expected_postconditions: [
        {
          kind: 'entity_indexed',
          entity: 'task',
          path: rendered.note.targetPath,
          project_path: project.path,
        },
      ],
      diagnostics,
    };
  }
}

function failure(
  snapshot: IndexSnapshot,
  operationId: string,
  projectRef: ProposalEntityRef | null,
  diagnostics: readonly Diagnostic[],
): TaskCreationProposalFailure {
  return {
    ok: false,
    operation_id: operationId,
    action: 'Create task',
    index_revision: snapshot.revision,
    index_freshness: snapshot.freshness,
    project_ref: projectRef,
    diagnostics,
  };
}

function ref(project: ProjectEntity): ProposalEntityRef {
  return {
    kind: 'project',
    path: project.path,
    fingerprint: project.fingerprint,
  };
}

function wikiLink(path: string): string | null {
  const linkpath = path.toLowerCase().endsWith('.md')
    ? path.slice(0, -3)
    : path;
  return linkpath.includes(']]') ? null : `[[${linkpath}]]`;
}

function diagnostic(
  path: string,
  code: string,
  message: string,
  field?: string,
  recovery?: string,
): Diagnostic {
  return {
    path,
    code,
    severity: 'error',
    message,
    ...(field === undefined ? {} : { field }),
    ...(recovery === undefined ? {} : { recovery }),
  };
}
