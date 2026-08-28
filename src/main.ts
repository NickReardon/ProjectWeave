import { Notice, Platform, Plugin, TFile } from 'obsidian';
import type { WorkspaceLeaf } from 'obsidian';

import { ObsidianNoteWriter } from './adapters/obsidian/obsidian-note-writer';
import { ObsidianDiagnosticsLogWriter } from './adapters/obsidian/obsidian-diagnostics-log-writer';
import { CompositeVaultReader } from './ports/composite-vault-reader';
import type { VaultReader } from './ports/vault-reader';
import {
  ObsidianLinkResolver,
  ObsidianVaultReader,
} from './adapters/obsidian/obsidian-vault-reader';
import { buildProjectWorkbenchModel } from './application/project-workbench-model';
import { DiagnosticsLogService } from './application/diagnostics-log-service';
import { ProjectWeaveReadSource } from './application/project-weave-read-source';
import { NoteCreationCommitService } from './application/note-creation-commit';
import { ProjectCreationPreviewService } from './application/project-creation-preview';
import { ProjectCreationProposalService } from './application/project-creation-proposal';
import { TaskCreationPreviewService } from './application/task-creation-preview';
import { VaultTemplateLibrary } from './application/vault-template-library';
import { TaskCreationProposalService } from './application/task-creation-proposal';
import {
  TemplateResolver,
  type TemplateVariantOption,
} from './application/template-resolver';
import { ReadOnlyAgentGateway } from './application/read-only-agent-gateway';
import { mintAgentGrant, type AgentGrant } from './application/agent-grants';
import type { ProjectSummary } from './application/query-api';
import { isInTemplateLibrary } from './application/template-note-diagnostics';
import { templateClockFromLocalDate } from './domain/templates/model';
import { IndexCoordinator } from './indexing/index-coordinator';
import {
  classifyScopeTransition,
  createDefaultProjectWeaveSettings,
  hasUnreadableRevocationRecord,
  isAdoptableSettingsPayload,
  loadProjectWeaveSettings,
  mergeRevokedGrantIds,
  normalizeAgentGrants,
  normalizeOptionalVaultFolderPath,
  normalizeProjectRoots,
  normalizeTaskCategories,
  normalizeVaultFilePath,
  normalizeVaultFolderPath,
} from './settings/project-weave-settings';
import type { ProjectWeaveSettings } from './settings/project-weave-settings';
import {
  PROJECT_WORKBENCH_VIEW_TYPE,
  ProjectWorkbenchView,
} from './ui/project-workbench-view';
import { NoteDiagnosticBannerController } from './ui/note-diagnostic-banner';
import { ReadyNowModal } from './ui/ready-now-modal';
import { ProjectWeaveSettingTab } from './ui/settings-tab';
import { ProjectCreationPreviewModal } from './ui/project-creation-preview-modal';
import { TaskCreationPreviewModal } from './ui/task-creation-preview-modal';

interface ProjectWeaveRuntime {
  readonly reader: ObsidianVaultReader;
  readonly coordinator: IndexCoordinator;
}

interface AgentBridgeLifecycle {
  readonly state: { readonly endpoint: string | null };
  stop(): Promise<void>;
}

/**
 * Whether a synced settings change means the agent bridge must be rebuilt.
 *
 * Intent changing is the obvious half. The other half is that a previous
 * refresh can have failed — `bridge.start()` throws on `EADDRINUSE` — leaving
 * the setting enabled with nothing listening. Reacting only to a difference
 * would treat that failure as applied, so the next notification sees no change
 * and never retries and the gateway stays down until a manual toggle or a
 * restart. Comparing intent against the bridge that actually exists retries in
 * exactly that case, without restarting a healthy bridge on every sync.
 *
 * Extracted so the terms can be tested: reaching this condition in place needs
 * an enabled gateway binding a real socket.
 */
export function agentBridgeNeedsRefresh(input: {
  readonly enabledChanged: boolean;
  readonly identityChanged: boolean;
  readonly enabled: boolean;
  readonly listening: boolean;
}): boolean {
  if (input.enabledChanged || input.identityChanged) {
    return true;
  }
  return input.enabled && !input.listening;
}

export default class ProjectWeavePlugin extends Plugin {
  public override settings: ProjectWeaveSettings =
    createDefaultProjectWeaveSettings();

  // The clock is supplied here, at the composition root, so the read source
  // itself stays deterministic under test.
  readonly #readSource = new ProjectWeaveReadSource(undefined, () =>
    Date.now(),
  );
  #runtime: ProjectWeaveRuntime | null = null;
  #noteDiagnosticBanners: NoteDiagnosticBannerController | null = null;
  #diagnosticsLogService: DiagnosticsLogService | null = null;
  #unsubscribeDiagnosticsLog: (() => void) | null = null;
  #openingWorkbench: Promise<void> | null = null;
  #agentBridge: AgentBridgeLifecycle | null = null;
  #agentClientEndpoint: string | null = null;
  #settingsWork: Promise<void> = Promise.resolve();
  /** Revoked ids this session holds but has not managed to write to the file. */
  readonly #unwrittenRevocations = new Set<string>();
  #agentBridgeWork: Promise<void> = Promise.resolve();
  #unloaded = false;

  public override async onload(): Promise<void> {
    const stored: unknown = await this.loadData();
    this.settings = loadProjectWeaveSettings(stored);
    const hasUnreadableRevocations = hasUnreadableRevocationRecord(stored);
    if (hasUnreadableRevocations) {
      // Failing closed is silent otherwise: the grants simply stop working,
      // which reads as a broken gateway rather than as a damaged record the
      // user can repair.
      new Notice(
        'Project Weave could not read which agent grants had been revoked, so it is serving none of them and the gateway stays off. Repair or remove revokedAgentGrantIds in the plugin data file.',
      );
    }
    // Do not turn a fail-closed read into a destructive repair. A malformed
    // revocation record can coexist with a missing or invalid old identity;
    // generating a new identity would immediately save the defaults and erase
    // the record (and any grants it accompanies) before the user could repair
    // it. A later deliberate settings change is a user-authorized write, but
    // load itself must leave this damaged security record intact.
    if (this.settings.agentVaultId.length === 0 && !hasUnreadableRevocations) {
      try {
        await this.#commitSettings((current) => ({
          ...current,
          agentVaultId: randomIdentifier(),
        }));
      } catch (error) {
        // Only reachable when the vault closed during load. There is nothing
        // to persist for a plugin that no longer has a runtime, and failing
        // onload over it would report a load failure that did not happen.
        if (!this.#unloaded) throw error;
      }
      // Loading stops there rather than continuing without the write. onunload
      // has already run, so the rest of this method would register a view,
      // commands, events, and a banner controller onto a plugin Obsidian has
      // finished tearing down, and nothing would ever dispose them.
      if (this.#unloaded) return;
    }
    this.#installRuntime(this.#createRuntime(this.settings.projectRoots));
    await this.#resolveAgentClientEndpoint();
    try {
      await this.#refreshAgentBridge();
    } catch (error) {
      console.error('Project Weave agent gateway could not start', error);
      new Notice(
        'Project Weave loaded, but its agent gateway could not start.',
      );
    }
    // The same boundary for the two awaits above, which can straddle onunload
    // just as the settings write can. Everything below registers something.
    if (this.#unloaded) return;
    const diagnosticsLogService = new DiagnosticsLogService(
      new ObsidianDiagnosticsLogWriter(this.app.vault),
      () => this.settings.diagnosticsLogFolder,
      () => this.settings.projectRoots,
      (error) => {
        console.error('Project Weave diagnostics export failed', error);
      },
    );
    this.#diagnosticsLogService = diagnosticsLogService;
    this.#unsubscribeDiagnosticsLog = this.#readSource.subscribe(
      (publication) => diagnosticsLogService.publish(publication),
    );

    this.registerView(
      PROJECT_WORKBENCH_VIEW_TYPE,
      (leaf: WorkspaceLeaf) =>
        new ProjectWorkbenchView(
          leaf,
          this.#readSource,
          {
            rebuildIndex: () => this.rebuildIndex(false),
            createTask: (projectPath) => {
              this.#openTaskCreationPreview(projectPath);
            },
            createProject: () => {
              this.#openProjectCreationPreview();
            },
          },
          () => this.settings.taskCategories,
        ),
    );
    this.addSettingTab(new ProjectWeaveSettingTab(this.app, this));

    const noteDiagnosticBanners = new NoteDiagnosticBannerController(
      this.app,
      this.#readSource,
      () => this.settings.templateScaffoldFolder,
    );
    this.#noteDiagnosticBanners = noteDiagnosticBanners;
    noteDiagnosticBanners.start();
    this.registerEvent(
      this.app.workspace.on('file-open', () => {
        noteDiagnosticBanners.scheduleRefresh();
      }),
    );
    this.registerEvent(
      this.app.workspace.on('layout-change', () => {
        noteDiagnosticBanners.scheduleRefresh();
      }),
    );

    const openWorkbench = (): void => {
      void this.openProjectWorkbench().catch((error: unknown) => {
        console.error('Project Weave could not open its workbench', error);
        new Notice('Project Weave could not open its dashboard.');
      });
    };
    this.addRibbonIcon('layout-dashboard', 'Open Project Weave', openWorkbench);
    this.addCommand({
      id: 'open-project-workbench',
      name: 'Open project workbench',
      icon: 'layout-dashboard',
      callback: openWorkbench,
    });
    this.addCommand({
      id: 'open-ready-now',
      name: 'Open Ready Now',
      callback: () => {
        void this.#openReadyNow();
      },
    });
    this.addCommand({
      id: 'create-task',
      name: 'Create task',
      callback: () => {
        this.#openTaskCreationPreview();
      },
    });
    this.addCommand({
      id: 'create-project',
      name: 'Create project',
      callback: () => {
        this.#openProjectCreationPreview();
      },
    });
    this.addCommand({
      id: 'rebuild-index',
      name: 'Rebuild index',
      callback: () => {
        void this.rebuildIndex(true);
      },
    });
    this.addCommand({
      id: 'show-index-status',
      name: 'Show index status',
      callback: () => this.#showIndexStatus(),
    });

    this.app.workspace.onLayoutReady(() => {
      if (this.#unloaded) {
        return;
      }
      this.#registerVaultEvents();
      noteDiagnosticBanners.scheduleRefresh();
      void this.rebuildIndex(false);
    });
  }

  public override onunload(): void {
    this.#unloaded = true;
    this.#unsubscribeDiagnosticsLog?.();
    this.#unsubscribeDiagnosticsLog = null;
    this.#diagnosticsLogService?.dispose();
    this.#diagnosticsLogService = null;
    this.#noteDiagnosticBanners?.dispose();
    this.#noteDiagnosticBanners = null;
    void this.#stopAgentBridge();
    this.#readSource.dispose();
    this.#runtime?.coordinator.dispose();
    this.#runtime = null;
    this.#openingWorkbench = null;
  }

  public async updateProjectRoots(
    projectRoots: readonly string[],
  ): Promise<boolean> {
    const normalized = normalizeProjectRoots(projectRoots);
    await this.#commitSettings((current) => ({
      ...current,
      projectRoots: normalized,
    }));
    if (this.#unloaded) return false;

    const next = this.#createRuntime(normalized);
    this.#installRuntime(next);
    return await this.#rebuildRuntime(next, false);
  }

  /**
   * Replaces the vault's task category vocabulary and rebuilds, since the
   * index carries the diagnostics that depend on it.
   */
  public async updateTaskCategories(
    taskCategories: readonly string[],
  ): Promise<void> {
    const normalized = normalizeTaskCategories(taskCategories);
    await this.#commitSettings((current) => ({
      ...current,
      taskCategories: normalized,
    }));
    await this.rebuildIndex(false);
  }

  public async updateTemplateScaffoldFolder(
    templateScaffoldFolder: string,
  ): Promise<void> {
    const normalized = normalizeOptionalVaultFolderPath(templateScaffoldFolder);
    await this.#commitSettings((current) => ({
      ...current,
      templateScaffoldFolder: normalized,
    }));
    if (this.#runtime !== null) this.#bindReadSource(this.#runtime);
    this.#noteDiagnosticBanners?.scheduleRefresh();
  }

  public async updateDiagnosticsLogFolder(value: string): Promise<void> {
    const normalized = normalizeOptionalVaultFolderPath(value);
    await this.#commitSettings((current) => ({
      ...current,
      diagnosticsLogFolder: normalized,
    }));
    this.#diagnosticsLogService?.publish(this.#readSource.current);
  }

  public async updateAgentGatewayEnabled(enabled: boolean): Promise<void> {
    if (enabled && !Platform.isDesktopApp) {
      throw new Error('Agent access is available only in the desktop app.');
    }
    await this.#commitSettings((current) => ({
      ...current,
      agentGatewayEnabled: enabled,
    }));
    await this.#refreshAgentBridge();
  }

  public async createAgentGrant(input: {
    readonly label: string;
    readonly projectPath: string;
    readonly contentRoots: readonly string[];
  }): Promise<{ readonly grant: AgentGrant; readonly secret: string }> {
    const projectPath = normalizeVaultFilePath(input.projectPath);
    const entity = this.#readSource.current.snapshot.getEntity(projectPath);
    if (entity?.kind !== 'project') {
      throw new Error('Select an indexed project note for the grant.');
    }
    const contentRoots = normalizeProjectRoots(
      input.contentRoots.map(normalizeVaultFolderPath),
    );
    // Minted inside the queue rather than before it: the grant is bound to the
    // vault identity, and a synced change to that identity between the mint and
    // the save would store a grant no request could ever match.
    return await this.#queueSettingsWork(async () => {
      await this.#adoptExternalSettings();
      const result = await mintAgentGrant(
        {
          label: input.label,
          fallbackLabel: entity.title,
          vaultId: this.settings.agentVaultId,
          projectPath,
          contentRoots,
        },
        { nextIdentifier: randomIdentifier, digestSecret },
      );
      await this.#persistSettings({
        ...this.settings,
        agentGrants: [...this.settings.agentGrants, result.grant],
      });
      return result;
    });
  }

  /**
   * Indexed projects available for a grant's project path, via the same
   * bounded query the agent gateway uses to answer `projects_list`.
   */
  public async listIndexedProjects(): Promise<readonly ProjectSummary[]> {
    const result = await this.#readSource.current.queryApi.listProjects({
      limit: 200,
    });
    return result.ok ? result.items : [];
  }

  /**
   * Withdraws a grant, and records that it was withdrawn.
   *
   * The tombstone is the part that survives sync (ADR 0035). Removing the entry
   * alone left revocation expressed as an absence, and an absence is undone by
   * any device that writes a settings file it read before the revocation
   * arrived.
   */
  public async removeAgentGrant(id: string): Promise<void> {
    await this.#commitSettings((current) => ({
      ...current,
      agentGrants: current.agentGrants.filter((grant) => grant.id !== id),
      revokedAgentGrantIds: mergeRevokedGrantIds(current.revokedAgentGrantIds, [
        id,
      ]),
    }));
  }

  /**
   * The one place `settings` is written, and the one queue every writer waits
   * in — the local updaters above and the adoption of a synced file alike.
   *
   * Revocation is why the queue is shared rather than one chain per writer.
   * Every updater used to build its next settings from a snapshot taken before
   * its own `saveData`, so an unrelated local save that started before a
   * revocation was adopted would finish after it and write the withdrawn grant
   * back — to disk and to the list the live gateway callbacks read. Running the
   * mutation inside the queue means it always sees the last committed state,
   * whatever produced it.
   */
  #queueSettingsWork<T>(work: () => Promise<T>): Promise<T> {
    // Chained on both settle paths so one failed write does not strand every
    // later one; the stored chain is settled separately so a rejection waiting
    // for the next writer is never unhandled.
    const queued = this.#settingsWork.then(work, work);
    this.#settingsWork = queued.then(
      () => undefined,
      () => undefined,
    );
    return queued;
  }

  /**
   * Saves and adopts `next`. Only ever called from inside the settings queue,
   * which is what makes the read that built `next` still current here.
   */
  async #persistSettings(next: ProjectWeaveSettings): Promise<void> {
    await this.saveData(next);
    // The write is already on disk; the in-memory half is skipped because the
    // plugin this would be settings for no longer has a runtime.
    if (this.#unloaded) return;
    this.settings = next;
  }

  /**
   * Derives the next settings from whatever is current when the turn comes,
   * where current means the file as well as memory.
   *
   * The queue alone orders this device's writers; it cannot order them against
   * the sync that rewrites `data.json` underneath all of them. Reading the file
   * first — through the same reconciler the change notification uses, so a
   * divergence is acted on and not merely absorbed — narrows the window in
   * which a save can carry a revoked grant back into the list this instance is
   * still serving from to the write itself.
   *
   * It does not close it. `loadData`/`saveData` offer no compare-and-swap, so a
   * sync landing between this read and the end of that write is overwritten by
   * it, and the notification for it then reads back the settings this save
   * restored — leaving a revoked credential authorized here. Closing it needs
   * revocations recorded rather than inferred from a grant's absence, which is
   * what `revokedAgentGrantIds` does (ADR 0035): the entry a stale write
   * restores is dropped against the recorded id, so what this window can still
   * cost is a revocation's durability rather than its effect.
   */
  #commitSettings(
    mutate: (current: ProjectWeaveSettings) => ProjectWeaveSettings,
  ): Promise<void> {
    return this.#queueSettingsWork(async () => {
      await this.#adoptExternalSettings();
      // Adoption abandons its read once the plugin is unloaded, so `settings`
      // is no longer known to describe the file and a mutation derived from it
      // could write a stale payload over a change that synced meanwhile.
      //
      // Refusing loudly rather than quietly. A caller that cannot persist has
      // to be able to tell: grant creation rolls back by removing the grant it
      // just wrote, and a rollback that resolves without deleting anything
      // would report that the grant was not kept while it is still stored and
      // still authorized, with its secret never delivered.
      if (this.#unloaded) {
        throw new Error(
          'Project Weave was unloaded before the change could be saved.',
        );
      }
      await this.#persistSettings(mutate(this.settings));
    });
  }

  /**
   * Adopt `data.json` when it changes underneath us — Obsidian calls this when
   * sync rewrites the file.
   *
   * Revocation is why this exists. A grant revoked on another device only
   * rewrites that device's settings file; without this, a running gateway kept
   * authorizing against the grants it read at load, so a withdrawn credential
   * stayed usable until Obsidian restarted. The gateway reads grants and the
   * enabled flag through live callbacks, so adopting the new settings is
   * enough for the next request to see the revocation.
   *
   * Only a change to the enabled flag needs the socket bound or unbound, and
   * only a change to the roots needs a reindex; refreshing either
   * unconditionally would tear down a working bridge on every unrelated sync.
   */
  public override async onExternalSettingsChange(): Promise<void> {
    // Obsidian can call this again while the previous call is still awaiting a
    // read or a bridge restart. Both would capture the same `previous`, so
    // both would compute their differences from a baseline the other has
    // already moved past. Queued rather than dropped: each notification
    // describes a real file state, and the last one to run leaves the settings
    // matching the file. The queue is the same one every local write waits in,
    // so a save in flight can no longer restore a grant this adopts as revoked.
    await this.#queueSettingsWork(() => this.#adoptExternalSettings());
  }

  async #adoptExternalSettings(): Promise<void> {
    const previous = this.settings;
    const stored: unknown = await this.loadData();
    // onunload has disposed the read source and the coordinator while this read
    // was outstanding. Adopting now would install a runtime nothing will ever
    // dispose, so the notification is dropped with the plugin.
    if (this.#unloaded) return;
    if (!isAdoptableSettingsPayload(stored)) {
      // Absent, malformed, from a build this one does not understand, or
      // missing the identity its grants are bound to. loadProjectWeaveSettings
      // would answer any of those with defaults, which is right at load and
      // wrong here: it would drop every grant and root from a session that
      // currently has them. A read we cannot trust is not a change.
      //
      // Nothing is written back, either. An earlier attempt repaired a missing
      // identity and saved it, which put a write on this path — and a write
      // here can land on top of a change that synced while we were reading,
      // losing it. Between a revocation that silently fails to apply and a
      // vault id that has to be re-established after a restart, the second is
      // the safer way to be wrong: grants stop working rather than quietly
      // keeping a credential alive.
      return;
    }
    const loaded = loadProjectWeaveSettings(stored);
    // Revocations this device knows about outlive any file that forgets them.
    const revokedAgentGrantIds = mergeRevokedGrantIds(
      previous.revokedAgentGrantIds,
      loaded.revokedAgentGrantIds,
    );
    const revoked = new Set(revokedAgentGrantIds);
    const agentGrants = loaded.agentGrants.filter(
      (grant) => !revoked.has(grant.id),
    );
    // What the file itself holds, before the loader dropped anything: comparing
    // against `loaded` would compare the merge with its own result, since the
    // loader has already applied the ids the file carries.
    const storedGrants = Array.isArray(stored.agentGrants)
      ? normalizeAgentGrants(stored.agentGrants)
      : [];
    // The file is behind this device when it is missing an id held here, or
    // still carrying an entry for a grant any recorded id withdrew — including
    // one it records itself, which a build that predates these ids would serve.
    const fileIsBehind =
      revokedAgentGrantIds.length !== loaded.revokedAgentGrantIds.length ||
      storedGrants.length !== agentGrants.length;
    this.settings = { ...loaded, agentGrants, revokedAgentGrantIds };
    if (fileIsBehind) {
      await this.#propagateRevocations(
        this.settings,
        revokedAgentGrantIds.filter(
          (id) => !loaded.revokedAgentGrantIds.includes(id),
        ),
      );
    }
    const differs = (key: keyof ProjectWeaveSettings): boolean =>
      JSON.stringify(previous[key]) !== JSON.stringify(this.settings[key]);

    // Adopting the file is all a revoked grant needs: the gateway reads the
    // grant list and the enabled flag per request. Every other setting has a
    // side effect that its own updater performs after saving, and skipping any
    // of them here would leave settings showing one thing while creation,
    // diagnostics, or the index still used another.
    if (differs('projectRoots')) {
      const runtime = this.#createRuntime(this.settings.projectRoots);
      this.#installRuntime(runtime);
      await this.#rebuildRuntime(runtime, false);
    } else if (differs('taskCategories')) {
      // A new runtime already reindexes; this covers the case where it is the
      // categories alone that moved.
      await this.rebuildIndex(false);
    }
    if (differs('templateScaffoldFolder')) {
      if (this.#runtime !== null) this.#bindReadSource(this.#runtime);
      this.#noteDiagnosticBanners?.scheduleRefresh();
    }
    if (differs('diagnosticsLogFolder')) {
      this.#diagnosticsLogService?.publish(this.#readSource.current);
    }
    if (differs('agentVaultId')) {
      // The endpoint is derived from this id, so both the value handed to new
      // client configurations and the socket already bound are now stale.
      await this.#resolveAgentClientEndpoint();
    }
    if (
      agentBridgeNeedsRefresh({
        enabledChanged: differs('agentGatewayEnabled'),
        identityChanged: differs('agentVaultId'),
        enabled: this.settings.agentGatewayEnabled,
        listening: this.#agentBridge !== null,
      })
    ) {
      await this.#refreshAgentBridge();
    }
  }

  /**
   * Writes the merged settings back when the adopted file was missing a
   * revocation this device holds.
   *
   * The one write on a path that otherwise only reads, and taken deliberately
   * (ADR 0035): a device that revoked and lost the race is the only one holding
   * the record, so a set that is never written back never reaches the device
   * that restored the grant.
   *
   * Not raised, because raising rejects a notification Obsidian does not
   * handle, and because this device is already refusing the grant. But not
   * silent either: what fails here is the durability of a revocation, and until
   * it is written the record lives only in this session. Closing the vault
   * loses it, and another device can still be serving the grant. The user is
   * told, once per id per session, since adoption can repeat often and the
   * retry is simply the next one.
   */
  async #propagateRevocations(
    next: ProjectWeaveSettings,
    missingFromFile: readonly string[],
  ): Promise<void> {
    try {
      await this.#persistSettings(next);
      for (const id of missingFromFile) this.#unwrittenRevocations.delete(id);
    } catch (error) {
      console.error(
        'Project Weave could not write back a revoked grant id',
        error,
      );
      const unreported = missingFromFile.filter(
        (id) => !this.#unwrittenRevocations.has(id),
      );
      if (unreported.length === 0) return;
      for (const id of unreported) this.#unwrittenRevocations.add(id);
      new Notice(
        `Project Weave could not record the revocation of ${unreported.join(', ')} permanently. It is refused on this device, but another device may still accept it until the vault can be written again.`,
      );
    }
  }

  public get agentGatewayEndpoint(): string | null {
    return this.#agentBridge?.state.endpoint ?? null;
  }

  /**
   * The endpoint a client configuration must carry, whether or not the gateway
   * is listening right now.
   *
   * `agentGatewayEndpoint` reports the running bridge and is `null` while the
   * gateway is off. A grant is routinely created before the gateway is switched
   * on, and its configuration is delivered exactly once, so reading the live
   * bridge there would copy a blank endpoint into a configuration the companion
   * then refuses to start with — recoverable only by revoking the grant and
   * creating another. This derives the same value the bridge will bind instead.
   *
   * `null` only on mobile, where no gateway exists to configure.
   */
  public get agentClientEndpoint(): string | null {
    return this.#agentClientEndpoint;
  }

  async #resolveAgentClientEndpoint(): Promise<void> {
    if (!Platform.isDesktopApp) {
      return;
    }
    const { localAgentEndpoint } =
      await import('./adapters/desktop/agent-endpoint');
    this.#agentClientEndpoint = localAgentEndpoint(this.settings.agentVaultId);
  }

  public async rebuildIndex(showSuccess: boolean): Promise<void> {
    const runtime = this.#runtime;
    if (runtime === null) {
      return;
    }
    await this.#rebuildRuntime(runtime, showSuccess);
  }

  public openProjectWorkbench(): Promise<void> {
    if (this.#openingWorkbench !== null) {
      return this.#openingWorkbench;
    }
    const operation = this.#activateProjectWorkbench();
    this.#openingWorkbench = operation;
    void operation
      .finally(() => {
        if (this.#openingWorkbench === operation) {
          this.#openingWorkbench = null;
        }
      })
      .catch(() => undefined);
    return operation;
  }

  #createRuntime(projectRoots: readonly string[]): ProjectWeaveRuntime {
    const reader = new ObsidianVaultReader(this.app.vault, projectRoots);
    const coordinator = new IndexCoordinator(reader, {
      linkResolver: new ObsidianLinkResolver(this.app.metadataCache),
      taskCategories: () => this.settings.taskCategories,
    });
    return {
      reader,
      coordinator,
    };
  }

  #installRuntime(next: ProjectWeaveRuntime): void {
    if (this.#unloaded) {
      // onunload already disposed what it knew about; installing here would
      // leave this coordinator running with nothing left to dispose it.
      next.coordinator.dispose();
      return;
    }
    const previous = this.#runtime;
    this.#runtime = next;
    this.#bindReadSource(next);
    previous?.coordinator.dispose();
  }

  #bindReadSource(runtime: ProjectWeaveRuntime): void {
    this.#readSource.bind(runtime.coordinator, {
      vault: runtime.reader,
      taskTemplates: () => {
        const folder = this.settings.templateScaffoldFolder;
        if (folder.trim().length === 0) return new TemplateResolver();
        const reader = new ObsidianVaultReader(this.app.vault, [folder]);
        return new TemplateResolver(new VaultTemplateLibrary(reader, folder));
      },
    });
  }

  /**
   * Serialized because three callers reach it — load, the settings toggle, and
   * an external change — and it stops the bridge before binding a new one. Two
   * overlapping runs can both pass the stop and then race to bind the same
   * endpoint, where the loser fails with `EADDRINUSE` and leaves its caller
   * rejected. Chained on both settle paths so one failure does not strand
   * every later refresh.
   */
  async #refreshAgentBridge(): Promise<void> {
    this.#agentBridgeWork = this.#agentBridgeWork.then(
      () => this.#refreshAgentBridgeNow(),
      () => this.#refreshAgentBridgeNow(),
    );
    await this.#agentBridgeWork;
  }

  async #refreshAgentBridgeNow(): Promise<void> {
    await this.#stopAgentBridge();
    if (
      !this.settings.agentGatewayEnabled ||
      !Platform.isDesktopApp ||
      this.#unloaded
    )
      return;
    const { LocalAgentBridge } =
      await import('./adapters/desktop/local-agent-bridge');
    const { localAgentEndpoint } =
      await import('./adapters/desktop/agent-endpoint');
    const gateway = new ReadOnlyAgentGateway({
      enabled: () => this.settings.agentGatewayEnabled,
      vaultId: () => this.settings.agentVaultId,
      grants: () => this.settings.agentGrants,
      pluginVersion: () => this.manifest.version,
      queryApi: () => this.#readSource.current.queryApi,
      digestSecret,
    });
    const bridge = new LocalAgentBridge(
      gateway,
      localAgentEndpoint(this.settings.agentVaultId),
    );
    await bridge.start();
    if (this.#unloaded || !this.settings.agentGatewayEnabled) {
      await bridge.stop();
      return;
    }
    this.#agentBridge = bridge;
  }

  async #stopAgentBridge(): Promise<void> {
    const bridge = this.#agentBridge;
    this.#agentBridge = null;
    await bridge?.stop();
  }

  #registerVaultEvents(): void {
    this.registerEvent(
      this.app.vault.on('create', (file) => {
        if (
          isInTemplateLibrary(file.path, this.settings.templateScaffoldFolder)
        ) {
          this.#noteDiagnosticBanners?.scheduleRefresh();
        }
        const runtime = this.#runtime;
        if (
          runtime !== null &&
          isMarkdownFile(file) &&
          runtime.reader.includesPath(file.path)
        ) {
          runtime.coordinator.queueUpsert(file.path);
        }
      }),
    );
    this.registerEvent(
      this.app.vault.on('modify', (file) => {
        if (
          isInTemplateLibrary(file.path, this.settings.templateScaffoldFolder)
        ) {
          this.#noteDiagnosticBanners?.scheduleRefresh();
        }
        const runtime = this.#runtime;
        if (
          runtime !== null &&
          isMarkdownFile(file) &&
          runtime.reader.includesPath(file.path)
        ) {
          runtime.coordinator.queueUpsert(file.path);
        }
      }),
    );
    this.registerEvent(
      this.app.vault.on('delete', (file) => {
        if (
          isInTemplateLibrary(file.path, this.settings.templateScaffoldFolder)
        ) {
          this.#noteDiagnosticBanners?.scheduleRefresh();
        }
        const runtime = this.#runtime;
        if (
          runtime !== null &&
          isMarkdownFile(file) &&
          runtime.reader.includesPath(file.path)
        ) {
          runtime.coordinator.queueRemove(file.path);
        }
      }),
    );
    this.registerEvent(
      this.app.vault.on('rename', (file, oldPath) => {
        if (
          isInTemplateLibrary(oldPath, this.settings.templateScaffoldFolder) ||
          isInTemplateLibrary(file.path, this.settings.templateScaffoldFolder)
        ) {
          this.#noteDiagnosticBanners?.scheduleRefresh();
        }
        const runtime = this.#runtime;
        if (runtime === null) {
          return;
        }
        const oldIncluded =
          oldPath.toLowerCase().endsWith('.md') &&
          runtime.reader.includesPath(oldPath);
        const newIncluded =
          isMarkdownFile(file) && runtime.reader.includesPath(file.path);
        switch (classifyScopeTransition(oldIncluded, newIncluded)) {
          case 'rename':
            runtime.coordinator.queueRename(oldPath, file.path);
            break;
          case 'remove':
            runtime.coordinator.queueRemove(oldPath);
            break;
          case 'upsert':
            runtime.coordinator.queueUpsert(file.path);
            break;
          case 'ignore':
            break;
        }
      }),
    );
  }

  async #rebuildRuntime(
    runtime: ProjectWeaveRuntime,
    showSuccess: boolean,
  ): Promise<boolean> {
    try {
      await runtime.coordinator.rebuild();
      if (showSuccess && this.#runtime === runtime) {
        this.#showIndexStatus();
      }
      return true;
    } catch (error) {
      console.error('Project Weave index rebuild failed', error);
      new Notice(
        'Project Weave could not rebuild its index. The vault was not changed.',
      );
      return false;
    }
  }

  async #openReadyNow(): Promise<void> {
    const publication = this.#readSource.current;
    if (this.#runtime === null) {
      new Notice('Project Weave is not loaded.');
      return;
    }
    if (publication.snapshot.revision === 0) {
      new Notice('Project Weave is still indexing the vault.');
      return;
    }

    const projectModel = buildProjectWorkbenchModel({
      publication,
      selectedProjectPath: null,
      activePath: this.app.workspace.getActiveFile()?.path ?? null,
      readyDisplayLimit: 1,
    });
    if (projectModel.state !== 'project') {
      new Notice('Open a project or task note before running Ready Now.');
      return;
    }

    const result = await publication.queryApi.getReadyNow({
      projectPath: projectModel.project.path,
    });
    if (!result.ok) {
      new Notice(result.diagnostics[0]?.message ?? 'Ready Now is unavailable.');
      return;
    }
    new ReadyNowModal(this.app, result).open();
  }

  /**
   * The readers a creation flow needs: the project-scoped one it shares with
   * indexing, plus a second scoped to the template library.
   *
   * ADR 0013 keeps them separate on purpose. Indexing must not start reading
   * notes outside the configured project folders, and creation must be able to
   * read a template that lives outside them, so the two are composed here
   * rather than by widening the index reader's scope.
   */
  #creationReaders(runtime: ProjectWeaveRuntime): {
    readonly reader: VaultReader;
    readonly library: VaultTemplateLibrary | null;
  } {
    const folder = this.settings.templateScaffoldFolder;
    if (folder.trim().length === 0) {
      return { reader: runtime.reader, library: null };
    }
    const libraryReader = new ObsidianVaultReader(this.app.vault, [folder]);
    return {
      reader: new CompositeVaultReader([runtime.reader, libraryReader]),
      library: new VaultTemplateLibrary(libraryReader, folder),
    };
  }

  /**
   * Opens the create-task flow. A caller that already knows the project — the
   * workbench does — passes it, so the flow never guesses from the active
   * note and never refuses because no project note happens to be open.
   */
  #openTaskCreationPreview(requestedProjectPath?: string): void {
    const runtime = this.#runtime;
    if (runtime === null) {
      new Notice('Project Weave is not loaded.');
      return;
    }
    const publication = this.#readSource.current;
    if (publication.snapshot.revision === 0) {
      new Notice('Project Weave is still indexing the vault.');
      return;
    }

    // Prefer an explicit project, then whatever the workbench is showing, and
    // only then the active file. The workbench is not a file view, so with the
    // dashboard focused there is no active file to infer from at all.
    const selectedProjectPath =
      requestedProjectPath ?? this.#workbenchProjectPath();
    const projectModel = buildProjectWorkbenchModel({
      publication,
      selectedProjectPath,
      activePath:
        selectedProjectPath === null
          ? (this.app.workspace.getActiveFile()?.path ?? null)
          : null,
      readyDisplayLimit: 1,
    });
    if (projectModel.state !== 'project') {
      new Notice(
        selectedProjectPath === null
          ? 'Select a project in the workbench, or open a project or task note, before creating a task.'
          : 'That project is no longer available. Rebuilding the index may help.',
      );
      return;
    }
    const { project } = projectModel;

    // Each preview reads the publication current when it runs, so a rebuild
    // while the modal is open is reflected rather than silently stale.
    const { reader, library } = this.#creationReaders(runtime);
    const previews = new TaskCreationPreviewService(
      () => this.#readSource.current.snapshot,
      reader,
      new TaskCreationProposalService(
        () => this.#readSource.current.snapshot,
        reader,
        new TemplateResolver(library),
      ),
    );

    // The writer is scoped to the project roots, not to whatever the readers
    // can see, so no template folder becomes a writable location.
    const commits = new NoteCreationCommitService(
      () => this.#readSource.current.snapshot,
      reader,
      new ObsidianNoteWriter(this.app.vault, this.settings.projectRoots),
    );

    void previews
      .listTemplateVariants(project.path)
      .catch((error: unknown) => {
        console.error('Project Weave could not list task templates', error);
        return [
          { variant: 'default', usable: true, source: 'plugin' },
        ] as readonly TemplateVariantOption[];
      })
      .then((templateVariants) => {
        new TaskCreationPreviewModal(this.app, {
          projectTitle: project.title,
          projectPath: project.path,
          templateVariants,
          run: (request) =>
            previews.preview({
              ...request,
              projectPath: project.path,
              clock: templateClockFromLocalDate(new Date()),
            }),
          commit: (proposal) => commits.commit(proposal),
          openNote: (path) => this.#openCreatedNote(path),
        }).open();
      });
  }

  /**
   * Opens the create-project flow.
   *
   * Unlike task creation, this needs no project to be selected — creating one
   * is the point, and the state it is most useful from is a vault with none.
   */
  #openProjectCreationPreview(): void {
    const runtime = this.#runtime;
    if (runtime === null) {
      new Notice('Project Weave is not loaded.');
      return;
    }
    if (this.#readSource.current.snapshot.revision === 0) {
      new Notice('Project Weave is still indexing the vault.');
      return;
    }
    const roots = this.settings.projectRoots;
    if (roots.length === 0) {
      new Notice(
        'Set an indexed project folder in Settings → Community plugins → Project Weave first.',
      );
      return;
    }

    const { reader, library } = this.#creationReaders(runtime);
    const previews = new ProjectCreationPreviewService(
      () => this.#readSource.current.snapshot,
      reader,
      new ProjectCreationProposalService(
        () => this.#readSource.current.snapshot,
        reader,
        new TemplateResolver(library),
      ),
    );
    const commits = new NoteCreationCommitService(
      () => this.#readSource.current.snapshot,
      reader,
      new ObsidianNoteWriter(this.app.vault, this.settings.projectRoots),
    );

    new ProjectCreationPreviewModal(this.app, {
      roots,
      run: (request) =>
        previews.preview({
          ...request,
          clock: templateClockFromLocalDate(new Date()),
        }),
      commit: (proposal) => commits.commit(proposal),
      openNote: (path) => this.#openCreatedNote(path),
    }).open();
  }

  /** The project an open workbench is showing, or null when none is. */
  #workbenchProjectPath(): string | null {
    for (const leaf of this.app.workspace.getLeavesOfType(
      PROJECT_WORKBENCH_VIEW_TYPE,
    )) {
      const { view } = leaf;
      if (view instanceof ProjectWorkbenchView) {
        const selected = view.selectedProjectPath;
        if (selected !== null) {
          return selected;
        }
      }
    }
    return null;
  }

  /** Opens a just-created note in a new tab, leaving the workbench in place. */
  async #openCreatedNote(path: string): Promise<void> {
    const file = this.app.vault.getFileByPath(path);
    if (file === null) {
      // The vault event for a brand-new file may not have landed yet.
      new Notice('Created ' + path + '. Open it from the workbench.');
      return;
    }
    try {
      await this.app.workspace.getLeaf('tab').openFile(file, { active: true });
    } catch (error) {
      console.error('Project Weave could not open the created note', error);
      new Notice('Created ' + path + ', but it could not be opened.');
    }
  }

  #showIndexStatus(): void {
    if (this.#runtime === null) {
      new Notice('Project Weave is not loaded.');
      return;
    }
    const { snapshot } = this.#readSource.current;
    const entityCount = snapshot.getEntities().length;
    const errorCount = snapshot.diagnostics.filter(
      (issue) => issue.severity === 'error',
    ).length;
    new Notice(
      `Project Weave index ${snapshot.freshness}: ${String(entityCount)} entities, ${String(errorCount)} errors (revision ${String(snapshot.revision)}).`,
    );
  }

  async #activateProjectWorkbench(): Promise<void> {
    if (this.#unloaded) {
      return;
    }

    const invokedFromWorkbench =
      this.app.workspace.getActiveViewOfType(ProjectWorkbenchView) !== null;
    const invokedProjectPath = invokedFromWorkbench
      ? null
      : this.#inferActiveProjectPath();
    let leaf = this.app.workspace.getLeavesOfType(
      PROJECT_WORKBENCH_VIEW_TYPE,
    )[0];
    if (leaf === undefined) {
      leaf = this.app.workspace.getLeaf('tab');
      await leaf.setViewState({
        type: PROJECT_WORKBENCH_VIEW_TYPE,
        active: true,
        state: {
          stateVersion: 1,
          selectedProjectPath: invokedProjectPath,
        },
      });
    }
    if (!this.#unloaded) {
      await this.app.workspace.revealLeaf(leaf);
      if (
        invokedProjectPath !== null &&
        leaf.view instanceof ProjectWorkbenchView
      ) {
        leaf.view.selectProject(invokedProjectPath);
      }
    }
  }

  #inferActiveProjectPath(): string | null {
    const model = buildProjectWorkbenchModel({
      publication: this.#readSource.current,
      selectedProjectPath: null,
      activePath: this.app.workspace.getActiveFile()?.path ?? null,
      readyDisplayLimit: 1,
    });
    return model.state === 'project' ? model.project.path : null;
  }
}

function isMarkdownFile(file: unknown): file is TFile {
  return file instanceof TFile && file.extension === 'md';
}

function randomIdentifier(): string {
  return crypto.randomUUID().toLowerCase();
}

async function digestSecret(secret: string): Promise<string> {
  const bytes = new TextEncoder().encode(secret);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
