import {
  AbstractInputSuggest,
  Notice,
  PluginSettingTab,
  Setting,
  TFolder,
} from 'obsidian';
import type { App, SearchComponent } from 'obsidian';

import type ProjectWeavePlugin from '../main';
import {
  normalizeOptionalVaultFolderPath,
  normalizeProjectRoots,
  normalizeVaultFolderPath,
} from '../settings/project-weave-settings';

export class ProjectWeaveSettingTab extends PluginSettingTab {
  readonly #plugin: ProjectWeavePlugin;

  public constructor(app: App, plugin: ProjectWeavePlugin) {
    super(app, plugin);
    this.#plugin = plugin;
  }

  public override display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl).setName('Project Weave').setHeading();
    containerEl.createEl('p', {
      text: 'Choose which vault folders belong to Project Weave. Notes outside these folders are never read or diagnosed.',
    });

    new Setting(containerEl)
      .setName('Project workbench')
      .setDesc(
        'Open the persistent dashboard. Obsidian restores it with your workspace after it has been opened once.',
      )
      .addButton((button) =>
        button
          .setButtonText('Open dashboard')
          .setCta()
          .onClick(() => {
            void this.#openProjectWorkbench();
          }),
      );

    new Setting(containerEl).setName('Indexed project folders').setHeading();
    if (this.#plugin.settings.projectRoots.length === 0) {
      containerEl.createEl('p', {
        cls: 'setting-item-description',
        text: 'No project folders are selected, so the index is empty.',
      });
    }
    for (const root of this.#plugin.settings.projectRoots) {
      new Setting(containerEl)
        .setName(root)
        .setDesc('Vault-relative project folder')
        .addExtraButton((button) =>
          button
            .setIcon('trash')
            .setTooltip('Stop indexing this folder')
            .onClick(() => {
              void this.#removeProjectRoot(root);
            }),
        );
    }

    let projectRootCandidate = '';
    new Setting(containerEl)
      .setName('Add project folder')
      .setDesc(
        'Select an existing folder or enter a vault-relative path such as Projects/Game.',
      )
      .addSearch((search) => {
        projectRootCandidate = this.#configureFolderSearch(
          search,
          'Projects/Game',
          (value) => {
            projectRootCandidate = value;
          },
        );
      })
      .addButton((button) =>
        button
          .setButtonText('Add')
          .setCta()
          .onClick(() => {
            void this.#addProjectRoot(projectRootCandidate);
          }),
      );

    new Setting(containerEl).setName('Templates').setHeading();
    containerEl.createEl('p', {
      cls: 'setting-item-description',
      text: 'Templates in this folder are available to every project: one folder per kind, one file per variant, such as task/bug.md.',
    });

    let templateFolderCandidate = this.#plugin.settings.templateScaffoldFolder;
    new Setting(containerEl)
      .setName('Template library folder')
      .setDesc(
        'A vault-relative folder. Saving this preference does not create or modify any notes, and an empty value uses the packaged templates only.',
      )
      .addSearch((search) => {
        search.setValue(templateFolderCandidate);
        this.#configureFolderSearch(
          search,
          'Templates/Project Weave',
          (value) => {
            templateFolderCandidate = value;
          },
        );
      })
      .addButton((button) =>
        button.setButtonText('Save').onClick(() => {
          void this.#saveTemplateFolder(templateFolderCandidate);
        }),
      );

    new Setting(containerEl).setName('Task categories').setHeading();
    containerEl.createEl('p', {
      cls: 'setting-item-description',
      text: 'Optional grouping for tasks, such as bug or chore. Leave this empty to accept any value; list categories to have anything else reported as invalid. Obsidian suggests property values across the whole vault, so this list is vault-wide too.',
    });

    if (this.#plugin.settings.taskCategories.length === 0) {
      containerEl.createEl('p', {
        cls: 'setting-item-description',
        text: 'No categories are listed, so any value is accepted.',
      });
    }
    for (const category of this.#plugin.settings.taskCategories) {
      new Setting(containerEl)
        .setName(category)
        .setDesc('Allowed task category')
        .addExtraButton((button) =>
          button
            .setIcon('trash')
            .setTooltip('Stop allowing this category')
            .onClick(() => {
              void this.#removeTaskCategory(category);
            }),
        );
    }

    let categoryCandidate = '';
    new Setting(containerEl)
      .setName('Add category')
      .setDesc(
        'Tasks already using a value you remove are reported, not changed.',
      )
      .addText((text) => {
        text.setPlaceholder('bug').onChange((value) => {
          categoryCandidate = value;
        });
      })
      .addButton((button) =>
        button
          .setButtonText('Add')
          .setCta()
          .onClick(() => {
            void this.#addTaskCategory(categoryCandidate);
          }),
      );

    new Setting(containerEl).setName('Diagnostics').setHeading();
    containerEl.createEl('p', {
      cls: 'setting-item-description',
      text: 'Optionally write a derived diagnostics.json report after each index publication. The report contains no note bodies and is not indexed as a Project Weave entity.',
    });

    let diagnosticsLogFolderCandidate =
      this.#plugin.settings.diagnosticsLogFolder;
    new Setting(containerEl)
      .setName('Diagnostics log folder')
      .setDesc(
        'A vault-relative folder. Leave empty to disable the JSON export; the folder is created when the first complete index is published.',
      )
      .addSearch((search) => {
        search.setValue(diagnosticsLogFolderCandidate);
        this.#configureFolderSearch(search, 'Project Weave Logs', (value) => {
          diagnosticsLogFolderCandidate = value;
        });
      })
      .addButton((button) =>
        button.setButtonText('Save').onClick(() => {
          void this.#saveDiagnosticsLogFolder(diagnosticsLogFolderCandidate);
        }),
      );

    new Setting(containerEl)
      .setName('Rebuild index')
      .setDesc('Re-read only the selected project folders.')
      .addButton((button) =>
        button.setButtonText('Rebuild').onClick(() => {
          void this.#rebuildIndex();
        }),
      );

    new Setting(containerEl).setName('Agent access').setHeading();
    containerEl.createEl('p', {
      cls: 'setting-item-description',
      text: 'Optional desktop-only, read-only access for local agents. It opens no endpoint until enabled, and every connection needs a one-project grant secret.',
    });
    new Setting(containerEl)
      .setName('Read-only agent gateway')
      .setDesc(
        this.#plugin.agentGatewayEndpoint === null
          ? 'Disabled. No named pipe or socket is listening.'
          : `Listening locally at ${this.#plugin.agentGatewayEndpoint}`,
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.#plugin.settings.agentGatewayEnabled)
          .onChange((enabled) => {
            void this.#setAgentGatewayEnabled(enabled);
          }),
      );

    for (const grant of this.#plugin.settings.agentGrants) {
      new Setting(containerEl)
        .setName(grant.label)
        .setDesc(
          `Grant id ${grant.id} · ${grant.projectPath} · ${grant.contentRoots.length === 0 ? 'entity metadata only' : grant.contentRoots.join(', ')}`,
        )
        .addExtraButton((button) =>
          button
            .setIcon('trash')
            .setTooltip('Revoke this agent grant')
            .onClick(() => {
              void this.#removeAgentGrant(grant.id);
            }),
        );
    }

    let grantLabel = '';
    let grantProject = '';
    let grantRoots = '';
    new Setting(containerEl)
      .setName('Create agent grant')
      .setDesc(
        'The secret is copied to the clipboard once. Content folders are optional comma-separated vault paths for document reads.',
      )
      .addText((text) =>
        text.setPlaceholder('Repository name').onChange((value) => {
          grantLabel = value;
        }),
      )
      .addText((text) =>
        text.setPlaceholder('Projects/Game/Project.md').onChange((value) => {
          grantProject = value;
        }),
      )
      .addText((text) =>
        text.setPlaceholder('Projects/Game/Documents').onChange((value) => {
          grantRoots = value;
        }),
      )
      .addButton((button) =>
        button.setButtonText('Create and copy secret').onClick(() => {
          void this.#createAgentGrant(grantLabel, grantProject, grantRoots);
        }),
      );
  }

  #configureFolderSearch(
    search: SearchComponent,
    placeholder: string,
    onValue: (value: string) => void,
  ): string {
    search.setPlaceholder(placeholder).onChange(onValue);
    const suggest = new VaultFolderSuggest(this.app, search.inputEl);
    suggest.onSelect((folder) => {
      search.setValue(folder.path);
      onValue(folder.path);
    });
    return search.getValue();
  }

  async #addProjectRoot(value: string): Promise<void> {
    try {
      const normalized = normalizeVaultFolderPath(value);
      const projectRoots = normalizeProjectRoots([
        ...this.#plugin.settings.projectRoots,
        normalized,
      ]);
      if (projectRoots.length === this.#plugin.settings.projectRoots.length) {
        new Notice('Project Weave already indexes that folder.');
        return;
      }
      const rebuilt = await this.#plugin.updateProjectRoots(projectRoots);
      new Notice(
        rebuilt
          ? 'Project Weave project folder added and index rebuilt.'
          : 'Project Weave project folder added, but the index rebuild failed.',
      );
      this.display();
    } catch (error) {
      new Notice('Project Weave: ' + errorMessage(error));
    }
  }

  async #removeProjectRoot(root: string): Promise<void> {
    try {
      const rebuilt = await this.#plugin.updateProjectRoots(
        this.#plugin.settings.projectRoots.filter(
          (candidate) => candidate !== root,
        ),
      );
      new Notice(
        rebuilt
          ? 'Project Weave project folder removed and index rebuilt.'
          : 'Project Weave project folder removed, but the index rebuild failed.',
      );
      this.display();
    } catch (error) {
      new Notice('Project Weave: ' + errorMessage(error));
    }
  }

  async #saveTemplateFolder(value: string): Promise<void> {
    try {
      await this.#plugin.updateTemplateScaffoldFolder(
        normalizeOptionalVaultFolderPath(value),
      );
      new Notice('Project Weave template library folder saved.');
      this.display();
    } catch (error) {
      new Notice('Project Weave: ' + errorMessage(error));
    }
  }

  async #addTaskCategory(value: string): Promise<void> {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      new Notice('Project Weave: enter a category first.');
      return;
    }
    const existing = this.#plugin.settings.taskCategories;
    if (
      existing.some(
        (category) => category.toLowerCase() === trimmed.toLowerCase(),
      )
    ) {
      new Notice('Project Weave already allows that category.');
      return;
    }
    try {
      await this.#plugin.updateTaskCategories([...existing, trimmed]);
      new Notice('Project Weave task category added.');
      this.display();
    } catch (error) {
      new Notice('Project Weave: ' + errorMessage(error));
    }
  }

  async #removeTaskCategory(category: string): Promise<void> {
    try {
      await this.#plugin.updateTaskCategories(
        this.#plugin.settings.taskCategories.filter(
          (candidate) => candidate !== category,
        ),
      );
      new Notice('Project Weave task category removed.');
      this.display();
    } catch (error) {
      new Notice('Project Weave: ' + errorMessage(error));
    }
  }

  async #saveDiagnosticsLogFolder(value: string): Promise<void> {
    try {
      await this.#plugin.updateDiagnosticsLogFolder(value);
      new Notice('Project Weave diagnostics log folder saved.');
      this.display();
    } catch (error) {
      new Notice('Project Weave: ' + errorMessage(error));
    }
  }

  async #rebuildIndex(): Promise<void> {
    try {
      await this.#plugin.rebuildIndex(true);
    } catch {
      // The plugin reports a non-destructive rebuild failure.
    }
  }

  async #setAgentGatewayEnabled(enabled: boolean): Promise<void> {
    try {
      await this.#plugin.updateAgentGatewayEnabled(enabled);
      new Notice(
        enabled
          ? 'Project Weave read-only agent gateway enabled.'
          : 'Project Weave agent gateway disabled.',
      );
      this.display();
    } catch (error) {
      new Notice('Project Weave: ' + errorMessage(error));
      this.display();
    }
  }

  async #createAgentGrant(
    label: string,
    projectPath: string,
    roots: string,
  ): Promise<void> {
    try {
      const created = await this.#plugin.createAgentGrant({
        label,
        projectPath,
        contentRoots: roots
          .split(',')
          .map((root) => root.trim())
          .filter((root) => root.length > 0),
      });
      try {
        await navigator.clipboard.writeText(created.secret);
      } catch (error) {
        await this.#plugin.removeAgentGrant(created.grant.id);
        throw new Error(
          'The secret could not be copied, so the grant was not kept.',
          { cause: error },
        );
      }
      new Notice(
        `Project Weave grant created. Secret copied once; grant id ${created.grant.id}.`,
      );
      this.display();
    } catch (error) {
      new Notice('Project Weave: ' + errorMessage(error));
    }
  }

  async #removeAgentGrant(id: string): Promise<void> {
    try {
      await this.#plugin.removeAgentGrant(id);
      new Notice('Project Weave agent grant revoked.');
      this.display();
    } catch (error) {
      new Notice('Project Weave: ' + errorMessage(error));
    }
  }

  async #openProjectWorkbench(): Promise<void> {
    try {
      await this.#plugin.openProjectWorkbench();
    } catch {
      new Notice('Project Weave could not open its dashboard.');
    }
  }
}

class VaultFolderSuggest extends AbstractInputSuggest<TFolder> {
  protected override getSuggestions(query: string): TFolder[] {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return this.app.vault
      .getAllLoadedFiles()
      .filter((file): file is TFolder => file instanceof TFolder)
      .filter(
        (folder) =>
          folder.path.length > 0 &&
          folder.path !== '/' &&
          folder.path !== '.obsidian' &&
          !folder.path.startsWith('.obsidian/') &&
          (normalizedQuery.length === 0 ||
            folder.path.toLocaleLowerCase().includes(normalizedQuery)),
      )
      .sort((left, right) => left.path.localeCompare(right.path));
  }

  public override renderSuggestion(
    folder: TFolder,
    element: HTMLElement,
  ): void {
    element.setText(folder.path);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
