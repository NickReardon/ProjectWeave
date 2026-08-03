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
      text: 'Project-specific template mappings remain portable in each project note. This local folder is the default destination for future template scaffolding.',
    });

    let templateFolderCandidate = this.#plugin.settings.templateScaffoldFolder;
    new Setting(containerEl)
      .setName('Template scaffold folder')
      .setDesc(
        'A vault-relative folder. Saving this preference does not create or modify any notes.',
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

    new Setting(containerEl)
      .setName('Rebuild index')
      .setDesc('Re-read only the selected project folders.')
      .addButton((button) =>
        button.setButtonText('Rebuild').onClick(() => {
          void this.#rebuildIndex();
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
      await this.#plugin.updateProjectRoots(projectRoots);
      new Notice('Project Weave project folder added and index rebuilt.');
      this.display();
    } catch (error) {
      new Notice('Project Weave: ' + errorMessage(error));
    }
  }

  async #removeProjectRoot(root: string): Promise<void> {
    try {
      await this.#plugin.updateProjectRoots(
        this.#plugin.settings.projectRoots.filter(
          (candidate) => candidate !== root,
        ),
      );
      new Notice('Project Weave project folder removed and index rebuilt.');
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
      new Notice('Project Weave template scaffold folder saved.');
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
