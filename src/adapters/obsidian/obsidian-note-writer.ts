import { TFolder, normalizePath } from 'obsidian';
import type { Vault } from 'obsidian';

import { isSafeVaultNotePath } from '../../domain/vault-path';
import type { NoteCreateOutcome, NoteWriter } from '../../ports/note-writer';
import {
  isPathInProjectRoots,
  normalizeProjectRoots,
} from '../../settings/project-weave-settings';

/**
 * Creates notes through Obsidian's Vault API, never the filesystem directly.
 *
 * Three guards stand between a caller and the vault, in order: the path must
 * be a safe normalized Markdown path, it must sit inside the configured
 * project roots, and it must not already exist. `Vault.create` rejects an
 * existing path, so the last guard is enforced by Obsidian itself rather than
 * only by our check — this adapter has no code path that overwrites.
 */
export class ObsidianNoteWriter implements NoteWriter {
  readonly #vault: Vault;
  #projectRoots: readonly string[];

  public constructor(vault: Vault, projectRoots: readonly string[]) {
    this.#vault = vault;
    this.#projectRoots = normalizeProjectRoots(projectRoots);
  }

  public async createNote(
    path: string,
    content: string,
  ): Promise<NoteCreateOutcome> {
    if (
      !isSafeVaultNotePath(path) ||
      !isPathInProjectRoots(path, this.#projectRoots)
    ) {
      return { kind: 'out_of_scope' };
    }
    const normalized = normalizePath(path);
    if (this.#vault.getAbstractFileByPath(normalized) !== null) {
      return { kind: 'exists' };
    }

    try {
      await this.#ensureParentFolder(normalized);
      await this.#vault.create(normalized, content);
      return { kind: 'created' };
    } catch (error) {
      // Obsidian throws when a path already exists, which a concurrent write
      // can produce between the check above and the create below.
      if (this.#vault.getAbstractFileByPath(normalized) !== null) {
        return { kind: 'exists' };
      }
      return { kind: 'failed', message: errorMessage(error) };
    }
  }

  /**
   * Create missing ancestor folders. Design 12 permits this only as part of a
   * confirmed creation that needs them, which is the only way this runs.
   */
  async #ensureParentFolder(notePath: string): Promise<void> {
    const separator = notePath.lastIndexOf('/');
    if (separator === -1) {
      return;
    }
    const segments = notePath.slice(0, separator).split('/');
    let current = '';
    for (const segment of segments) {
      current = current.length === 0 ? segment : current + '/' + segment;
      const existing = this.#vault.getAbstractFileByPath(current);
      if (existing instanceof TFolder) {
        continue;
      }
      if (existing !== null) {
        throw new Error(`A note already occupies the folder path ${current}.`);
      }
      await this.#vault.createFolder(current);
    }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
