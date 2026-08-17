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
  /** Required for multi-file proposals; single-file proposals imply their path. */
  readonly write_order?: readonly string[];
}

export interface NoteCreationCommitSuccess {
  readonly ok: true;
  readonly operation_id: string;
  /** Compatibility field for the existing one-file creation UI. */
  readonly created_path: string;
  readonly created_paths: readonly string[];
  readonly written_paths: readonly string[];
  readonly unchanged_paths: readonly string[];
  readonly unwritten_paths: readonly string[];
  readonly diagnostics: readonly Diagnostic[];
}

export interface NoteCreationCommitFailure {
  readonly ok: false;
  readonly operation_id: string;
  /** True only when this operation wrote no note before it stopped. */
  readonly vault_unchanged: boolean;
  readonly written_paths: readonly string[];
  readonly unchanged_paths: readonly string[];
  readonly unwritten_paths: readonly string[];
  readonly diagnostics: readonly Diagnostic[];
}

export type NoteCreationCommitResult =
  NoteCreationCommitSuccess | NoteCreationCommitFailure;

/**
 * Commits one previously confirmed create-only proposal, of any kind.
 *
 * This is the only path to a project-content write. It implements the safe
 * write sequence in docs/spec/validation-and-safe-writes.md: re-check the
 * complete read set and every target, validate every output in memory, then
 * write in the proposal's deterministic order. A multi-file failure stops the
 * sequence and reports exactly what was and was not written.
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
    const ordered = orderedCreatedFiles(proposal);
    if (!ordered.ok) {
      return failure(
        operationId,
        [
          diagnostic(
            '',
            'commit.proposal.unsupported',
            ordered.message,
            ordered.field,
            'Rebuild the proposal with unique targets and a complete deterministic write order.',
          ),
        ],
        proposal.created_files.map((file) => file.path),
      );
    }
    const createdFiles = ordered.files;
    const createdPaths = createdFiles.map((file) => file.path);
    const firstCreated = createdFiles[0];
    if (firstCreated === undefined) {
      return failure(operationId, [], []);
    }

    // An index that is not current cannot be trusted to say what exists.
    const snapshot = this.#getSnapshot();
    if (snapshot.freshness !== 'current') {
      return failure(
        operationId,
        [
          diagnostic(
            firstCreated.path,
            'commit.index.not_current',
            `${sentenceCase(kind)} creation is disabled while the project index is not current.`,
            undefined,
            'Wait for indexing to finish, then preview and confirm again.',
          ),
        ],
        createdPaths,
      );
    }

    // Re-read every input the proposal was built from. An unrelated change
    // elsewhere in the vault is fine; a change to one of these aborts all.
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
        return failure(
          operationId,
          [
            diagnostic(
              entry.path,
              'commit.read_set.missing',
              `The ${entry.role} note this proposal was built from no longer exists.`,
              entry.role,
              `Preview the ${kind} again to build a proposal from current notes.`,
            ),
          ],
          createdPaths,
        );
      }
      if (current.fingerprint !== entry.fingerprint) {
        return failure(
          operationId,
          [
            diagnostic(
              entry.path,
              'commit.read_set.changed',
              `The ${entry.role} note changed after this ${kind} was previewed.`,
              entry.role,
              `Preview the ${kind} again to see what would be created now.`,
            ),
          ],
          createdPaths,
        );
      }
    }

    // Re-check every declared precondition before the first write.
    for (const precondition of proposal.preconditions) {
      const existing = await this.#vault.readMarkdownNote(precondition.path);
      if (existing !== null) {
        return failure(
          operationId,
          [
            diagnostic(
              precondition.path,
              'commit.target.exists',
              'A note now exists at the proposed path.',
              'target_path',
              `Preview the ${kind} again to be offered a free path.`,
            ),
          ],
          createdPaths,
        );
      }
    }

    // Validate every exact output before the first write. One invalid later
    // file must never turn a bulk operation into an avoidable partial commit.
    const validationDiagnostics: Diagnostic[] = [];
    const outputDiagnostics: Diagnostic[] = [];
    for (const created of createdFiles) {
      const parsed = parseMarkdownEntity({
        path: created.path,
        content: created.content,
        fingerprint: 'pending-commit',
      });
      const blocking = parsed.diagnostics.filter(
        (issue) => issue.severity === 'error',
      );
      if (parsed.entity === null || parsed.entity.kind !== kind) {
        validationDiagnostics.push(
          diagnostic(
            created.path,
            'commit.output.invalid',
            `The note this proposal would write does not parse as a ${kind}.`,
            undefined,
            `Correct the template, then preview the ${kind} again.`,
          ),
        );
      }
      validationDiagnostics.push(...blocking);
      outputDiagnostics.push(...parsed.diagnostics);
    }
    if (validationDiagnostics.length > 0) {
      return failure(operationId, validationDiagnostics, createdPaths);
    }

    const writtenPaths: string[] = [];
    for (let index = 0; index < createdFiles.length; index += 1) {
      const created = createdFiles[index];
      if (created === undefined) {
        continue;
      }
      const outcome = await this.#writer.createNote(
        created.path,
        created.content,
      );
      if (outcome.kind === 'created') {
        writtenPaths.push(created.path);
        continue;
      }

      const unwrittenPaths = createdFiles.slice(index).map((file) => file.path);
      switch (outcome.kind) {
        case 'exists':
          // Lost a race between preflight and this individual write.
          return failure(
            operationId,
            [
              diagnostic(
                created.path,
                'commit.target.exists',
                'A note appeared at the proposed path during the write.',
                'target_path',
                `Preview the ${kind} again to be offered a free path.`,
              ),
            ],
            unwrittenPaths,
            writtenPaths,
          );
        case 'out_of_scope':
          return failure(
            operationId,
            [
              diagnostic(
                created.path,
                'commit.target.out_of_scope',
                'The proposed path lies outside the folders Project Weave may write to.',
                'target_path',
                'Choose a project inside an indexed project folder.',
              ),
            ],
            unwrittenPaths,
            writtenPaths,
          );
        case 'failed':
          return failure(
            operationId,
            [
              diagnostic(
                created.path,
                'commit.write.failed',
                'The vault refused to create the note: ' + outcome.message,
                undefined,
                'Check that the folder is writable, then preview and confirm again.',
              ),
            ],
            unwrittenPaths,
            writtenPaths,
          );
      }
    }

    return {
      ok: true,
      operation_id: operationId,
      created_path: firstCreated.path,
      created_paths: createdPaths,
      written_paths: createdPaths,
      unchanged_paths: [],
      unwritten_paths: [],
      diagnostics: outputDiagnostics,
    };
  }
}

function failure(
  operationId: string,
  diagnostics: readonly Diagnostic[],
  unwrittenPaths: readonly string[] = [],
  writtenPaths: readonly string[] = [],
): NoteCreationCommitFailure {
  return {
    ok: false,
    operation_id: operationId,
    vault_unchanged: writtenPaths.length === 0,
    written_paths: writtenPaths,
    unchanged_paths: [],
    unwritten_paths: unwrittenPaths,
    diagnostics,
  };
}

type CreatedFile = NoteCreationProposal['created_files'][number];

type OrderedCreatedFiles =
  | { readonly ok: true; readonly files: readonly CreatedFile[] }
  | {
      readonly ok: false;
      readonly field: 'created_files' | 'preconditions' | 'write_order';
      readonly message: string;
    };

function orderedCreatedFiles(
  proposal: NoteCreationProposal,
): OrderedCreatedFiles {
  if (proposal.created_files.length === 0) {
    return {
      ok: false,
      field: 'created_files',
      message: 'A creation proposal must contain at least one note.',
    };
  }

  const byPath = new Map(
    proposal.created_files.map((file) => [file.path, file] as const),
  );
  if (byPath.size !== proposal.created_files.length) {
    return {
      ok: false,
      field: 'created_files',
      message: 'A creation proposal cannot contain the same target path twice.',
    };
  }

  const absentPaths = new Set(
    proposal.preconditions.map((entry) => entry.path),
  );
  if (proposal.created_files.some((file) => !absentPaths.has(file.path))) {
    return {
      ok: false,
      field: 'preconditions',
      message: 'Every created path must have a path-absent precondition.',
    };
  }

  if (proposal.write_order === undefined) {
    if (proposal.created_files.length === 1) {
      return { ok: true, files: proposal.created_files };
    }
    return {
      ok: false,
      field: 'write_order',
      message: 'A multi-file creation proposal must declare its write order.',
    };
  }

  const uniqueOrder = new Set(proposal.write_order);
  if (
    uniqueOrder.size !== proposal.write_order.length ||
    proposal.write_order.length !== proposal.created_files.length ||
    proposal.write_order.some((path) => !byPath.has(path))
  ) {
    return {
      ok: false,
      field: 'write_order',
      message:
        'The proposal write order must list every created path exactly once.',
    };
  }

  return {
    ok: true,
    files: proposal.write_order.map((path) => byPath.get(path)!),
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
