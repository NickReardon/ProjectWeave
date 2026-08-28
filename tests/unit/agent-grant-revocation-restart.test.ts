// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';

import ProjectWeavePlugin from '../../src/main';
import { ReadOnlyAgentGateway } from '../../src/application/read-only-agent-gateway';
import { ProjectWeaveQueryApi } from '../../src/application/query-api';
import { IndexBuilder } from '../../src/indexing/index-builder';
import { installObsidianDom } from '../helpers/obsidian-dom';
import {
  clearNotices,
  createStubApp,
  recordedNotices,
} from '../helpers/obsidian-stub';
import { sourceNote } from '../helpers/source-note';

installObsidianDom();

const STORED_GRANT = {
  id: 'game-agent',
  label: 'Game repository',
  vaultId: 'vault-1',
  projectPath: 'Projects/Game/Project.md',
  contentRoots: ['Projects/Game/Documents'],
  secretDigest: 'a'.repeat(64),
  enabled: true,
};

/**
 * `data.json` as a stale save would leave it: the revoked grant restored, and
 * alongside it the id that withdrew it.
 */
function storedSettings(): Record<string, unknown> {
  return {
    settingsVersion: 2,
    projectRoots: ['Projects'],
    templateScaffoldFolder: '',
    diagnosticsLogFolder: '',
    taskCategories: [],
    agentGatewayEnabled: false,
    agentVaultId: 'vault-1',
    agentGrants: [STORED_GRANT],
    revokedAgentGrantIds: [STORED_GRANT.id],
  };
}

describe('a revocation record that cannot be read', () => {
  it('serves no grant, keeps the gateway off, and says so', async () => {
    // The record says which credentials were withdrawn, so a value that cannot
    // be parsed is not evidence that none were. Reading it as an empty list
    // would hand back every grant the damaged file still names, and a cold
    // load is where that happens — there is nothing in memory to contradict it.
    clearNotices();
    const plugin = new ProjectWeavePlugin(
      createStubApp() as never,
      {
        version: '0.7.0-beta.1',
      } as never,
    );
    plugin.loadData = async () => ({
      ...storedSettings(),
      agentGatewayEnabled: true,
      revokedAgentGrantIds: 'not-a-list',
    });

    await plugin.onload();
    plugin.onunload();

    expect(plugin.settings.agentGrants).toEqual([]);
    expect(plugin.settings.agentGatewayEnabled).toBe(false);
    // Failing closed is otherwise indistinguishable from a broken gateway.
    expect(
      recordedNotices.some((notice) => notice.includes('revokedAgentGrantIds')),
    ).toBe(true);
  });

  it('does not overwrite the damaged record while loading', async () => {
    // A corrupt record with no usable identity used to trigger the normal
    // first-load identity write. That replaced the very record the notice asks
    // the user to repair, along with anything else stored beside it.
    const plugin = new ProjectWeavePlugin(
      createStubApp() as never,
      {
        version: '0.7.0-beta.1',
      } as never,
    );
    const saved: unknown[] = [];
    plugin.loadData = async () => ({
      ...storedSettings(),
      agentVaultId: '',
      revokedAgentGrantIds: 'not-a-list',
    });
    plugin.saveData = async (data: unknown) => {
      saved.push(data);
    };

    await plugin.onload();
    plugin.onunload();

    expect(plugin.settings.agentVaultId).toBe('');
    expect(saved).toEqual([]);
  });
});

describe('a revoked grant across a restart', () => {
  it('is not authorized by the instance that loads the file fresh', async () => {
    // Adoption merges a synced file against settings already in memory. A
    // restart has no memory to merge against, so the record and the entry it
    // withdraws arrive together and only the load path can separate them.
    // Without that, closing and reopening the vault restores the credential.
    const plugin = new ProjectWeavePlugin(
      createStubApp() as never,
      {
        version: '0.7.0-beta.1',
      } as never,
    );
    plugin.loadData = async () => storedSettings();
    const gateway = new ReadOnlyAgentGateway({
      enabled: () => true,
      vaultId: () => plugin.settings.agentVaultId,
      grants: () => plugin.settings.agentGrants,
      pluginVersion: () => '0.7.0-beta.1',
      queryApi: () =>
        new ProjectWeaveQueryApi(() =>
          new IndexBuilder().build(
            [sourceNote('Projects/Game/Project.md', 'type: project')],
            { revision: 1 },
          ),
        ),
      digestSecret: async (secret) => `digest:${secret}`,
    });

    await plugin.onload();

    try {
      const answer = await gateway.handle({
        requestId: 'r1',
        companionVersion: '0.7.0-beta.1',
        grantId: STORED_GRANT.id,
        secret: 'correct',
        operation: 'projects_list',
      });

      expect(plugin.settings.agentGrants).toEqual([]);
      expect(plugin.settings.revokedAgentGrantIds).toEqual([STORED_GRANT.id]);
      expect(answer.ok).toBe(false);
    } finally {
      plugin.onunload();
    }
  });
});
