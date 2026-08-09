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
import { TaskTemplateResolver } from './application/task-template-resolver';
import {
  ReadOnlyAgentGateway,
  type AgentGrant,
} from './application/read-only-agent-gateway';
import { isInTemplateLibrary } from './application/template-note-diagnostics';
import { templateClockFromLocalDate } from './domain/templates/model';
import { IndexCoordinator } from './indexing/index-coordinator';
import {
  classifyScopeTransition,
  createDefaultProjectWeaveSettings,
  loadProjectWeaveSettings,
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
  #unloaded = false;

  public override async onload(): Promise<void> {
    this.settings = loadProjectWeaveSettings(await this.loadData());
    if (this.settings.agentVaultId.length === 0) {
      this.settings = {
        ...this.settings,
        agentVaultId: randomIdentifier(),
      };
      await this.saveData(this.settings);
    }
    this.#installRuntime(this.#createRuntime(this.settings.projectRoots));
    try {
      await this.#refreshAgentBridge();
    } catch (error) {
      console.error('Project Weave agent gateway could not start', error);
      new Notice(
        'Project Weave loaded, but its agent gateway could not start.',
      );
    }
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
    const nextSettings = { ...this.settings, projectRoots: normalized };
    await this.saveData(nextSettings);
    this.settings = nextSettings;

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
    const nextSettings = { ...this.settings, taskCategories: normalized };
    await this.saveData(nextSettings);
    this.settings = nextSettings;
    await this.rebuildIndex(false);
  }

  public async updateTemplateScaffoldFolder(
    templateScaffoldFolder: string,
  ): Promise<void> {
    const normalized = normalizeOptionalVaultFolderPath(templateScaffoldFolder);
    const nextSettings = {
      ...this.settings,
      templateScaffoldFolder: normalized,
    };
    await this.saveData(nextSettings);
    this.settings = nextSettings;
    if (this.#runtime !== null) this.#bindReadSource(this.#runtime);
    this.#noteDiagnosticBanners?.scheduleRefresh();
  }

  public async updateDiagnosticsLogFolder(value: string): Promise<void> {
    const normalized = normalizeOptionalVaultFolderPath(value);
    const nextSettings = {
      ...this.settings,
      diagnosticsLogFolder: normalized,
    };
    await this.saveData(nextSettings);
    this.settings = nextSettings;
    this.#diagnosticsLogService?.publish(this.#readSource.current);
  }

  public async updateAgentGatewayEnabled(enabled: boolean): Promise<void> {
    if (enabled && !Platform.isDesktopApp) {
      throw new Error('Agent access is available only in the desktop app.');
    }
    const nextSettings = { ...this.settings, agentGatewayEnabled: enabled };
    await this.saveData(nextSettings);
    this.settings = nextSettings;
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
    const projectRoot = projectContentRoot(projectPath);
    if (
      contentRoots.some(
        (root) => root !== projectRoot && !root.startsWith(projectRoot + '/'),
      )
    ) {
      throw new Error(
        'Grant content folders must stay inside the selected project.',
      );
    }
    const id = randomIdentifier();
    const secret = `${randomIdentifier()}.${randomIdentifier()}`;
    const grant: AgentGrant = {
      id,
      label:
        input.label.trim().length === 0 ? entity.title : input.label.trim(),
      vaultId: this.settings.agentVaultId,
      projectPath,
      contentRoots,
      secretDigest: await digestSecret(secret),
      enabled: true,
    };
    const nextSettings = {
      ...this.settings,
      agentGrants: [...this.settings.agentGrants, grant],
    };
    await this.saveData(nextSettings);
    this.settings = nextSettings;
    return { grant, secret };
  }

  public async removeAgentGrant(id: string): Promise<void> {
    const nextSettings = {
      ...this.settings,
      agentGrants: this.settings.agentGrants.filter((grant) => grant.id !== id),
    };
    await this.saveData(nextSettings);
    this.settings = nextSettings;
  }

  public get agentGatewayEndpoint(): string | null {
    return this.#agentBridge?.state.endpoint ?? null;
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
        if (folder.trim().length === 0) return new TaskTemplateResolver();
        const reader = new ObsidianVaultReader(this.app.vault, [folder]);
        return new TaskTemplateResolver(
          new VaultTemplateLibrary(reader, folder),
        );
      },
    });
  }

  async #refreshAgentBridge(): Promise<void> {
    await this.#stopAgentBridge();
    if (
      !this.settings.agentGatewayEnabled ||
      !Platform.isDesktopApp ||
      this.#unloaded
    )
      return;
    const { LocalAgentBridge, localAgentEndpoint } =
      await import('./adapters/desktop/local-agent-bridge');
    const gateway = new ReadOnlyAgentGateway({
      enabled: () => this.settings.agentGatewayEnabled,
      vaultId: () => this.settings.agentVaultId,
      grants: () => this.settings.agentGrants,
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
        new TaskTemplateResolver(library),
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
        return ['default'] as readonly string[];
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
        library,
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

function projectContentRoot(projectPath: string): string {
  if (projectPath.toLowerCase().endsWith('/project.md')) {
    return projectPath.slice(0, -'/Project.md'.length);
  }
  return projectPath.replace(/\.md$/iu, '');
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
