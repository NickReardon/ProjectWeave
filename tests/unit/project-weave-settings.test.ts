import { describe, expect, it } from 'vitest';

import {
  classifyScopeTransition,
  createDefaultProjectWeaveSettings,
  isPathInProjectRoots,
  loadProjectWeaveSettings,
  normalizeOptionalVaultFolderPath,
  normalizeAgentGrants,
  normalizeProjectRoots,
  normalizeTaskCategories,
  normalizeVaultFolderPath,
} from '../../src/settings/project-weave-settings';

describe('Project Weave settings', () => {
  it('defaults indexing to the Projects folder', () => {
    expect(createDefaultProjectWeaveSettings()).toEqual({
      settingsVersion: 2,
      projectRoots: ['Projects'],
      templateScaffoldFolder: 'Templates/Project Weave',
      diagnosticsLogFolder: '',
      taskCategories: [],
      agentGatewayEnabled: false,
      agentVaultId: '',
      agentGrants: [],
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

  it('loads a diagnostics log folder and fails closed for an invalid one', () => {
    expect(
      loadProjectWeaveSettings({
        settingsVersion: 1,
        diagnosticsLogFolder: ' Logs/Project Weave/ ',
      }).diagnosticsLogFolder,
    ).toBe('Logs/Project Weave');
    expect(
      loadProjectWeaveSettings({
        settingsVersion: 1,
        diagnosticsLogFolder: '../outside',
      }).diagnosticsLogFolder,
    ).toBe('');
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
      settingsVersion: 2,
      projectRoots: [],
      templateScaffoldFolder: 'Templates',
      diagnosticsLogFolder: '',
      taskCategories: [],
      agentGatewayEnabled: false,
      agentVaultId: '',
      agentGrants: [],
    });
    expect(
      loadProjectWeaveSettings({
        settingsVersion: 3,
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

describe('agent gateway settings', () => {
  it('migrates v1 settings with the gateway disabled', () => {
    const loaded = loadProjectWeaveSettings({
      settingsVersion: 1,
      projectRoots: ['Projects/Game'],
    });
    expect(loaded).toMatchObject({
      settingsVersion: 2,
      projectRoots: ['Projects/Game'],
      agentGatewayEnabled: false,
      agentVaultId: '',
      agentGrants: [],
    });
  });

  it('normalizes valid local grants and drops malformed or duplicate entries', () => {
    const digest = 'a'.repeat(64);
    expect(
      normalizeAgentGrants([
        {
          id: ' Game Agent ',
          label: 'Game repository',
          vaultId: ' Vault One ',
          projectPath: 'Projects/Game/Project.md',
          contentRoots: ['Projects/Game/Documents/'],
          secretDigest: digest.toUpperCase(),
          enabled: true,
        },
        {
          id: 'game-agent',
          vaultId: 'vault-one',
          projectPath: 'Projects/Other/Project.md',
          secretDigest: digest,
        },
        { id: 'broken' },
      ]),
    ).toEqual([
      {
        id: 'game-agent',
        label: 'Game repository',
        vaultId: 'vault-one',
        projectPath: 'Projects/Game/Project.md',
        contentRoots: ['Projects/Game/Documents'],
        secretDigest: digest,
        enabled: true,
      },
    ]);
  });
});

describe('task categories', () => {
  it('trims, drops empties, and de-duplicates case-insensitively', () => {
    expect(
      normalizeTaskCategories([
        '  bug ',
        'chore',
        'BUG',
        '',
        '   ',
        42,
        'spike',
      ]),
    ).toEqual(['bug', 'chore', 'spike']);
  });

  it('keeps the first spelling the user chose', () => {
    expect(normalizeTaskCategories(['Bug', 'bug'])).toEqual(['Bug']);
  });

  it('reads a persisted list and defaults to none', () => {
    expect(
      loadProjectWeaveSettings({ settingsVersion: 1, taskCategories: ['bug'] })
        .taskCategories,
    ).toEqual(['bug']);
    expect(
      loadProjectWeaveSettings({ settingsVersion: 1 }).taskCategories,
    ).toEqual([]);
  });
});
