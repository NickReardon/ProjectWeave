import type {
  Diagnostic,
  IndexFreshness,
  ProjectStatus,
} from '../domain/model';
import type { TemplateClock } from '../domain/templates/model';
import type { IndexSnapshot } from '../indexing/index-snapshot';
import type { VaultReader } from '../ports/vault-reader';
import {
  allocateProjectPath,
  collectVaultFolders,
} from './project-creation-allocator';
import type { ProjectCreationProposal } from './project-creation-proposal';
import type { ProjectCreationProposalService } from './project-creation-proposal';
import { byteLength, lineCount } from './task-creation-preview';

export interface ProjectCreationPreviewRequest {
  /** An indexed project root, chosen by the caller. */
  readonly root: string;
  readonly title: string;
  readonly status?: ProjectStatus | null;
  /** Supplied by the caller; this layer reads no clock of its own. */
  readonly clock: TemplateClock;
  readonly templateInputs?: Readonly<Record<string, unknown>>;
}

export interface ProjectCreationPreviewAllocation {
  readonly targetPath: string;
  readonly projectFolder: string;
  /** True when the derived folder was taken and a suffix was applied. */
  readonly renamedForCollision: boolean;
}

export interface ProjectCreationPreviewSuccess {
  readonly ok: true;
  readonly index_revision: number;
  readonly index_freshness: IndexFreshness;
  readonly allocation: ProjectCreationPreviewAllocation;
  readonly proposal: ProjectCreationProposal;
  readonly content: string;
  readonly byteLength: number;
  readonly lineCount: number;
  readonly diagnostics: readonly Diagnostic[];
}

export interface ProjectCreationPreviewFailure {
  readonly ok: false;
  readonly index_revision: number;
  readonly index_freshness: IndexFreshness;
  readonly allocation: ProjectCreationPreviewAllocation | null;
  readonly diagnostics: readonly Diagnostic[];
}

export type ProjectCreationPreviewResult =
  ProjectCreationPreviewSuccess | ProjectCreationPreviewFailure;

/**
 * Compose folder allocation with the project creation proposal service to
 * produce everything a user must see before any note is written.
 *
 * As with tasks, this service holds no writer and produces only a proposal.
 * There is no rank to allocate: rank orders tasks within a project, and a
 * project is not ordered within anything.
 */
export class ProjectCreationPreviewService {
  readonly #getSnapshot: () => IndexSnapshot;
  readonly #vault: VaultReader;
  readonly #proposals: ProjectCreationProposalService;

  public constructor(
    getSnapshot: () => IndexSnapshot,
    vault: VaultReader,
    proposals: ProjectCreationProposalService,
  ) {
    this.#getSnapshot = getSnapshot;
    this.#vault = vault;
    this.#proposals = proposals;
  }

  public async preview(
    request: ProjectCreationPreviewRequest,
  ): Promise<ProjectCreationPreviewResult> {
    const snapshot = this.#getSnapshot();
    const paths = await this.#vault.listMarkdownPaths();

    const path = allocateProjectPath({
      root: request.root,
      title: request.title,
      occupiedPaths: new Set(paths.map((value) => value.toLowerCase())),
      occupiedFolders: collectVaultFolders(paths),
    });
    if (!path.ok) {
      return failure(snapshot, null, path.diagnostics);
    }

    const allocation: ProjectCreationPreviewAllocation = {
      targetPath: path.targetPath,
      projectFolder: path.projectFolder,
      renamedForCollision: path.attempt > 1,
    };

    const proposal = await this.#proposals.propose({
      operationId: `preview:${String(snapshot.revision)}:${path.targetPath}`,
      targetPath: path.targetPath,
      title: request.title,
      clock: request.clock,
      ...(request.status === undefined ? {} : { status: request.status }),
      ...(request.templateInputs === undefined
        ? {}
        : { templateInputs: request.templateInputs }),
    });
    if (!proposal.ok) {
      return failure(snapshot, allocation, proposal.diagnostics);
    }

    const content = proposal.created_files[0]?.content ?? '';
    return {
      ok: true,
      index_revision: proposal.index_revision,
      index_freshness: proposal.index_freshness,
      allocation,
      proposal,
      content,
      byteLength: byteLength(content),
      lineCount: lineCount(content),
      diagnostics: proposal.diagnostics,
    };
  }
}

function failure(
  snapshot: IndexSnapshot,
  allocation: ProjectCreationPreviewAllocation | null,
  diagnostics: readonly Diagnostic[],
): ProjectCreationPreviewFailure {
  return {
    ok: false,
    index_revision: snapshot.revision,
    index_freshness: snapshot.freshness,
    allocation,
    diagnostics,
  };
}
