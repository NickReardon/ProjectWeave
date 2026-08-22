import {
  readFrontmatterMapping,
  splitFrontmatter,
} from '../domain/markdown-parser';
import type {
  Diagnostic,
  IndexFreshness,
  ProjectStatus,
} from '../domain/model';
import { renderProjectTemplate } from '../domain/templates/project-template';
import type { TemplateClock } from '../domain/templates/model';
import type { IndexSnapshot } from '../indexing/index-snapshot';
import type { VaultReader } from '../ports/vault-reader';
import { TemplateResolver } from './template-resolver';

/** The `template_for` kind this service resolves and creates. */
const PROJECT_TEMPLATE_KIND = 'project';

export interface ProjectCreationProposalInput {
  readonly operationId: string;
  readonly targetPath: string;
  readonly title: string;
  readonly status?: ProjectStatus | null;
  readonly clock: TemplateClock;
  readonly templateInputs?: Readonly<Record<string, unknown>>;
}

export interface ProjectCreationProposal {
  readonly ok: true;
  readonly operation_id: string;
  readonly action: 'Create project';
  readonly index_revision: number;
  readonly index_freshness: IndexFreshness;
  readonly diff_summary: string;
  readonly frontmatter_changes: readonly {
    readonly path: string;
    readonly before: null;
    readonly after: Readonly<Record<string, unknown>>;
  }[];
  readonly template: {
    readonly kind: 'project';
    readonly source: 'packaged' | 'vault';
    readonly variant: string;
    readonly reference: string;
    readonly path: string;
    readonly fingerprint: string;
  };
  readonly read_set: readonly {
    readonly role: 'template';
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
    readonly entity: 'project';
    readonly path: string;
  }[];
  readonly diagnostics: readonly Diagnostic[];
}

export interface ProjectCreationProposalFailure {
  readonly ok: false;
  readonly operation_id: string;
  readonly action: 'Create project';
  readonly index_revision: number;
  readonly index_freshness: IndexFreshness;
  readonly diagnostics: readonly Diagnostic[];
}

export type ProjectCreationProposalResult =
  ProjectCreationProposal | ProjectCreationProposalFailure;

/**
 * Builds an exact one-file project proposal, on the same terms as the task
 * one: it can read the target for collision detection, has no write
 * capability, and produces the exact bytes a commit would write.
 *
 * Template selection is delegated to the shared `TemplateResolver`, so a
 * project resolves `project/default` across the same ADR 0013 rung ladder a
 * task variant does: the vault template library, then the packaged default.
 * A project has no project to belong to, so there is no entity to fingerprint
 * and no project-owned mapping to consult — that rung is deferred for every
 * kind, not only this one.
 */
export class ProjectCreationProposalService {
  readonly #getSnapshot: () => IndexSnapshot;
  readonly #vault: VaultReader;
  readonly #templates: TemplateResolver;

  public constructor(
    getSnapshot: () => IndexSnapshot,
    vault: VaultReader,
    templates: TemplateResolver = new TemplateResolver(),
  ) {
    this.#getSnapshot = getSnapshot;
    this.#vault = vault;
    this.#templates = templates;
  }

  public async propose(
    input: ProjectCreationProposalInput,
  ): Promise<ProjectCreationProposalResult> {
    const snapshot = this.#getSnapshot();
    const operationId = input.operationId.trim();
    if (operationId.length === 0) {
      return failure(snapshot, '', [
        diagnostic(
          '',
          'proposal.operation_id.invalid',
          'Operation ID must be a non-empty string.',
          'operation_id',
        ),
      ]);
    }

    if (snapshot.freshness !== 'current') {
      return failure(snapshot, operationId, [
        diagnostic(
          input.targetPath,
          'proposal.index.not_current',
          'Project creation is disabled while the project index is not current.',
          undefined,
          'Wait for indexing to finish, then build a new proposal.',
        ),
      ]);
    }

    const resolution = await this.#templates.resolve(
      PROJECT_TEMPLATE_KIND,
      input.targetPath,
    );
    if (!resolution.ok || resolution.selected === null) {
      return failure(snapshot, operationId, resolution.diagnostics);
    }
    const selected = resolution.selected;

    const rendered = renderProjectTemplate({
      template: selected.template,
      context: {
        title: input.title,
        clock: input.clock,
        ...(input.status === undefined ? {} : { status: input.status }),
      },
      invariants: { targetPath: input.targetPath },
      ...(input.templateInputs === undefined
        ? {}
        : { inputs: input.templateInputs }),
    });
    const diagnostics = [...resolution.diagnostics, ...rendered.diagnostics];
    if (!rendered.ok || rendered.note === null) {
      return failure(snapshot, operationId, diagnostics);
    }

    const split = splitFrontmatter(rendered.note.content);
    const frontmatter =
      split === null ? null : readFrontmatterMapping(split.yaml);
    if (frontmatter === null || !frontmatter.ok) {
      diagnostics.push(
        diagnostic(
          rendered.note.targetPath,
          'proposal.output.frontmatter_invalid',
          'The rendered project does not contain readable frontmatter.',
          undefined,
          'Correct the selected template and build a new proposal.',
        ),
      );
      return failure(snapshot, operationId, diagnostics);
    }

    const existing = await this.#vault.readMarkdownNote(
      rendered.note.targetPath,
    );
    if (existing !== null) {
      diagnostics.push(
        diagnostic(
          rendered.note.targetPath,
          'proposal.target.exists',
          'The proposed project path already exists.',
          'target_path',
          'Choose a different target path; Project Weave never overwrites on create.',
        ),
      );
      return failure(snapshot, operationId, diagnostics);
    }

    return {
      ok: true,
      operation_id: operationId,
      action: 'Create project',
      index_revision: snapshot.revision,
      index_freshness: snapshot.freshness,
      diff_summary: `Create project "${input.title}" at ${rendered.note.targetPath} using ${selected.reference}.`,
      frontmatter_changes: [
        {
          path: rendered.note.targetPath,
          before: null,
          after: frontmatter.value,
        },
      ],
      template: {
        kind: 'project',
        source: selected.source,
        variant: selected.variant,
        reference: selected.reference,
        path: selected.template.path,
        fingerprint: selected.fingerprint,
      },
      read_set: [
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
          entity: 'project',
          path: rendered.note.targetPath,
        },
      ],
      diagnostics,
    };
  }
}

function failure(
  snapshot: IndexSnapshot,
  operationId: string,
  diagnostics: readonly Diagnostic[],
): ProjectCreationProposalFailure {
  return {
    ok: false,
    operation_id: operationId,
    action: 'Create project',
    index_revision: snapshot.revision,
    index_freshness: snapshot.freshness,
    diagnostics,
  };
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
