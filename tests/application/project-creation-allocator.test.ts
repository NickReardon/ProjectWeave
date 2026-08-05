import { describe, expect, it } from 'vitest';

import {
  allocateProjectPath,
  collectVaultFolders,
  PROJECT_NOTE_NAME,
} from '../../src/application/project-creation-allocator';

/**
 * Project allocation differs from task allocation in what collides: a project
 * owns its folder, so an occupied folder is a collision even when no project
 * note sits in it.
 */

function allocate(
  title: string,
  options: {
    readonly root?: string;
    readonly paths?: readonly string[];
  } = {},
) {
  const paths = options.paths ?? [];
  return allocateProjectPath({
    root: options.root ?? 'Projects',
    title,
    occupiedPaths: new Set(paths.map((path) => path.toLowerCase())),
    occupiedFolders: collectVaultFolders(paths),
  });
}

describe('allocateProjectPath', () => {
  it('puts the project note in a folder named for its title', () => {
    const result = allocate('Travel Planner');

    expect(result).toEqual({
      ok: true,
      targetPath: 'Projects/Travel Planner/Project.md',
      projectFolder: 'Projects/Travel Planner',
      attempt: 1,
    });
    expect(result.ok && result.targetPath.endsWith(PROJECT_NOTE_NAME)).toBe(
      true,
    );
  });

  it('suffixes the folder when one of that name is already occupied', () => {
    // Only a task note exists under the folder — no project note at all — and
    // that is still a collision, because ADR 0008 would file the new project's
    // tasks in the same place.
    const result = allocate('Game', {
      paths: ['Projects/Game/Tasks/Implement request.md'],
    });

    expect(result).toEqual({
      ok: true,
      targetPath: 'Projects/Game 2/Project.md',
      projectFolder: 'Projects/Game 2',
      attempt: 2,
    });
  });

  it('keeps suffixing past a suffixed folder that is also taken', () => {
    const result = allocate('Game', {
      paths: ['Projects/Game/Project.md', 'Projects/Game 2/Project.md'],
    });

    expect(result.ok && result.projectFolder).toBe('Projects/Game 3');
  });

  it('treats a differently cased folder as the same folder', () => {
    const result = allocate('Game', { paths: ['Projects/GAME/Project.md'] });

    expect(result.ok && result.projectFolder).toBe('Projects/Game 2');
  });

  it('nests under a multi-segment project root', () => {
    const result = allocate('Travel Planner', { root: 'Work/Projects' });

    expect(result.ok && result.targetPath).toBe(
      'Work/Projects/Travel Planner/Project.md',
    );
  });

  it('refuses a title that cannot become a folder name', () => {
    const result = allocate('///');

    expect(result.ok).toBe(false);
    expect(!result.ok && result.diagnostics[0]?.code).toBe(
      'allocation.title.unusable',
    );
  });

  it('refuses a root that could not name a folder inside the vault', () => {
    for (const root of ['', '  ', '/Projects', 'C:/Projects', '../Projects']) {
      const result = allocate('Travel Planner', { root });
      expect(!result.ok && result.diagnostics[0]?.code).toBe(
        'allocation.project_root.invalid',
      );
    }
  });

  it('gives up rather than suffixing forever', () => {
    const paths = ['Projects/Game/Project.md'];
    for (let attempt = 2; attempt <= 100; attempt += 1) {
      paths.push(`Projects/Game ${String(attempt)}/Project.md`);
    }

    const result = allocate('Game', { paths });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.diagnostics[0]?.code).toBe(
      'allocation.target.exhausted',
    );
  });
});

describe('collectVaultFolders', () => {
  it('derives every ancestor folder of a note, lowercased', () => {
    expect([
      ...collectVaultFolders(['Projects/Game/Tasks/Implement request.md']),
    ]).toEqual(['projects', 'projects/game', 'projects/game/tasks']);
  });

  it('claims no folder for a note at the vault root', () => {
    expect([...collectVaultFolders(['Inbox.md'])]).toEqual([]);
  });
});
