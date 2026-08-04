import { normalizeVaultPath } from '../domain/markdown-parser';
import type { Diagnostic, IndexFreshness } from '../domain/model';
import type { TemplateClock } from '../domain/templates/model';
import type { IndexSnapshot } from '../indexing/index-snapshot';
import type { VaultReader } from '../ports/vault-reader';
import {
  allocateTaskPath,
  allocateTaskRank,
  collectVaultNotePaths,
} from './task-creation-allocator';
import type {
  TaskCreationProposal,
  TaskCreationProposalService,
} from './task-creation-proposal';

export interface TaskCreationPreviewRequest {
  readonly projectPath: string;
  readonly title: string;
  /** Optional folder beneath the project's task root. */
  readonly subfolder?: string;
  readonly templateVariant?: string;
  readonly createOnBoard?: boolean;
  /** Supplied by the caller; this layer reads no clock of its own. */
  readonly clock: TemplateClock;
  readonly templateInputs?: Readonly<Record<string, unknown>>;
}

export interface TaskCreationPreviewAllocation {
  readonly targetPath: string;
  readonly taskFolder: string;
  readonly rank: number;
  /** True when the derived filename was taken and a suffix was applied. */
  readonly renamedForCollision: boolean;
}

export interface TaskCreationPreviewSuccess {
  readonly ok: true;
  readonly index_revision: number;
  readonly index_freshness: IndexFreshness;
  readonly allocation: TaskCreationPreviewAllocation;
  readonly proposal: TaskCreationProposal;
  readonly content: string;
  readonly byteLength: number;
  readonly lineCount: number;
  readonly diagnostics: readonly Diagnostic[];
}

export interface TaskCreationPreviewFailure {
  readonly ok: false;
  readonly index_revision: number;
  readonly index_freshness: IndexFreshness;
  readonly allocation: TaskCreationPreviewAllocation | null;
  readonly diagnostics: readonly Diagnostic[];
}

export type TaskCreationPreviewResult =
  TaskCreationPreviewSuccess | TaskCreationPreviewFailure;

/**
 * Compose target-path and rank allocation with the task creation proposal
 * service to produce everything a user must see before any note is written.
 *
 * This service still cannot write. It exists so the exact target path,
 * preconditions, rendered bytes, and expected postconditions are visible and
 * reviewable before a write coordinator is built, which is the order the
 * safe-write contract requires.
 */
export class TaskCreationPreviewService {
  readonly #getSnapshot: () => IndexSnapshot;
  readonly #vault: VaultReader;
  readonly #proposals: TaskCreationProposalService;

  public constructor(
    getSnapshot: () => IndexSnapshot,
    vault: VaultReader,
    proposals: TaskCreationProposalService,
  ) {
    this.#getSnapshot = getSnapshot;
    this.#vault = vault;
    this.#proposals = proposals;
  }

  public async preview(
    request: TaskCreationPreviewRequest,
  ): Promise<TaskCreationPreviewResult> {
    const snapshot = this.#getSnapshot();
    const projectPath = normalizeVaultPath(request.projectPath);
    const entity = snapshot.getEntity(projectPath);
    const project = entity?.kind === 'project' ? entity : null;
    if (project === null) {
      return failure(snapshot, null, [
        diagnostic(
          projectPath,
          'preview.project.not_found',
          'The selected project is not indexed as a project note.',
          'project',
          'Select a valid project and rebuild the index if needed.',
        ),
      ]);
    }

    const path = allocateTaskPath({
      project,
      title: request.title,
      ...(request.subfolder === undefined
        ? {}
        : { subfolder: request.subfolder }),
      occupiedPaths: await collectVaultNotePaths(this.#vault),
    });
    if (!path.ok) {
      return failure(snapshot, null, path.diagnostics);
    }

    const rank = allocateTaskRank(snapshot.getTasksForProject(project.path));
    if (!rank.ok) {
      return failure(snapshot, null, rank.diagnostics);
    }

    const allocation: TaskCreationPreviewAllocation = {
      targetPath: path.targetPath,
      taskFolder: path.taskFolder,
      rank: rank.rank,
      renamedForCollision: path.attempt > 1,
    };

    const proposal = await this.#proposals.propose({
      operationId: previewOperationId(snapshot.revision, path.targetPath),
      projectPath: project.path,
      targetPath: path.targetPath,
      ...(request.templateVariant === undefined
        ? {}
        : { templateVariant: request.templateVariant }),
      ...(request.createOnBoard === undefined
        ? {}
        : { createOnBoard: request.createOnBoard }),
      task: {
        title: request.title,
        clock: request.clock,
        rank: rank.rank,
      },
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

/**
 * A preview is never committed, so its operation ID is derived rather than
 * random: identical requests against one index revision produce identical
 * previews, which keeps the surface testable and its output comparable.
 */
export function previewOperationId(
  revision: number,
  targetPath: string,
): string {
  return `preview:${String(revision)}:${targetPath}`;
}

export function byteLength(content: string): number {
  return new TextEncoder().encode(content).length;
}

export function lineCount(content: string): number {
  if (content.length === 0) {
    return 0;
  }
  const lines = content.split('\n').length;
  // A trailing newline terminates the last line rather than starting a new one.
  return content.endsWith('\n') ? lines - 1 : lines;
}

function failure(
  snapshot: IndexSnapshot,
  allocation: TaskCreationPreviewAllocation | null,
  diagnostics: readonly Diagnostic[],
): TaskCreationPreviewFailure {
  return {
    ok: false,
    index_revision: snapshot.revision,
    index_freshness: snapshot.freshness,
    allocation,
    diagnostics,
  };
}

function diagnostic(
  path: string,
  code: string,
  message: string,
  field: string,
  recovery: string,
): Diagnostic {
  return { path, code, severity: 'error', message, field, recovery };
}
