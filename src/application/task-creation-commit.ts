import { parseMarkdownEntity } from '../domain/markdown-parser';
import type { Diagnostic } from '../domain/model';
import type { IndexSnapshot } from '../indexing/index-snapshot';
import type { NoteWriter } from '../ports/note-writer';
import type { VaultReader } from '../ports/vault-reader';
import type { TaskCreationProposal } from './task-creation-proposal';

export interface TaskCreationCommitSuccess {
  readonly ok: true;
  readonly operation_id: string;
  readonly created_path: string;
  readonly diagnostics: readonly Diagnostic[];
}

export interface TaskCreationCommitFailure {
  readonly ok: false;
  readonly operation_id: string;
  /** True only when nothing was written, which is every failure here. */
  readonly vault_unchanged: true;
  readonly diagnostics: readonly Diagnostic[];
}

export type TaskCreationCommitResult =
  TaskCreationCommitSuccess | TaskCreationCommitFailure;

/**
 * Commits one previously confirmed task creation proposal.
 *
 * This is the only path to a vault write. It implements the single-file commit
 * sequence in docs/design/10-validation-and-safe-writes.md: re-check the read
 * set, confirm the target is still absent, re-validate the produced note in
 * memory, then commit once.
 *
 * The bytes written are the proposal's bytes — the ones the user actually
 * saw. If any input has changed since, the commit aborts rather than silently
 * rendering something different from what was confirmed.
 */
export class TaskCreationCommitService {
  readonly #getSnapshot: () => IndexSnapshot;
  readonly #vault: VaultReader;
  readonly #writer: NoteWriter;

  public constructor(
    getSnapshot: () => IndexSnapshot,
    vault: VaultReader,
    writer: NoteWriter,
  ) {
    this.#getSnapshot = getSnapshot;
    this.#vault = vault;
    this.#writer = writer;
  }

  public async commit(
    proposal: TaskCreationProposal,
  ): Promise<TaskCreationCommitResult> {
    const operationId = proposal.operation_id;
    const created = proposal.created_files[0];
    if (proposal.created_files.length !== 1 || created === undefined) {
      return failure(operationId, [
        diagnostic(
          '',
          'commit.proposal.unsupported',
          'This commit path creates exactly one note.',
          'created_files',
          'Rebuild the proposal, or use a bulk operation once one exists.',
        ),
      ]);
    }

    // An index that is not current cannot be trusted to say what exists.
    const snapshot = this.#getSnapshot();
    if (snapshot.freshness !== 'current') {
      return failure(operationId, [
        diagnostic(
          created.path,
          'commit.index.not_current',
          'Task creation is disabled while the project index is not current.',
          undefined,
          'Wait for indexing to finish, then preview and confirm again.',
        ),
      ]);
    }

    // Re-read every input the proposal was built from. An unrelated change
    // elsewhere in the vault is fine; a change to these is not, because the
    // rendered bytes were derived from them.
    for (const entry of proposal.read_set) {
      if (
        entry.role === 'template' &&
        proposal.template.source === 'packaged'
      ) {
        // A packaged template ships inside the plugin build. There is no vault
        // note to re-read, and it cannot drift while the plugin is loaded.
        continue;
      }
      const current = await this.#vault.readMarkdownNote(entry.path);
      if (current === null) {
        return failure(operationId, [
          diagnostic(
            entry.path,
            'commit.read_set.missing',
            `The ${entry.role} note this proposal was built from no longer exists.`,
            entry.role,
            'Preview the task again to build a proposal from current notes.',
          ),
        ]);
      }
      if (current.fingerprint !== entry.fingerprint) {
        return failure(operationId, [
          diagnostic(
            entry.path,
            'commit.read_set.changed',
            `The ${entry.role} note changed after this task was previewed.`,
            entry.role,
            'Preview the task again to see what would be created now.',
          ),
        ]);
      }
    }

    // Re-check the declared preconditions rather than trusting the preview.
    for (const precondition of proposal.preconditions) {
      const existing = await this.#vault.readMarkdownNote(precondition.path);
      if (existing !== null) {
        return failure(operationId, [
          diagnostic(
            precondition.path,
            'commit.target.exists',
            'A note now exists at the proposed path.',
            'target_path',
            'Preview the task again to be offered a free path.',
          ),
        ]);
      }
    }

    // Validate the exact bytes about to be written, in memory, before writing.
    const parsed = parseMarkdownEntity({
      path: created.path,
      content: created.content,
      fingerprint: 'pending-commit',
    });
    const entity = parsed.entity;
    if (entity === null || entity.kind !== 'task') {
      return failure(operationId, [
        diagnostic(
          created.path,
          'commit.output.invalid',
          'The note this proposal would write does not parse as a task.',
          undefined,
          'Correct the project template, then preview the task again.',
        ),
        ...parsed.diagnostics.filter((issue) => issue.severity === 'error'),
      ]);
    }
    const blocking = parsed.diagnostics.filter(
      (issue) => issue.severity === 'error',
    );
    if (blocking.length > 0) {
      return failure(operationId, blocking);
    }

    const outcome = await this.#writer.createNote(
      created.path,
      created.content,
    );
    switch (outcome.kind) {
      case 'created':
        return {
          ok: true,
          operation_id: operationId,
          created_path: created.path,
          diagnostics: parsed.diagnostics,
        };
      case 'exists':
        // Lost a race between the precondition check and the write.
        return failure(operationId, [
          diagnostic(
            created.path,
            'commit.target.exists',
            'A note appeared at the proposed path during the write.',
            'target_path',
            'Preview the task again to be offered a free path.',
          ),
        ]);
      case 'out_of_scope':
        return failure(operationId, [
          diagnostic(
            created.path,
            'commit.target.out_of_scope',
            'The proposed path lies outside the folders Project Weave may write to.',
            'target_path',
            'Choose a project inside an indexed project folder.',
          ),
        ]);
      case 'failed':
        return failure(operationId, [
          diagnostic(
            created.path,
            'commit.write.failed',
            'The vault refused to create the note: ' + outcome.message,
            undefined,
            'Check that the folder is writable, then preview and confirm again.',
          ),
        ]);
    }
  }
}

function failure(
  operationId: string,
  diagnostics: readonly Diagnostic[],
): TaskCreationCommitFailure {
  return {
    ok: false,
    operation_id: operationId,
    vault_unchanged: true,
    diagnostics,
  };
}

function diagnostic(
  path: string,
  code: string,
  message: string,
  field: string | undefined,
  recovery: string,
): Diagnostic {
  return {
    path,
    code,
    severity: 'error',
    message,
    ...(field === undefined ? {} : { field }),
    recovery,
  };
}
