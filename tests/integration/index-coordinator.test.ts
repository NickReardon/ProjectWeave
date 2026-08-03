import { describe, expect, it } from 'vitest';

import { IndexCoordinator } from '../../src/indexing/index-coordinator';
import type { SourceNote } from '../../src/domain/model';
import type { VaultReader } from '../../src/ports/vault-reader';
import { sourceNote } from '../helpers/source-note';

describe('IndexCoordinator', () => {
  it('performs lifecycle indexing through a read-only port without changing content', async () => {
    const reader = new MemoryVaultReader([
      sourceNote('Projects/Game.md', 'type: project'),
      sourceNote(
        'Tasks/Ready.md',
        ['type: task', 'project: "[[Projects/Game]]"', 'status: todo'].join(
          '\n',
        ),
      ),
    ]);
    const before = reader.contentSnapshot();
    const coordinator = new IndexCoordinator(reader, {
      debounceMilliseconds: 1,
    });

    await coordinator.rebuild();
    coordinator.dispose();

    expect(reader.contentSnapshot()).toEqual(before);
    expect(reader.listCalls).toBe(1);
    expect(coordinator.snapshot.revision).toBe(1);
  });

  it('reads only changed notes and coalesces duplicate events', async () => {
    const reader = new MemoryVaultReader([
      sourceNote('Projects/Game.md', 'type: project'),
      sourceNote(
        'Tasks/Prerequisite.md',
        [
          'type: task',
          'project: "[[Projects/Game]]"',
          'status: in-progress',
        ].join('\n'),
      ),
      sourceNote(
        'Tasks/Dependent.md',
        [
          'type: task',
          'project: "[[Projects/Game]]"',
          'status: todo',
          'depends_on: "[[Tasks/Prerequisite]]"',
        ].join('\n'),
      ),
    ]);
    const coordinator = new IndexCoordinator(reader, {
      debounceMilliseconds: 60_000,
    });
    await coordinator.rebuild();
    expect(coordinator.snapshot.getReadiness('Tasks/Dependent.md')?.ready).toBe(
      false,
    );

    reader.set(
      sourceNote(
        'Tasks/Prerequisite.md',
        [
          'type: task',
          'project: "[[Projects/Game]]"',
          'status: done',
          'completed_at: 2026-08-02T12:00:00-07:00',
        ].join('\n'),
      ),
    );
    coordinator.queueUpsert('Tasks/Prerequisite.md');
    coordinator.queueUpsert('Tasks/Prerequisite.md');
    await coordinator.flushPending();

    expect(reader.listCalls).toBe(1);
    expect(reader.readPaths).toEqual(['Tasks/Prerequisite.md']);
    expect(coordinator.snapshot.revision).toBe(2);
    expect(coordinator.snapshot.getReadiness('Tasks/Dependent.md')?.ready).toBe(
      true,
    );
    coordinator.dispose();
  });
});

class MemoryVaultReader implements VaultReader {
  readonly #notes = new Map<string, SourceNote>();
  public listCalls = 0;
  public readonly readPaths: string[] = [];

  public constructor(notes: readonly SourceNote[]) {
    for (const note of notes) {
      this.#notes.set(note.path, note);
    }
  }

  public async listMarkdownNotes(): Promise<readonly SourceNote[]> {
    this.listCalls += 1;
    return [...this.#notes.values()].map((note) => ({ ...note }));
  }

  public async readMarkdownNote(path: string): Promise<SourceNote | null> {
    this.readPaths.push(path);
    const note = this.#notes.get(path);
    return note === undefined ? null : { ...note };
  }

  public set(note: SourceNote): void {
    this.#notes.set(note.path, note);
  }

  public contentSnapshot(): readonly (readonly [string, string])[] {
    return [...this.#notes.values()]
      .map((note) => [note.path, note.content] as const)
      .sort(([left], [right]) => left.localeCompare(right));
  }
}
