import { describe, expect, it } from 'vitest';

import {
  classifyScopeTransition,
  createDefaultProjectWeaveSettings,
  isAdoptableSettingsPayload,
  isPathInProjectRoots,
  loadProjectWeaveSettings,
  mergeRevokedGrantIds,
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
      revokedAgentGrantIds: [],
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
      revokedAgentGrantIds: [],
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

  it('keeps revoked grant ids through a load, normalized the way grants are', () => {
    // A tombstone has to compare equal to the id of the grant it withdraws, so
    // it goes through the same identifier rule rather than being stored raw.
    const loaded = loadProjectWeaveSettings({
      settingsVersion: 2,
      agentVaultId: 'vault-1',
      agentGrants: [],
      revokedAgentGrantIds: [' Grant One ', 'grant-one', 'grant two'],
    });
    expect(loaded.revokedAgentGrantIds).toEqual(['grant-one', 'grant-two']);
  });

  it.each([
    ['not a list', 'grant-one'],
    ['a list holding something that is not an id', ['grant-one', 7]],
    ['a list holding an empty id', ['grant-one', '']],
    ['null', null],
  ])(
    'serves nothing when the revocation record is %s',
    (_label, revokedAgentGrantIds) => {
      // The record says which credentials were withdrawn. A value that cannot
      // be parsed is not evidence that none were, so reading it as an empty
      // list would hand back every grant the damaged file still names.
      const digest = 'a'.repeat(64);
      const loaded = loadProjectWeaveSettings({
        settingsVersion: 2,
        projectRoots: ['Projects'],
        agentVaultId: 'vault-1',
        agentGatewayEnabled: true,
        agentGrants: [
          {
            id: 'game-agent',
            label: 'Game',
            vaultId: 'vault-1',
            projectPath: 'Projects/Game/Project.md',
            contentRoots: [],
            secretDigest: digest,
            enabled: true,
          },
        ],
        revokedAgentGrantIds,
      });

      expect(loaded.agentGrants).toEqual([]);
      expect(loaded.agentGatewayEnabled).toBe(false);
      // Everything that is not authorization still loads, so a damaged record
      // does not cost the user their index as well.
      expect(loaded.projectRoots).toEqual(['Projects']);
      expect(loaded.agentVaultId).toBe('vault-1');
    },
  );

  it('refuses to adopt a payload whose revocation record cannot be read', () => {
    // The same rule on the sync path, where the safe answer is to keep serving
    // what this session already reconciled rather than to trust the file.
    expect(
      isAdoptableSettingsPayload({
        settingsVersion: 2,
        agentVaultId: 'vault-1',
        agentGrants: [],
        revokedAgentGrantIds: 'grant-one',
      }),
    ).toBe(false);
    expect(
      isAdoptableSettingsPayload({
        settingsVersion: 2,
        agentVaultId: 'vault-1',
        agentGrants: [],
        revokedAgentGrantIds: ['grant-one'],
      }),
    ).toBe(true);
  });

  it('reads a file written before revocations were recorded as an empty set', () => {
    // The field is added without a version bump, so every file that predates
    // it is still adoptable and simply carries no tombstones.
    expect(
      loadProjectWeaveSettings({
        settingsVersion: 2,
        agentVaultId: 'vault-1',
        agentGrants: [],
      }).revokedAgentGrantIds,
    ).toEqual([]);
  });

  it('drops a grant the same file records as revoked', () => {
    // The restart case. Load has no previous settings to merge a tombstone
    // against, so if the file carrying a restored grant also carries the id
    // that withdrew it, only the loader can tell them apart.
    const digest = 'a'.repeat(64);
    const loaded = loadProjectWeaveSettings({
      settingsVersion: 2,
      agentVaultId: 'vault-1',
      agentGrants: [
        {
          id: 'revoked-agent',
          label: 'Revoked',
          vaultId: 'vault-1',
          projectPath: 'Projects/Game/Project.md',
          contentRoots: [],
          secretDigest: digest,
          enabled: true,
        },
        {
          id: 'live-agent',
          label: 'Live',
          vaultId: 'vault-1',
          projectPath: 'Projects/Game/Project.md',
          contentRoots: [],
          secretDigest: digest,
          enabled: true,
        },
      ],
      revokedAgentGrantIds: ['revoked-agent'],
    });
    expect(loaded.agentGrants.map((grant) => grant.id)).toEqual(['live-agent']);
    expect(loaded.revokedAgentGrantIds).toEqual(['revoked-agent']);
  });

  it('merges revoked ids as a union, never dropping one side', () => {
    // The whole mechanism: adopting a file that omits an id this device holds
    // must not drop it, or a stale save undoes a revocation exactly as before.
    expect(mergeRevokedGrantIds(['grant-a'], ['grant-b'])).toEqual([
      'grant-a',
      'grant-b',
    ]);
    expect(mergeRevokedGrantIds(['grant-a'], [])).toEqual(['grant-a']);
    expect(mergeRevokedGrantIds([], ['grant-a'])).toEqual(['grant-a']);
    expect(mergeRevokedGrantIds(['grant-a'], ['grant-a'])).toEqual(['grant-a']);
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
