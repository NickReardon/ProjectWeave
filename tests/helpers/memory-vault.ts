import type { SourceNote } from '../../src/domain/model';
import type { VaultReader } from '../../src/ports/vault-reader';

/** An in-memory `VaultReader` over a fixed set of notes. */
export class MemoryVault implements VaultReader {
  readonly #notes: Map<string, SourceNote>;

  public constructor(notes: readonly SourceNote[]) {
    this.#notes = new Map(notes.map((note) => [note.path, note]));
  }

  public async listMarkdownNotes(): Promise<readonly SourceNote[]> {
    return [...this.#notes.values()];
  }

  public async listMarkdownPaths(): Promise<readonly string[]> {
    return [...this.#notes.keys()];
  }

  public async readMarkdownNote(path: string): Promise<SourceNote | null> {
    return this.#notes.get(path) ?? null;
  }
}
