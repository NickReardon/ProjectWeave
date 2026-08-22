import { TFile, normalizePath } from 'obsidian';
import type { MetadataCache, Vault } from 'obsidian';

import type { SourceNote } from '../../domain/model';
import type {
  LinkResolution,
  LinkResolver,
  VaultReader,
} from '../../ports/vault-reader';
import {
  isPathInProjectRoots,
  normalizeProjectRoots,
} from '../../settings/project-weave-settings';

export class ObsidianVaultReader implements VaultReader {
  readonly #vault: Vault;
  readonly #projectRoots: readonly string[];

  public constructor(vault: Vault, projectRoots: readonly string[]) {
    this.#vault = vault;
    this.#projectRoots = normalizeProjectRoots(projectRoots);
  }

  public includesPath(path: string): boolean {
    return isPathInProjectRoots(path, this.#projectRoots);
  }

  public async listMarkdownNotes(): Promise<readonly SourceNote[]> {
    return Promise.all(
      this.#vault
        .getMarkdownFiles()
        .filter((file) => this.includesPath(file.path))
        .sort((left, right) => left.path.localeCompare(right.path))
        .map(async (file) => this.#readFile(file)),
    );
  }

  public async listMarkdownPaths(): Promise<readonly string[]> {
    return this.#vault
      .getMarkdownFiles()
      .filter((file) => this.includesPath(file.path))
      .map((file) => file.path);
  }

  public async readMarkdownNote(path: string): Promise<SourceNote | null> {
    if (!this.includesPath(path)) {
      return null;
    }
    const candidate = this.#vault.getAbstractFileByPath(normalizePath(path));
    if (!(candidate instanceof TFile) || candidate.extension !== 'md') {
      return null;
    }
    return this.#readFile(candidate);
  }

  async #readFile(file: TFile): Promise<SourceNote> {
    const content = await this.#vault.cachedRead(file);
    return {
      path: file.path,
      content,
      fingerprint: contentFingerprint(file, content),
    };
  }
}

export class ObsidianLinkResolver implements LinkResolver {
  readonly #metadataCache: MetadataCache;

  public constructor(metadataCache: MetadataCache) {
    this.#metadataCache = metadataCache;
  }

  public resolve(linkpath: string, sourcePath: string): LinkResolution {
    const target = this.#metadataCache.getFirstLinkpathDest(
      linkpath,
      sourcePath,
    );
    return target === null
      ? { kind: 'unresolved' }
      : { kind: 'resolved', path: target.path };
  }
}

function contentFingerprint(file: TFile, content: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < content.length; index += 1) {
    hash ^= content.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}:mtime:${String(file.stat.mtime)}:size:${String(file.stat.size)}`;
}
