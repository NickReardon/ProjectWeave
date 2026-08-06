import {
  readFrontmatterMapping,
  splitFrontmatter,
} from '../domain/markdown-parser';
import type {
  Diagnostic,
  IndexFreshness,
  ProjectStatus,
} from '../domain/model';
import {
  PACKAGED_MINIMAL_PROJECT_TEMPLATE,
  PACKAGED_MINIMAL_TEMPLATE_ID,
} from '../domain/templates/packaged-templates';
import { renderProjectTemplate } from '../domain/templates/project-template';
import { hasError } from '../domain/templates/model';
import { parseTemplateDocument } from '../domain/templates/template-parser';
import type { VaultTemplateLibrary } from './vault-template-library';
import type { TemplateClock, TemplateSource } from '../domain/templates/model';
import type { IndexSnapshot } from '../indexing/index-snapshot';
import type { VaultReader } from '../ports/vault-reader';

/**
 * Fingerprint of the packaged project template. It ships inside the plugin
 * build, so it cannot drift while the plugin is loaded; the commit service
 * skips re-reading packaged templates for that reason.
 */
const PACKAGED_PROJECT_FINGERPRINT = 'builtin:minimal/project@schema-1';

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
 * A project has no project to belong to, so there is no entity to fingerprint
 * and no template map to consult. The template is the packaged one: a
 * project-owned template mapping lives in the project note, and the project
 * note is what this creates.
 */
export class ProjectCreationProposalService {
  readonly #getSnapshot: () => IndexSnapshot;
  readonly #vault: VaultReader;
  readonly #library: VaultTemplateLibrary | null;

  public constructor(
    getSnapshot: () => IndexSnapshot,
    vault: VaultReader,
    library: VaultTemplateLibrary | null = null,
  ) {
    this.#getSnapshot = getSnapshot;
    this.#vault = vault;
    this.#library = library;
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

    const selected = await this.#selectTemplate();
    if (!selected.ok) {
      return failure(snapshot, operationId, selected.diagnostics);
    }

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
    const diagnostics = [...rendered.diagnostics];
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

    const reference =
      selected.source === 'packaged'
        ? PACKAGED_MINIMAL_TEMPLATE_ID
        : selected.template.path;
    return {
      ok: true,
      operation_id: operationId,
      action: 'Create project',
      index_revision: snapshot.revision,
      index_freshness: snapshot.freshness,
      diff_summary: `Create project "${input.title}" at ${rendered.note.targetPath} using ${reference}.`,
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
        variant: 'default',
        reference,
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

  /**
   * The vault library's `project/default.md`, or the packaged template.
   *
   * A vault template that cannot be used refuses the creation rather than
   * falling back, on the same grounds as a task variant: the user configured
   * that template, and quietly writing different bytes is worse than not
   * writing.
   */
  async #selectTemplate(): Promise<
    SelectedProjectTemplate | RejectedProjectTemplate
  > {
    const loaded =
      this.#library === null
        ? null
        : await this.#library.load('project', 'default');
    if (loaded === null) {
      return {
        ok: true,
        source: 'packaged',
        template: PACKAGED_MINIMAL_PROJECT_TEMPLATE,
        fingerprint: PACKAGED_PROJECT_FINGERPRINT,
      };
    }

    const document = parseTemplateDocument(loaded.template);
    const diagnostics: Diagnostic[] = [...document.diagnostics];
    if (
      document.metadata.templateFor !== null &&
      document.metadata.templateFor !== 'project'
    ) {
      diagnostics.push(
        diagnostic(
          loaded.template.path,
          'template.kind_mismatch',
          `The template declares ${document.metadata.templateFor}, not project.`,
          'template_for',
          'Move the template to the folder for its own kind, or correct its template_for value.',
        ),
      );
    }
    if (hasError(diagnostics)) {
      return { ok: false, diagnostics };
    }
    return {
      ok: true,
      source: 'vault',
      template: loaded.template,
      fingerprint: loaded.fingerprint,
    };
  }
}

interface SelectedProjectTemplate {
  readonly ok: true;
  readonly source: 'packaged' | 'vault';
  readonly template: TemplateSource;
  readonly fingerprint: string;
}

interface RejectedProjectTemplate {
  readonly ok: false;
  readonly diagnostics: readonly Diagnostic[];
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
