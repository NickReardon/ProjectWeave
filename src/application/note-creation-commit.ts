import { parseMarkdownEntity } from '../domain/markdown-parser';
import type { Diagnostic } from '../domain/model';
import type { IndexSnapshot } from '../indexing/index-snapshot';
import type { NoteWriter } from '../ports/note-writer';
import type { VaultReader } from '../ports/vault-reader';

/** The kinds this commit path can create. */
export type CreatedNoteKind = 'task' | 'project';

/**
 * What a commit needs from a proposal, and no more. Each kind's proposal
 * service returns a richer object; this is the part the write depends on, so a
 * new kind reaches the vault through the same checked sequence rather than
 * through a second copy of it.
 */
export interface NoteCreationProposal {
  readonly operation_id: string;
  readonly template: {
    readonly kind: CreatedNoteKind;
    readonly source: string;
  };
  readonly read_set: readonly {
    readonly role: string;
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
}

export interface NoteCreationCommitSuccess {
  readonly ok: true;
  readonly operation_id: string;
  readonly created_path: string;
  readonly diagnostics: readonly Diagnostic[];
}

export interface NoteCreationCommitFailure {
  readonly ok: false;
  readonly operation_id: string;
  /** True only when nothing was written, which is every failure here. */
  readonly vault_unchanged: true;
  readonly diagnostics: readonly Diagnostic[];
}

export type NoteCreationCommitResult =
  NoteCreationCommitSuccess | NoteCreationCommitFailure;

/**
 * Commits one previously confirmed creation proposal, of any kind.
 *
 * This is the only path to a vault write. It implements the single-file commit
 * sequence in docs/spec/10-validation-and-safe-writes.md: re-check the read
 * set, confirm the target is still absent, re-validate the produced note in
 * memory, then commit once.
 *
 * The bytes written are the proposal's bytes — the ones the user actually
 * saw. If any input has changed since, the commit aborts rather than silently
 * rendering something different from what was confirmed.
 */
export class NoteCreationCommitService {
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
    proposal: NoteCreationProposal,
  ): Promise<NoteCreationCommitResult> {
    const operationId = proposal.operation_id;
    const kind = proposal.template.kind;
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
          `${sentenceCase(kind)} creation is disabled while the project index is not current.`,
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
            `Preview the ${kind} again to build a proposal from current notes.`,
          ),
        ]);
      }
      if (current.fingerprint !== entry.fingerprint) {
        return failure(operationId, [
          diagnostic(
            entry.path,
            'commit.read_set.changed',
            `The ${entry.role} note changed after this ${kind} was previewed.`,
            entry.role,
            `Preview the ${kind} again to see what would be created now.`,
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
            `Preview the ${kind} again to be offered a free path.`,
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
    if (entity === null || entity.kind !== kind) {
      return failure(operationId, [
        diagnostic(
          created.path,
          'commit.output.invalid',
          `The note this proposal would write does not parse as a ${kind}.`,
          undefined,
          `Correct the template, then preview the ${kind} again.`,
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
            `Preview the ${kind} again to be offered a free path.`,
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
): NoteCreationCommitFailure {
  return {
    ok: false,
    operation_id: operationId,
    vault_unchanged: true,
    diagnostics,
  };
}

function sentenceCase(kind: CreatedNoteKind): string {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
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
