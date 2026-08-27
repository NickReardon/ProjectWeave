import { describe, expect, it } from 'vitest';

import ProjectWeavePlugin, { agentBridgeNeedsRefresh } from '../../src/main';
import { localAgentEndpoint } from '../../src/adapters/desktop/agent-endpoint';
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

/**
 * A grant as `data.json` stores it. GRANT's digest is shaped for the gateway
 * test's stub digester and would be dropped by the settings normalizer, so a
 * payload that must survive a load carries a real one.
 */
const STORED_GRANT = { ...GRANT, secretDigest: 'a'.repeat(64) };

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

  it('cannot restore a revoked grant through a local save already in flight', async () => {
    // The interleaving the queue exists for. A local save that began before the
    // revocation synced used to compute its payload from the grant list it read
    // at call time, so it landed after the adoption and wrote the withdrawn
    // grant back — to data.json and to the list the live gateway callbacks
    // read. data.json is modelled here because that is where the two writers
    // actually meet.
    const plugin = createPlugin([GRANT]);
    let file: Record<string, unknown> = storedSettings([STORED_GRANT]);
    plugin.loadData = async () => file;
    plugin.saveData = async (data: unknown) => {
      file = data as Record<string, unknown>;
    };

    // An unrelated local setting starts saving, then the revocation reaches
    // the file and Obsidian notifies us while that save is still in flight.
    const localSave = plugin.updateDiagnosticsLogFolder('Logs');
    file = storedSettings([]);
    const adoption = plugin.onExternalSettingsChange();
    await Promise.all([localSave, adoption]);

    expect(plugin.settings.agentGrants).toEqual([]);
    expect(file['agentGrants']).toEqual([]);
    // The local change is not lost to the merge; only the stale grant list is.
    expect(plugin.settings.diagnosticsLogFolder).toBe('Logs');
  });

  it('drops a notification the plugin was unloaded during', async () => {
    // onunload disposes the read source and the current coordinator. A read
    // still outstanding at that moment used to continue afterwards and could
    // install a fresh runtime, leaving a coordinator nothing would ever
    // dispose.
    const plugin = createPlugin([GRANT]);
    const before = plugin.settings;
    plugin.loadData = async () => {
      plugin.onunload();
      return { ...storedSettings([]), projectRoots: ['Archive'] };
    };

    await plugin.onExternalSettingsChange();

    expect(plugin.settings).toBe(before);
    expect(plugin.settings.projectRoots).toEqual(['Projects']);
  });

  it('does not adopt a local write that finished after unload', async () => {
    // Same boundary on the writing side: the file write is already committed,
    // but the settings it describes belong to a plugin that no longer has a
    // runtime to reconcile them against.
    const plugin = createPlugin([]);
    plugin.loadData = async () => null;
    plugin.saveData = async () => {
      plugin.onunload();
    };

    await plugin.updateDiagnosticsLogFolder('Logs');

    expect(plugin.settings.diagnosticsLogFolder).toBe('');
  });

  it('recomputes the client endpoint when the vault id changes', async () => {
    // The endpoint is derived from the vault id — through a digest, so it is
    // compared against the deriving function rather than searched for the id —
    // so a synced change to the id makes both the value handed to new client
    // configurations and the socket already bound stale. This is the one reconciler with a result visible
    // from outside a fully loaded plugin.
    // Start on a different id so the first adoption is itself a change.
    const plugin = createPlugin([]);
    plugin.settings = { ...plugin.settings, agentVaultId: 'vault-0' };
    plugin.loadData = async () => storedSettings([]);
    await plugin.onExternalSettingsChange();
    const before = plugin.agentClientEndpoint;
    expect(before).toBe(localAgentEndpoint('vault-1'));

    plugin.loadData = async () => ({
      ...storedSettings([]),
      agentVaultId: 'vault-2',
    });
    await plugin.onExternalSettingsChange();

    expect(plugin.agentClientEndpoint).toBe(localAgentEndpoint('vault-2'));
    expect(plugin.agentClientEndpoint).not.toBe(before);
  });

  it('adopts nothing and writes nothing when the payload carries no identity', async () => {
    // Every grant is bound to the vault id, so a payload without one does not
    // describe this vault. An earlier version repaired it and saved, which put
    // a write on this path; a write here can land on top of a change that
    // synced while we were reading and lose it. Refusing is the fail-closed
    // half of that trade: grants stop working rather than a revoked credential
    // quietly staying alive.
    const plugin = createPlugin([GRANT]);
    const before = plugin.settings;
    const saved: unknown[] = [];
    plugin.saveData = async (data: unknown) => {
      saved.push(data);
    };
    const withoutId: Record<string, unknown> = {
      ...storedSettings([STORED_GRANT]),
      templateScaffoldFolder: 'Templates/Custom',
    };
    delete withoutId['agentVaultId'];
    plugin.loadData = async () => withoutId;

    await plugin.onExternalSettingsChange();

    expect(saved).toEqual([]);
    expect(plugin.settings).toBe(before);
    expect(plugin.settings.agentGrants).toHaveLength(1);
  });

  it('never writes on a path that only reads', async () => {
    // The hook exists to adopt a file, not to edit it. A write here races the
    // sync that triggered the notification.
    const plugin = createPlugin([GRANT]);
    const saved: unknown[] = [];
    plugin.saveData = async (data: unknown) => {
      saved.push(data);
    };
    plugin.loadData = async () => storedSettings([]);

    await plugin.onExternalSettingsChange();

    expect(saved).toEqual([]);
    expect(plugin.settings.agentGrants).toEqual([]);
  });

  it.each([
    ['absent', null],
    ['malformed', 'not-a-settings-record'],
    ['from an unsupported build', { settingsVersion: 99, agentGrants: [] }],
    ['a bare version claim', { settingsVersion: 2 }],
    ['missing its grant list', { settingsVersion: 2, agentVaultId: 'vault-9' }],
  ])(
    'adopts nothing and saves nothing when the file is %s',
    async (_label, payload) => {
      // loadProjectWeaveSettings answers every bad payload with defaults, which
      // is correct at load and destructive here: adopting them drops every grant
      // and root, and writing them back makes that permanent. A read that cannot
      // be trusted is not a change.
      const plugin = createPlugin([GRANT]);
      const before = plugin.settings;
      const saved: unknown[] = [];
      plugin.saveData = async (data: unknown) => {
        saved.push(data);
      };
      plugin.loadData = async () => payload;

      await plugin.onExternalSettingsChange();

      expect(saved).toEqual([]);
      expect(plugin.settings).toBe(before);
      expect(plugin.settings.agentGrants).toHaveLength(1);
      expect(plugin.settings.agentVaultId).toBe('vault-1');
    },
  );
});

describe('agentBridgeNeedsRefresh', () => {
  const base = {
    enabledChanged: false,
    identityChanged: false,
    enabled: false,
    listening: false,
  };

  it('rebuilds when intent changes', () => {
    expect(agentBridgeNeedsRefresh({ ...base, enabledChanged: true })).toBe(
      true,
    );
    expect(agentBridgeNeedsRefresh({ ...base, identityChanged: true })).toBe(
      true,
    );
  });

  it('retries when the gateway should be listening but is not', () => {
    // The case a difference check alone misses: a refresh that threw on
    // EADDRINUSE left the setting enabled with no bridge, and every later
    // notification would see no change and never retry.
    expect(agentBridgeNeedsRefresh({ ...base, enabled: true })).toBe(true);
  });

  it('leaves a healthy bridge alone on an unrelated sync', () => {
    expect(
      agentBridgeNeedsRefresh({ ...base, enabled: true, listening: true }),
    ).toBe(false);
  });

  it('does not start a bridge the settings did not ask for', () => {
    expect(agentBridgeNeedsRefresh(base)).toBe(false);
  });
});
