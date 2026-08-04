import { normalizeVaultPath } from '../domain/markdown-parser';
import type { Diagnostic, ProjectEntity, TaskEntity } from '../domain/model';
import {
  hasControlCharacter,
  isSafeVaultNotePath,
  joinVaultPath,
  sanitizeNoteFilename,
  vaultParentFolder,
} from '../domain/vault-path';
import type { VaultReader } from '../ports/vault-reader';

/**
 * Folder that holds a project's task notes, relative to the folder containing
 * the project note. ADR 0008 fixes this convention rather than adding a
 * setting: it needs no configuration, it keeps tasks beside the project they
 * belong to, and a project that moves takes its tasks with it.
 */
export const TASK_FOLDER_NAME = 'Tasks';

/**
 * Rank gap between consecutive new tasks
 * (docs/design/15-scheduling-and-milestones.md).
 */
export const RANK_GAP = 1000;

/**
 * Highest rank this allocator will hand out. Ranks must stay positive safe
 * integers so the parser accepts them back; stopping well short of that limit
 * keeps room for the midpoint inserts a later reorder slice will need.
 */
const MAX_ALLOCATABLE_RANK = Number.MAX_SAFE_INTEGER - RANK_GAP;

/**
 * How many suffixed names to try before giving up. A user who already has a
 * hundred notes sharing one title is better served by a different title than
 * by a hundred-and-first suffix.
 */
const MAX_PATH_ATTEMPTS = 100;

export interface TaskPathAllocationInput {
  readonly project: ProjectEntity;
  readonly title: string;
  /** Optional folder beneath the project's task root, for organization. */
  readonly subfolder?: string;
  /** Normalized, lowercased paths already present in the vault. */
  readonly occupiedPaths: ReadonlySet<string>;
}

export interface TaskPathAllocation {
  readonly ok: true;
  readonly targetPath: string;
  readonly taskFolder: string;
  /** Collision suffix applied, or 1 when the derived name was already free. */
  readonly attempt: number;
}

export interface TaskRankAllocation {
  readonly ok: true;
  readonly rank: number;
}

export interface AllocationFailure {
  readonly ok: false;
  readonly diagnostics: readonly Diagnostic[];
}

export type TaskPathAllocationResult = TaskPathAllocation | AllocationFailure;
export type TaskRankAllocationResult = TaskRankAllocation | AllocationFailure;

/**
 * Choose the vault path for a new task note.
 *
 * This suggests a free path; it never reserves or creates one. The proposal
 * service re-checks the target through the vault port and fails closed on
 * `proposal.target.exists`, which stays the authoritative guard — this only
 * spares the user a collision they can predict. Design 03 requires a collision
 * to block creation and offer another filename, and Design 17 expects the
 * generated name to remain visible and editable in the preview; suggesting a
 * free name satisfies both, because suggesting is not committing.
 */
export function allocateTaskPath(
  input: TaskPathAllocationInput,
): TaskPathAllocationResult {
  const projectPath = normalizeVaultPath(input.project.path);
  const taskRoot = joinVaultPath(
    vaultParentFolder(projectPath),
    TASK_FOLDER_NAME,
  );

  const subfolder = resolveSubfolder(input.subfolder ?? '');
  if (subfolder === null) {
    return {
      ok: false,
      diagnostics: [
        diagnostic(
          projectPath,
          'allocation.subfolder.invalid',
          `\`${input.subfolder ?? ''}\` is not a usable folder beneath \`${taskRoot}\`.`,
          'subfolder',
          'Use a relative folder name without drive letters, leading slashes, or `..` segments.',
        ),
      ],
    };
  }

  const stem = sanitizeNoteFilename(input.title);
  if (stem === null) {
    return {
      ok: false,
      diagnostics: [
        diagnostic(
          projectPath,
          'allocation.title.unusable',
          `\`${input.title}\` does not yield a usable note filename.`,
          'title',
          'Give the task a title containing at least one ordinary character.',
        ),
      ],
    };
  }

  const folder = joinVaultPath(taskRoot, subfolder);
  for (let attempt = 1; attempt <= MAX_PATH_ATTEMPTS; attempt += 1) {
    const name = attempt === 1 ? stem : `${stem} ${attempt}`;
    const candidate = joinVaultPath(folder, `${name}.md`);
    // A candidate can still be unsafe when a valid stem meets a deep folder,
    // so the shared gate runs on the assembled path rather than its parts.
    if (!isSafeVaultNotePath(candidate)) {
      break;
    }
    if (!input.occupiedPaths.has(candidate.toLowerCase())) {
      return { ok: true, targetPath: candidate, taskFolder: folder, attempt };
    }
  }

  return {
    ok: false,
    diagnostics: [
      diagnostic(
        folder,
        'allocation.target.exhausted',
        `No free note path for \`${stem}\` in \`${folder}\`.`,
        'target_path',
        'Choose a different task title, or file it under another subfolder.',
      ),
    ],
  };
}

/**
 * Choose the backlog rank for a new task: one gap past the project's largest
 * existing rank (docs/design/15-scheduling-and-milestones.md).
 *
 * The maximum spans every task in the project rather than only backlog ones.
 * Design 15 keeps a rank while a task is assigned elsewhere, so a
 * status-scoped maximum would reissue a rank the project is still using.
 */
export function allocateTaskRank(
  tasks: readonly TaskEntity[],
): TaskRankAllocationResult {
  let highest = 0;
  for (const task of tasks) {
    const { rank } = task;
    if (rank !== null && Number.isInteger(rank) && rank > highest) {
      highest = rank;
    }
  }

  // An unranked project starts at one gap rather than at zero, matching the
  // 1000, 2000, 3000 sequence an explicit rebalance would produce.
  if (highest > MAX_ALLOCATABLE_RANK) {
    return {
      ok: false,
      diagnostics: [
        diagnostic(
          '',
          'allocation.rank.exhausted',
          'This project has no room left for another spaced rank.',
          'rank',
          'Rebalance the project backlog ranks before creating more tasks.',
        ),
      ],
    };
  }
  return { ok: true, rank: highest + RANK_GAP };
}

/**
 * Read every Markdown path the vault currently exposes, lowercased, so path
 * allocation can detect collisions on case-insensitive filesystems where
 * `Fix crash.md` and `fix crash.md` are the same file.
 */
export async function collectVaultNotePaths(
  vault: VaultReader,
): Promise<ReadonlySet<string>> {
  const notes = await vault.listMarkdownNotes();
  return new Set(
    notes.map((note) => normalizeVaultPath(note.path).toLowerCase()),
  );
}

/**
 * Normalize a caller-supplied subfolder, or null when it would escape the task
 * root. Rejecting beats repairing here: a `..` segment means the caller
 * intended somewhere else, and quietly clamping it would file the task in a
 * folder nobody chose.
 */
function resolveSubfolder(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return '';
  }
  if (hasControlCharacter(trimmed) || /^[a-z]:/iu.test(trimmed)) {
    return null;
  }
  // Reject before normalizing so a leading slash reads as "vault root", which
  // is not a request this allocator can honor.
  if (trimmed !== trimmed.replace(/^[/\\]+|[/\\]+$/gu, '')) {
    return null;
  }

  const normalized = normalizeVaultPath(trimmed);
  const segments = normalized.split('/');
  const usable = segments.every(
    (segment) =>
      segment.length > 0 &&
      segment !== '.' &&
      segment !== '..' &&
      segment.trim().length > 0,
  );
  return usable ? normalized : null;
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
