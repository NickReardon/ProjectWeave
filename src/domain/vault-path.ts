import { normalizeVaultPath } from './markdown-parser';

/**
 * Characters a note filename may never contain. The first group is unsafe on
 * the filesystems Obsidian runs on; the second (`|#^[]`) would survive on disk
 * but break the wiki links Project Weave writes into frontmatter, so a created
 * note could not be referenced by the relationships that define it.
 */
const UNSAFE_FILENAME_CHARACTERS = /[\\/:*?"<>|#^[\]]/gu;

/** Leading or trailing runs Windows silently strips from a filename. */
const SURROUNDING_DOTS_AND_SPACES = /^[.\s]+|[.\s]+$/gu;

/**
 * Windows device names. These are reserved with or without an extension, so
 * `CON.md` is as unusable as `CON`.
 */
const WINDOWS_RESERVED_NAMES: ReadonlySet<string> = new Set([
  'CON',
  'PRN',
  'AUX',
  'NUL',
  'COM1',
  'COM2',
  'COM3',
  'COM4',
  'COM5',
  'COM6',
  'COM7',
  'COM8',
  'COM9',
  'LPT1',
  'LPT2',
  'LPT3',
  'LPT4',
  'LPT5',
  'LPT6',
  'LPT7',
  'LPT8',
  'LPT9',
]);

/**
 * Longest filename stem a derived name may use. Vault paths also carry a
 * folder prefix, so this leaves room under the practical path limits rather
 * than tracking them exactly.
 */
const MAX_FILENAME_STEM_LENGTH = 120;

export function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) {
      return true;
    }
  }
  return false;
}

/**
 * Whether a path is a safe, already-normalized vault-relative Markdown path.
 *
 * This is the single path-safety gate shared by template rendering and target
 * allocation. It deliberately rejects rather than repairs: a caller that
 * supplied `../` or an unnormalized path has made a mistake worth reporting,
 * and silently rewriting it could move a write outside the intended folder.
 */
export function isSafeVaultNotePath(path: string): boolean {
  const normalized = normalizeVaultPath(path);
  if (path !== normalized) {
    return false;
  }
  if (normalized.length === 0 || !normalized.toLowerCase().endsWith('.md')) {
    return false;
  }
  if (hasControlCharacter(normalized)) {
    return false;
  }
  return normalized
    .split('/')
    .every(
      (segment) => segment.length > 0 && segment !== '.' && segment !== '..',
    );
}

/**
 * Derive a filename stem from a note title, or null when nothing usable
 * remains. Returning null keeps the caller honest: a title of `///` has no
 * reasonable filename, and inventing one would create a note the user did not
 * ask for under a name they did not choose.
 */
export function sanitizeNoteFilename(title: string): string | null {
  // Control characters become separators rather than vanishing: a tab between
  // two words is a word break, and dropping it would fuse them into one.
  const withoutControls = [...title]
    .map((character) => (hasControlCharacter(character) ? ' ' : character))
    .join('');
  const stem = collapse(
    withoutControls.replace(UNSAFE_FILENAME_CHARACTERS, ' '),
  );
  if (stem.length === 0) {
    return null;
  }

  // Cap after sanitizing so the limit applies to the name actually used, then
  // re-trim because the cut can expose a trailing space or dot.
  const capped = collapse(stem.slice(0, MAX_FILENAME_STEM_LENGTH));
  if (capped.length === 0 || isWindowsReservedName(capped)) {
    return null;
  }
  return capped;
}

/**
 * Join vault path segments with `/`, dropping empty segments. Segments are
 * normalized but not validated; pair this with `isSafeVaultNotePath` when the
 * result becomes a write target.
 */
export function joinVaultPath(...segments: readonly string[]): string {
  return segments
    .map((segment) => normalizeVaultPath(segment))
    .filter((segment) => segment.length > 0)
    .join('/');
}

/** The folder containing a vault path, or `''` when it sits at the root. */
export function vaultParentFolder(path: string): string {
  const normalized = normalizeVaultPath(path);
  const separator = normalized.lastIndexOf('/');
  return separator === -1 ? '' : normalized.slice(0, separator);
}

function collapse(value: string): string {
  return value
    .replace(/\s+/gu, ' ')
    .replace(SURROUNDING_DOTS_AND_SPACES, '')
    .trim();
}

function isWindowsReservedName(stem: string): boolean {
  const [deviceName = ''] = stem.split('.');
  return WINDOWS_RESERVED_NAMES.has(deviceName.toUpperCase());
}
