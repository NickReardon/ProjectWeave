import { normalizeVaultPath } from '../domain/markdown-parser';
import type { SourceNote } from '../domain/model';

export interface VaultReader {
  listMarkdownNotes(): Promise<readonly SourceNote[]>;
  /**
   * Paths only, without reading or fingerprinting content. Path allocation
   * needs to know which paths are taken, and paying a full-vault content read
   * for that is prohibitive on every keystroke of a live preview.
   */
  listMarkdownPaths(): Promise<readonly string[]>;
  readMarkdownNote(path: string): Promise<SourceNote | null>;
}

export type LinkResolution =
  | { readonly kind: 'resolved'; readonly path: string }
  | { readonly kind: 'ambiguous'; readonly candidates: readonly string[] }
  | { readonly kind: 'unresolved' };

export interface LinkResolver {
  resolve(linkpath: string, sourcePath: string): LinkResolution;
}

export class PathLinkResolver implements LinkResolver {
  readonly #paths: readonly string[];

  public constructor(paths: Iterable<string>) {
    this.#paths = [...paths].map(normalizeVaultPath).sort(comparePath);
  }

  public resolve(linkpath: string, sourcePath: string): LinkResolution {
    const normalizedLink = stripMarkdownExtension(normalizeVaultPath(linkpath));
    if (normalizedLink.length === 0) {
      return { kind: 'unresolved' };
    }

    const sourceFolder = directoryName(normalizeVaultPath(sourcePath));
    const rooted = addMarkdownExtension(normalizedLink);
    const relative = addMarkdownExtension(
      sourceFolder.length === 0
        ? normalizedLink
        : `${sourceFolder}/${normalizedLink}`,
    );
    const exact = unique(
      this.#paths.filter(
        (candidate) =>
          samePath(candidate, rooted) || samePath(candidate, relative),
      ),
    );

    if (exact.length === 1) {
      return { kind: 'resolved', path: exact[0] as string };
    }
    if (exact.length > 1) {
      return { kind: 'ambiguous', candidates: exact };
    }

    const targetName = fileName(rooted);
    const byName = unique(
      this.#paths.filter((candidate) =>
        samePath(fileName(candidate), targetName),
      ),
    );
    if (byName.length === 1) {
      return { kind: 'resolved', path: byName[0] as string };
    }
    if (byName.length > 1) {
      return { kind: 'ambiguous', candidates: byName };
    }

    return { kind: 'unresolved' };
  }
}

function stripMarkdownExtension(path: string): string {
  return path.toLowerCase().endsWith('.md') ? path.slice(0, -3) : path;
}

function addMarkdownExtension(path: string): string {
  return path.toLowerCase().endsWith('.md') ? path : `${path}.md`;
}

function directoryName(path: string): string {
  const separator = path.lastIndexOf('/');
  return separator < 0 ? '' : path.slice(0, separator);
}

function fileName(path: string): string {
  return path.split('/').at(-1) ?? path;
}

function samePath(left: string, right: string): boolean {
  return left.localeCompare(right, undefined, { sensitivity: 'accent' }) === 0;
}

function comparePath(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: 'accent' });
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort(comparePath);
}
