import type { SourceNote } from '../domain/model';
import type { VaultReader } from './vault-reader';

/**
 * One reader over several scoped readers, tried in order.
 *
 * ADR 0013 keeps the index reader scoped to the configured project roots, so
 * the promise that unrelated vault notes are never indexed or diagnosed stays
 * true, while creation still has to re-read a template that lives outside them.
 * This composes the two rather than widening either: it can reach only what its
 * members already expose, and it remains read-only.
 */
export class CompositeVaultReader implements VaultReader {
  readonly #readers: readonly VaultReader[];

  public constructor(readers: readonly VaultReader[]) {
    this.#readers = readers;
  }

  public async listMarkdownNotes(): Promise<readonly SourceNote[]> {
    const seen = new Map<string, SourceNote>();
    for (const reader of this.#readers) {
      for (const note of await reader.listMarkdownNotes()) {
        // First reader wins, matching readMarkdownNote's order.
        if (!seen.has(note.path)) {
          seen.set(note.path, note);
        }
      }
    }
    return [...seen.values()].sort((left, right) =>
      left.path.localeCompare(right.path),
    );
  }

  public async listMarkdownPaths(): Promise<readonly string[]> {
    const seen = new Set<string>();
    for (const reader of this.#readers) {
      for (const path of await reader.listMarkdownPaths()) {
        seen.add(path);
      }
    }
    return [...seen].sort((left, right) => left.localeCompare(right));
  }

  public async readMarkdownNote(path: string): Promise<SourceNote | null> {
    for (const reader of this.#readers) {
      const note = await reader.readMarkdownNote(path);
      if (note !== null) {
        return note;
      }
    }
    return null;
  }
}
