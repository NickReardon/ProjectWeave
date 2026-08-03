import { describe, expect, it } from 'vitest';

import {
  classifyScopeTransition,
  createDefaultProjectWeaveSettings,
  isPathInProjectRoots,
  loadProjectWeaveSettings,
  normalizeOptionalVaultFolderPath,
  normalizeProjectRoots,
  normalizeVaultFolderPath,
} from '../../src/settings/project-weave-settings';

describe('Project Weave settings', () => {
  it('defaults indexing to the Projects folder', () => {
    expect(createDefaultProjectWeaveSettings()).toEqual({
      settingsVersion: 1,
      projectRoots: ['Projects'],
      templateScaffoldFolder: 'Templates/Project Weave',
    });
    expect(loadProjectWeaveSettings(null)).toEqual(
      createDefaultProjectWeaveSettings(),
    );
  });

  it('normalizes, sorts, and deduplicates vault-relative folders', () => {
    expect(
      normalizeProjectRoots([
        ' Projects\\Game\\ ',
        'Projects/Other/',
        'Projects/Game',
      ]),
    ).toEqual(['Projects/Game', 'Projects/Other']);
    expect(normalizeOptionalVaultFolderPath('')).toBe('');
  });

  it('rejects absolute, traversing, and vault-configuration paths', () => {
    for (const path of [
      'D:/Projects/Game',
      '/Projects/Game',
      '../Projects/Game',
      'Projects/../Game',
      '.obsidian/plugins',
    ]) {
      expect(() => normalizeVaultFolderPath(path)).toThrow();
    }
  });

  it('matches path segments without widening an empty scope', () => {
    expect(
      isPathInProjectRoots('Projects/Game/Tasks/Ready.md', ['Projects/Game']),
    ).toBe(true);
    expect(
      isPathInProjectRoots('Projects/Gamekeeper/Task.md', ['Projects/Game']),
    ).toBe(false);
    expect(isPathInProjectRoots('Projects/Game/Project.md', [])).toBe(false);
  });

  it('fails closed for malformed persisted roots or future settings', () => {
    expect(
      loadProjectWeaveSettings({
        settingsVersion: 1,
        projectRoots: ['../Outside', 42],
        templateScaffoldFolder: 'Templates',
      }),
    ).toEqual({
      settingsVersion: 1,
      projectRoots: [],
      templateScaffoldFolder: 'Templates',
    });
    expect(
      loadProjectWeaveSettings({
        settingsVersion: 2,
        projectRoots: ['Projects'],
      }).projectRoots,
    ).toEqual([]);
  });

  it('classifies every scoped rename transition', () => {
    expect(classifyScopeTransition(false, false)).toBe('ignore');
    expect(classifyScopeTransition(false, true)).toBe('upsert');
    expect(classifyScopeTransition(true, false)).toBe('remove');
    expect(classifyScopeTransition(true, true)).toBe('rename');
  });
});
