import { Notice, Plugin, TFile } from 'obsidian';

import {
  ObsidianLinkResolver,
  ObsidianVaultReader,
} from './adapters/obsidian/obsidian-vault-reader';
import { ProjectWeaveQueryApi } from './application/query-api';
import type { EntityRecord, ProjectEntity } from './domain/model';
import { IndexCoordinator } from './indexing/index-coordinator';
import {
  classifyScopeTransition,
  createDefaultProjectWeaveSettings,
  loadProjectWeaveSettings,
  normalizeOptionalVaultFolderPath,
  normalizeProjectRoots,
} from './settings/project-weave-settings';
import type { ProjectWeaveSettings } from './settings/project-weave-settings';
import { ReadyNowModal } from './ui/ready-now-modal';
import { ProjectWeaveSettingTab } from './ui/settings-tab';

interface ProjectWeaveRuntime {
  readonly reader: ObsidianVaultReader;
  readonly coordinator: IndexCoordinator;
  readonly queryApi: ProjectWeaveQueryApi;
}

export default class ProjectWeavePlugin extends Plugin {
  public override settings: ProjectWeaveSettings =
    createDefaultProjectWeaveSettings();

  #runtime: ProjectWeaveRuntime | null = null;
  #unloaded = false;

  public override async onload(): Promise<void> {
    this.settings = loadProjectWeaveSettings(await this.loadData());
    this.#runtime = this.#createRuntime(this.settings.projectRoots);
    this.addSettingTab(new ProjectWeaveSettingTab(this.app, this));

    this.addCommand({
      id: 'open-ready-now',
      name: 'Open Ready Now',
      callback: () => {
        void this.#openReadyNow();
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
      void this.rebuildIndex(false);
    });
  }

  public override onunload(): void {
    this.#unloaded = true;
    this.#runtime?.coordinator.dispose();
    this.#runtime = null;
  }

  public async updateProjectRoots(
    projectRoots: readonly string[],
  ): Promise<void> {
    const normalized = normalizeProjectRoots(projectRoots);
    const nextSettings = { ...this.settings, projectRoots: normalized };
    await this.saveData(nextSettings);
    this.settings = nextSettings;

    const previous = this.#runtime;
    const next = this.#createRuntime(normalized);
    this.#runtime = next;
    previous?.coordinator.dispose();
    await this.#rebuildRuntime(next, false);
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
  }

  public async rebuildIndex(showSuccess: boolean): Promise<void> {
    const runtime = this.#runtime;
    if (runtime === null) {
      return;
    }
    await this.#rebuildRuntime(runtime, showSuccess);
  }

  #createRuntime(projectRoots: readonly string[]): ProjectWeaveRuntime {
    const reader = new ObsidianVaultReader(this.app.vault, projectRoots);
    const coordinator = new IndexCoordinator(reader, {
      linkResolver: new ObsidianLinkResolver(this.app.metadataCache),
    });
    return {
      reader,
      coordinator,
      queryApi: new ProjectWeaveQueryApi(() => coordinator.snapshot),
    };
  }

  #registerVaultEvents(): void {
    this.registerEvent(
      this.app.vault.on('create', (file) => {
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
  ): Promise<void> {
    try {
      await runtime.coordinator.rebuild();
      if (showSuccess && this.#runtime === runtime) {
        this.#showIndexStatus();
      }
    } catch (error) {
      console.error('Project Weave index rebuild failed', error);
      new Notice(
        'Project Weave could not rebuild its index. The vault was not changed.',
      );
    }
  }

  async #openReadyNow(): Promise<void> {
    const runtime = this.#runtime;
    if (runtime === null) {
      new Notice('Project Weave is not loaded.');
      return;
    }
    if (runtime.coordinator.snapshot.revision === 0) {
      new Notice('Project Weave is still indexing the vault.');
      return;
    }

    const project = inferProject(
      runtime.coordinator.snapshot.getEntity(
        this.app.workspace.getActiveFile()?.path ?? '',
      ),
      runtime.coordinator.snapshot
        .getEntities('project')
        .filter((entity): entity is ProjectEntity => entity.kind === 'project'),
    );
    if (project === null) {
      new Notice('Open a project or task note before running Ready Now.');
      return;
    }

    const result = await runtime.queryApi.getReadyNow({
      projectPath: project.path,
    });
    if (!result.ok) {
      new Notice(result.diagnostics[0]?.message ?? 'Ready Now is unavailable.');
      return;
    }
    new ReadyNowModal(this.app, result).open();
  }

  #showIndexStatus(): void {
    const snapshot = this.#runtime?.coordinator.snapshot;
    if (snapshot === undefined) {
      new Notice('Project Weave is not loaded.');
      return;
    }
    const entityCount = snapshot.getEntities().length;
    const errorCount = snapshot.diagnostics.filter(
      (issue) => issue.severity === 'error',
    ).length;
    new Notice(
      `Project Weave index ${snapshot.freshness}: ${String(entityCount)} entities, ${String(errorCount)} errors (revision ${String(snapshot.revision)}).`,
    );
  }
}

function isMarkdownFile(file: unknown): file is TFile {
  return file instanceof TFile && file.extension === 'md';
}

function inferProject(
  activeEntity: EntityRecord | undefined,
  projects: readonly ProjectEntity[],
): ProjectEntity | null {
  if (activeEntity?.kind === 'project') {
    return activeEntity;
  }
  if (activeEntity !== undefined) {
    const projectPath = activeEntity.project?.resolvedPath;
    const project = projects.find(
      (candidate) => candidate.path === projectPath,
    );
    if (project !== undefined) {
      return project;
    }
  }
  return projects.length === 1 ? (projects[0] ?? null) : null;
}
