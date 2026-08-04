import { describe, expect, it } from 'vitest';

import {
  allocateTaskPath,
  allocateTaskRank,
  collectVaultNotePaths,
  RANK_GAP,
} from '../../src/application/task-creation-allocator';
import type {
  ProjectEntity,
  SourceNote,
  TaskEntity,
  TaskStatus,
} from '../../src/domain/model';
import { IndexBuilder } from '../../src/indexing/index-builder';
import {
  PathLinkResolver,
  type VaultReader,
} from '../../src/ports/vault-reader';
import { sourceNote } from '../helpers/source-note';

class MemoryVault implements VaultReader {
  readonly #notes: ReadonlyMap<string, SourceNote>;

  public constructor(notes: readonly SourceNote[]) {
    this.#notes = new Map(notes.map((note) => [note.path, note]));
  }

  public async listMarkdownNotes(): Promise<readonly SourceNote[]> {
    return [...this.#notes.values()];
  }

  public async readMarkdownNote(path: string): Promise<SourceNote | null> {
    return this.#notes.get(path) ?? null;
  }
}

/** Build a real project entity through the indexer rather than a hand-made stub. */
function projectAt(path = 'Projects/Game/Project.md'): ProjectEntity {
  const notes = [sourceNote(path, 'type: project\ntitle: Fixture Game')];
  const snapshot = new IndexBuilder().build(notes, {
    revision: 7,
    resolver: new PathLinkResolver(notes.map((note) => note.path)),
  });
  const entity = snapshot.getEntity(path);
  if (entity?.kind !== 'project') {
    throw new Error(`fixture did not index as a project: ${path}`);
  }
  return entity;
}

function occupied(...paths: readonly string[]): ReadonlySet<string> {
  return new Set(paths.map((path) => path.toLowerCase()));
}

function rankedTask(rank: number | null, status: TaskStatus = 'backlog') {
  return { rank, status } as unknown as TaskEntity;
}

describe('allocateTaskPath', () => {
  it('derives the task folder from the folder holding the project note', () => {
    const result = allocateTaskPath({
      project: projectAt(),
      title: 'Implement request',
      occupiedPaths: occupied(),
    });

    expect(result).toEqual({
      ok: true,
      targetPath: 'Projects/Game/Tasks/Implement request.md',
      taskFolder: 'Projects/Game/Tasks',
      attempt: 1,
    });
  });

  it('places tasks at the vault root when the project note lives there', () => {
    const result = allocateTaskPath({
      project: projectAt('Project.md'),
      title: 'Implement request',
      occupiedPaths: occupied(),
    });

    expect(result).toMatchObject({
      ok: true,
      targetPath: 'Tasks/Implement request.md',
      taskFolder: 'Tasks',
    });
  });

  it('files a task under a requested subfolder', () => {
    const result = allocateTaskPath({
      project: projectAt(),
      title: 'Dodge roll',
      subfolder: 'Combat/Movement',
      occupiedPaths: occupied(),
    });

    expect(result).toMatchObject({
      ok: true,
      targetPath: 'Projects/Game/Tasks/Combat/Movement/Dodge roll.md',
      taskFolder: 'Projects/Game/Tasks/Combat/Movement',
    });
  });

  it.each([
    ['traversal', '../../Elsewhere'],
    ['a parent segment', 'Combat/../../..'],
    ['an absolute path', '/Combat'],
    ['a drive letter', 'C:/Combat'],
    ['a bare dot', '.'],
    ['an empty segment', 'Combat//Movement'],
    ['a blank segment', 'Combat/   /Movement'],
  ])('rejects a subfolder using %s', (_label, subfolder) => {
    const result = allocateTaskPath({
      project: projectAt(),
      title: 'Dodge roll',
      subfolder,
      occupiedPaths: occupied(),
    });

    expect(result.ok).toBe(false);
    expect(
      result.ok ? [] : result.diagnostics.map((issue) => issue.code),
    ).toEqual(['allocation.subfolder.invalid']);
  });

  it('treats a blank subfolder as no subfolder', () => {
    // An untouched form field should file the task at the task root rather
    // than failing the whole allocation.
    const result = allocateTaskPath({
      project: projectAt(),
      title: 'Dodge roll',
      subfolder: '   ',
      occupiedPaths: occupied(),
    });

    expect(result).toMatchObject({
      ok: true,
      targetPath: 'Projects/Game/Tasks/Dodge roll.md',
      taskFolder: 'Projects/Game/Tasks',
    });
  });

  it('sanitizes the title into the filename', () => {
    const result = allocateTaskPath({
      project: projectAt(),
      title: 'Fix: crash in A/B [urgent]',
      occupiedPaths: occupied(),
    });

    expect(result).toMatchObject({
      targetPath: 'Projects/Game/Tasks/Fix crash in A B urgent.md',
    });
  });

  it('reports a title that yields no usable filename', () => {
    const result = allocateTaskPath({
      project: projectAt(),
      title: '///',
      occupiedPaths: occupied(),
    });

    expect(result.ok).toBe(false);
    expect(
      result.ok ? [] : result.diagnostics.map((issue) => issue.code),
    ).toEqual(['allocation.title.unusable']);
  });

  it('suggests the first free suffix when the derived name is taken', () => {
    const result = allocateTaskPath({
      project: projectAt(),
      title: 'Implement request',
      occupiedPaths: occupied(
        'Projects/Game/Tasks/Implement request.md',
        'Projects/Game/Tasks/Implement request 2.md',
      ),
    });

    expect(result).toMatchObject({
      ok: true,
      targetPath: 'Projects/Game/Tasks/Implement request 3.md',
      attempt: 3,
    });
  });

  it('detects collisions case-insensitively', () => {
    // macOS and Windows treat these as the same file, so a case-sensitive
    // check would propose a path that silently overwrites on commit.
    const result = allocateTaskPath({
      project: projectAt(),
      title: 'Implement Request',
      occupiedPaths: occupied('projects/game/tasks/implement request.md'),
    });

    expect(result).toMatchObject({
      targetPath: 'Projects/Game/Tasks/Implement Request 2.md',
    });
  });

  it('gives up rather than suffixing without bound', () => {
    const taken = ['Projects/Game/Tasks/Busy.md'];
    for (let attempt = 2; attempt <= 100; attempt += 1) {
      taken.push(`Projects/Game/Tasks/Busy ${attempt}.md`);
    }

    const result = allocateTaskPath({
      project: projectAt(),
      title: 'Busy',
      occupiedPaths: occupied(...taken),
    });

    expect(result.ok).toBe(false);
    expect(
      result.ok ? [] : result.diagnostics.map((issue) => issue.code),
    ).toEqual(['allocation.target.exhausted']);
  });

  it('is deterministic for identical requests', () => {
    const request = {
      project: projectAt(),
      title: 'Implement request',
      subfolder: 'Combat',
      occupiedPaths: occupied(
        'Projects/Game/Tasks/Combat/Implement request.md',
      ),
    };

    expect(allocateTaskPath(request)).toEqual(allocateTaskPath(request));
  });
});

describe('allocateTaskRank', () => {
  it('starts an unranked project at one gap', () => {
    expect(allocateTaskRank([])).toEqual({ ok: true, rank: RANK_GAP });
    expect(allocateTaskRank([rankedTask(null)])).toEqual({
      ok: true,
      rank: RANK_GAP,
    });
  });

  it('allocates one gap past the largest existing rank', () => {
    expect(
      allocateTaskRank([rankedTask(1000), rankedTask(3000), rankedTask(2000)]),
    ).toEqual({ ok: true, rank: 4000 });
  });

  it('spans every status, not only backlog tasks', () => {
    // A rank survives assignment elsewhere, so ignoring non-backlog tasks
    // would reissue a rank the project is still using.
    expect(
      allocateTaskRank([
        rankedTask(1000, 'backlog'),
        rankedTask(9000, 'done'),
        rankedTask(5000, 'in-progress'),
      ]),
    ).toEqual({ ok: true, rank: 10_000 });
  });

  it('ignores unranked tasks between ranked ones', () => {
    expect(
      allocateTaskRank([rankedTask(2000), rankedTask(null), rankedTask(1000)]),
    ).toEqual({ ok: true, rank: 3000 });
  });

  it('produces a positive integer the task parser would accept back', () => {
    const result = allocateTaskRank([rankedTask(7)]);
    expect(result.ok).toBe(true);
    const rank = result.ok ? result.rank : 0;
    expect(Number.isInteger(rank)).toBe(true);
    expect(rank).toBeGreaterThan(0);
    expect(Number.isSafeInteger(rank)).toBe(true);
  });

  it('reports exhaustion instead of leaving the safe integer range', () => {
    const result = allocateTaskRank([rankedTask(Number.MAX_SAFE_INTEGER)]);

    expect(result.ok).toBe(false);
    expect(
      result.ok ? [] : result.diagnostics.map((issue) => issue.code),
    ).toEqual(['allocation.rank.exhausted']);
  });
});

describe('collectVaultNotePaths', () => {
  it('lowercases every indexed path so collisions compare case-insensitively', async () => {
    const vault = new MemoryVault([
      sourceNote('Projects/Game/Project.md', 'type: project'),
      sourceNote('Projects/Game/Tasks/Implement Request.md', 'type: task'),
    ]);

    await expect(collectVaultNotePaths(vault)).resolves.toEqual(
      new Set([
        'projects/game/project.md',
        'projects/game/tasks/implement request.md',
      ]),
    );
  });

  it('feeds allocation so a differently-cased note still counts as taken', async () => {
    const vault = new MemoryVault([
      sourceNote('Projects/Game/Project.md', 'type: project'),
      sourceNote('Projects/Game/Tasks/IMPLEMENT REQUEST.md', 'type: task'),
    ]);

    const result = allocateTaskPath({
      project: projectAt(),
      title: 'Implement request',
      occupiedPaths: await collectVaultNotePaths(vault),
    });

    expect(result).toMatchObject({
      targetPath: 'Projects/Game/Tasks/Implement request 2.md',
    });
  });
});
