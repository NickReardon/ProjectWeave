import { normalizeVaultPath } from '../domain/markdown-parser';
import type { Diagnostic } from '../domain/model';
import {
  isSafeVaultNotePath,
  joinVaultPath,
  sanitizeNoteFilename,
} from '../domain/vault-path';

/**
 * Filename of the note that defines a project, inside that project's folder.
 *
 * Fixed rather than derived from the title, because ADR 0012 makes the folder
 * the project's identity: the folder carries the name, and every note the
 * project owns sits beneath it.
 */
export const PROJECT_NOTE_NAME = 'Project.md';

/**
 * How many suffixed folder names to try before giving up, matching the task
 * allocator's limit for the same reason: a user with a hundred projects of one
 * name is better served by a different name than by a hundred-and-first.
 */
const MAX_PATH_ATTEMPTS = 100;

export interface ProjectPathAllocationInput {
  /** An indexed project root, such as `Projects`. */
  readonly root: string;
  readonly title: string;
  /** Normalized, lowercased paths already present in the vault. */
  readonly occupiedPaths: ReadonlySet<string>;
  /** Normalized, lowercased folder paths already present in the vault. */
  readonly occupiedFolders: ReadonlySet<string>;
}

export interface ProjectPathAllocation {
  readonly ok: true;
  readonly targetPath: string;
  /** The folder that will hold the project note and everything it owns. */
  readonly projectFolder: string;
  /** Collision suffix applied, or 1 when the derived name was already free. */
  readonly attempt: number;
}

export interface ProjectAllocationFailure {
  readonly ok: false;
  readonly diagnostics: readonly Diagnostic[];
}

export type ProjectPathAllocationResult =
  ProjectPathAllocation | ProjectAllocationFailure;

/**
 * Choose the vault path for a new project note: `<root>/<Title>/Project.md`
 * per ADR 0012.
 *
 * Like task allocation, this suggests a free path and never reserves one; the
 * proposal service re-checks the target through the vault port and stays the
 * authoritative guard.
 *
 * The collision unit is the folder, not the note. Two projects sharing a folder
 * would share a `Tasks` folder under ADR 0008, and their tasks would mingle —
 * so an occupied folder is refused even when no `Project.md` sits in it.
 */
export function allocateProjectPath(
  input: ProjectPathAllocationInput,
): ProjectPathAllocationResult {
  const root = resolveRoot(input.root);
  if (root === null) {
    return {
      ok: false,
      diagnostics: [
        diagnostic(
          '',
          'allocation.project_root.invalid',
          `\`${input.root}\` is not a usable project folder.`,
          'root',
          'Choose one of the indexed project folders from settings.',
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
          root,
          'allocation.title.unusable',
          `\`${input.title}\` does not yield a usable folder name.`,
          'title',
          'Give the project a title containing at least one ordinary character.',
        ),
      ],
    };
  }

  for (let attempt = 1; attempt <= MAX_PATH_ATTEMPTS; attempt += 1) {
    const name = attempt === 1 ? stem : `${stem} ${attempt}`;
    const folder = joinVaultPath(root, name);
    const candidate = joinVaultPath(folder, PROJECT_NOTE_NAME);
    // A candidate can still be unsafe when a valid stem meets a deep root, so
    // the shared gate runs on the assembled path rather than its parts.
    if (!isSafeVaultNotePath(candidate)) {
      break;
    }
    if (
      !input.occupiedFolders.has(folder.toLowerCase()) &&
      !input.occupiedPaths.has(candidate.toLowerCase())
    ) {
      return {
        ok: true,
        targetPath: candidate,
        projectFolder: folder,
        attempt,
      };
    }
  }

  return {
    ok: false,
    diagnostics: [
      diagnostic(
        root,
        'allocation.target.exhausted',
        `No free project folder for \`${stem}\` in \`${root}\`.`,
        'target_path',
        'Choose a different project title, or file it under another project folder.',
      ),
    ],
  };
}

/**
 * Derive the folders a vault currently occupies from its note paths, lowercased,
 * so folder collisions are detected on case-insensitive filesystems.
 *
 * Folders are derived rather than listed because the vault port exposes notes,
 * not directories. A folder holding no Markdown at all is therefore invisible
 * here; the proposal's own target check and the writer both still refuse to
 * overwrite anything, so the cost is a suggestion that lands in an existing
 * empty folder rather than a lost note.
 */
export function collectVaultFolders(
  paths: readonly string[],
): ReadonlySet<string> {
  const folders = new Set<string>();
  for (const path of paths) {
    const segments = normalizeVaultPath(path).split('/');
    // The last segment is the note itself.
    for (let index = 1; index < segments.length; index += 1) {
      folders.add(segments.slice(0, index).join('/').toLowerCase());
    }
  }
  return folders;
}

/**
 * Normalize a configured project root, or null when it could not name a folder
 * inside the vault.
 */
function resolveRoot(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (
    /^[a-z]:/iu.test(trimmed) ||
    trimmed !== trimmed.replace(/^[/\\]+/u, '')
  ) {
    return null;
  }
  const normalized = normalizeVaultPath(trimmed).replace(/\/+$/u, '');
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
