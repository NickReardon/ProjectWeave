import { describe, expect, it } from 'vitest';

import ProjectWeavePlugin from '../../src/main';
import { ReadOnlyAgentGateway } from '../../src/application/read-only-agent-gateway';
import { ProjectWeaveQueryApi } from '../../src/application/query-api';
import { IndexBuilder } from '../../src/indexing/index-builder';
import { createStubApp } from '../helpers/obsidian-stub';
import { sourceNote } from '../helpers/source-note';

const GRANT = {
  id: 'game-agent',
  label: 'Game repository',
  vaultId: 'vault-1',
  projectPath: 'Projects/Game/Project.md',
  contentRoots: ['Projects/Game/Documents'],
  secretDigest: 'digest:correct',
  enabled: true,
};

/** The shape `data.json` holds, as another device would have rewritten it. */
function storedSettings(grants: readonly unknown[]): Record<string, unknown> {
  return {
    settingsVersion: 2,
    projectRoots: ['Projects'],
    templateScaffoldFolder: '',
    diagnosticsLogFolder: '',
    taskCategories: [],
    agentGatewayEnabled: false,
    agentVaultId: 'vault-1',
    agentGrants: grants,
  };
}

function createPlugin(grants: readonly unknown[]): ProjectWeavePlugin {
  const plugin = new ProjectWeavePlugin(
    createStubApp() as never,
    {
      version: '0.7.0-beta.1',
    } as never,
  );
  plugin.settings = {
    ...plugin.settings,
    agentVaultId: 'vault-1',
    agentGrants: grants as never,
  };
  return plugin;
}

describe('onExternalSettingsChange', () => {
  it('stops a running gateway authorizing a grant revoked on another device', async () => {
    // The gateway serves from the plugin's live settings, exactly as main.ts
    // wires it. Revoking on a phone rewrites that device's data.json; this
    // desktop instance only learns of it through this hook, so deleting the
    // hook leaves the withdrawn credential working until Obsidian restarts.
    const plugin = createPlugin([GRANT]);
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
    const call = async (): Promise<boolean> =>
      (
        await gateway.handle({
          requestId: 'r1',
          companionVersion: '0.7.0-beta.1',
          grantId: 'game-agent',
          secret: 'correct',
          operation: 'projects_list',
        })
      ).ok;

    expect(await call()).toBe(true);

    // Sync rewrites the file with the grant gone, then Obsidian notifies us.
    plugin.loadData = async () => storedSettings([]);
    await plugin.onExternalSettingsChange();

    expect(plugin.settings.agentGrants).toEqual([]);
    expect(await call()).toBe(false);
  });

  it('adopts a revoked grant without tearing down unrelated runtime state', async () => {
    // Only the grant list moved, so nothing else should be reconciled. If the
    // hook rebuilt the runtime on every sync it would reindex the vault each
    // time another device saved any setting at all.
    const plugin = createPlugin([GRANT]);
    plugin.loadData = async () => storedSettings([]);

    await expect(plugin.onExternalSettingsChange()).resolves.toBeUndefined();
    expect(plugin.settings.agentGrants).toEqual([]);
    expect(plugin.settings.projectRoots).toEqual(['Projects']);
  });

  it('serializes overlapping notifications instead of interleaving them', async () => {
    // Obsidian can notify again while the first call is still awaiting the
    // read. Unserialized, both capture the same baseline and both run their
    // side effects; the bridge refresh they share stops one bridge and races
    // to bind the same endpoint twice.
    const plugin = createPlugin([GRANT]);
    let inFlight = 0;
    let overlapped = false;
    plugin.loadData = async () => {
      inFlight += 1;
      if (inFlight > 1) overlapped = true;
      await Promise.resolve();
      inFlight -= 1;
      return storedSettings([]);
    };

    await Promise.all([
      plugin.onExternalSettingsChange(),
      plugin.onExternalSettingsChange(),
    ]);

    expect(overlapped).toBe(false);
    expect(plugin.settings.agentGrants).toEqual([]);
  });

  it('recomputes the client endpoint when the vault id changes', async () => {
    // The endpoint is derived from the vault id, so a synced change to the id
    // makes both the value handed to new client configurations and the socket
    // already bound stale. This is the one reconciler with a result visible
    // from outside a fully loaded plugin.
    // Start on a different id so the first adoption is itself a change.
    const plugin = createPlugin([]);
    plugin.settings = { ...plugin.settings, agentVaultId: 'vault-0' };
    plugin.loadData = async () => storedSettings([]);
    await plugin.onExternalSettingsChange();
    const before = plugin.agentClientEndpoint;
    expect(before).toContain('vault-1');

    plugin.loadData = async () => ({
      ...storedSettings([]),
      agentVaultId: 'vault-2',
    });
    await plugin.onExternalSettingsChange();

    expect(plugin.agentClientEndpoint).toContain('vault-2');
    expect(plugin.agentClientEndpoint).not.toBe(before);
  });

  it('writes the repaired vault identity back, so a restart keeps it', async () => {
    // Keeping the id in memory alone only postpones the damage: onload mints a
    // fresh one whenever the stored value is blank, so the next start would
    // hand every grant a vaultId that no longer matches and move the endpoint.
    // A valid payload can carry grants and omit the id, which is exactly the
    // case that would look fine until a restart.
    const plugin = createPlugin([GRANT]);
    const saved: unknown[] = [];
    plugin.saveData = async (data: unknown) => {
      saved.push(data);
    };
    const withoutId: Record<string, unknown> = { ...storedSettings([GRANT]) };
    delete withoutId['agentVaultId'];
    plugin.loadData = async () => withoutId;

    await plugin.onExternalSettingsChange();

    expect(plugin.settings.agentVaultId).toBe('vault-1');
    expect(saved).toHaveLength(1);
    expect((saved[0] as { agentVaultId: string }).agentVaultId).toBe('vault-1');
  });

  it('keeps the vault identity when the file comes back unreadable', async () => {
    // An absent or unparsable read falls to defaults, whose vault id is blank.
    // Adopting that would orphan every grant bound to the real id and move the
    // endpoint derived from it, so the existing identity is kept instead.
    const plugin = createPlugin([GRANT]);
    plugin.loadData = async () => null;

    await plugin.onExternalSettingsChange();

    expect(plugin.settings.agentVaultId).toBe('vault-1');
  });
});
