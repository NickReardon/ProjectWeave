import { Modal, Notice, Setting } from 'obsidian';
import type { App, ButtonComponent } from 'obsidian';

import type { ProjectSummary } from '../application/query-api';
import type { AgentGrant } from '../application/read-only-agent-gateway';
import {
  agentClientConfigurationJson,
  resolveAgentGrantForm,
  type AgentGrantScope,
} from './agent-grant-form';
import {
  ProjectPathSuggest,
  VaultFolderListSuggest,
  replaceLastListSegment,
  vaultFolderPaths,
} from './vault-suggest';

export interface AgentGrantCreationContext {
  readonly listIndexedProjects: () => Promise<readonly ProjectSummary[]>;
  /** `null` while the gateway is disabled; creation still works either way. */
  readonly endpoint: string | null;
  readonly createGrant: (input: {
    readonly label: string;
    readonly projectPath: string;
    readonly contentRoots: readonly string[];
  }) => Promise<{ readonly grant: AgentGrant; readonly secret: string }>;
  readonly removeGrant: (id: string) => Promise<void>;
  /** Called once the grant exists and its configuration has been copied. */
  readonly onCreated: () => void;
}

/**
 * Create-agent-grant dialog. A grant is immutable once created — see "Grant
 * lifecycle and creation" in `docs/spec/agent-access-and-mcp.md` — so a
 * mistake here can only be corrected by revoking and recreating, which is
 * why the create action stays unavailable until the chosen project and,
 * when note text is enabled, every chosen content folder resolve locally
 * against the vault. Resolution re-evaluates on every field change rather
 * than only on submit, and it never asks the gateway — the same local
 * checks apply whether the gateway is enabled or disabled.
 *
 * Creation stays atomic with copying the client configuration: pressing
 * create both creates the grant and copies its configuration in one step,
 * and the grant is rolled back if the clipboard write fails, so no grant can
 * exist without its configuration having been delivered.
 */
export class AgentGrantCreationModal extends Modal {
  readonly #context: AgentGrantCreationContext;

  #label = '';
  #projectPath = '';
  #scope: AgentGrantScope = 'metadata';
  #contentRootsRaw = '';
  #indexedProjects: readonly ProjectSummary[] = [];
  #creating = false;
  #createButton: ButtonComponent | null = null;
  #statusEl: HTMLElement | null = null;
  #contentRootsContainer: HTMLElement | null = null;

  public constructor(app: App, context: AgentGrantCreationContext) {
    super(app);
    this.#context = context;
  }

  public override onOpen(): void {
    this.setTitle('Project Weave — Create agent grant');
    this.contentEl.empty();
    this.contentEl.addClass('project-weave-agent-grant-modal');

    this.contentEl.createEl('p', {
      cls: 'project-weave-agent-grant-modal__summary',
      text: 'Nothing is created until you choose Create grant. A grant is immutable once created — correcting one means revoking it and creating a replacement.',
    });

    this.#renderLabelField();
    this.#renderProjectField();
    this.#renderScopeField();
    this.#contentRootsContainer = this.contentEl.createDiv();
    this.#renderContentRootsField();

    new Setting(this.contentEl).addButton((button) => {
      button
        .setButtonText('Create grant')
        .setCta()
        .onClick(() => {
          void this.#create();
        });
      // Keep the component, not its element, so the disabled state is driven
      // through Obsidian's own API in both directions.
      this.#createButton = button;
    });
    this.#statusEl = this.contentEl.createDiv({
      cls: 'project-weave-agent-grant-modal__status',
    });

    this.#refresh();
    void this.#loadIndexedProjects();
  }

  public override onClose(): void {
    this.#createButton = null;
    this.#statusEl = null;
    this.#contentRootsContainer = null;
    this.contentEl.empty();
  }

  async #loadIndexedProjects(): Promise<void> {
    try {
      this.#indexedProjects = await this.#context.listIndexedProjects();
    } catch (error) {
      console.error('Project Weave could not list indexed projects', error);
      this.#indexedProjects = [];
    }
    this.#refresh();
  }

  #renderLabelField(): void {
    new Setting(this.contentEl)
      .setName('Which tool is this for')
      .setDesc(
        'A free-text name for recognizing this grant later, when deciding whether to revoke it — the client or tool it serves. Required: only you know which tool this is for, so there is no default.',
      )
      .addText((text) => {
        text.setPlaceholder('Claude Desktop').onChange((value) => {
          this.#label = value;
          this.#refresh();
        });
        text.inputEl.focus();
      });
  }

  #renderProjectField(): void {
    new Setting(this.contentEl)
      .setName('Project')
      .setDesc('The one indexed project this grant may read. Required.')
      .addSearch((search) => {
        search.setPlaceholder('Projects/Game/Project.md').onChange((value) => {
          this.#projectPath = value;
          this.#refresh();
        });
        const suggest = new ProjectPathSuggest(this.app, search.inputEl, () =>
          this.#context.listIndexedProjects(),
        );
        suggest.onSelect((project) => {
          search.setValue(project.ref.path);
          this.#projectPath = project.ref.path;
          this.#refresh();
        });
      });
  }

  #renderScopeField(): void {
    new Setting(this.contentEl)
      .setName('What this grant can read')
      .setDesc(
        'Metadata only reads titles, statuses, structure, and links. Metadata and note text additionally exposes Markdown bodies under folders you choose below — this is the actual permission boundary, so it is a deliberate choice rather than left to an empty field.',
      )
      .addDropdown((dropdown) => {
        dropdown
          .addOption('metadata', 'Metadata only')
          .addOption('content', 'Metadata and note text')
          .setValue(this.#scope)
          .onChange((value) => {
            this.#scope = value === 'content' ? 'content' : 'metadata';
            this.#renderContentRootsField();
            this.#refresh();
          });
      });
  }

  #renderContentRootsField(): void {
    const container = this.#contentRootsContainer;
    if (container === null) {
      return;
    }
    container.empty();
    if (this.#scope !== 'content') {
      return;
    }
    new Setting(container)
      .setName('Content folders')
      .setDesc(
        'Vault folders whose Markdown bodies this grant can read. At least one is required while note text is enabled — an empty list does not resolve.',
      )
      .addSearch((search) => {
        search.setValue(this.#contentRootsRaw);
        search.setPlaceholder('Projects/Game/Documents').onChange((value) => {
          this.#contentRootsRaw = value;
          this.#refresh();
        });
        const suggest = new VaultFolderListSuggest(this.app, search.inputEl);
        suggest.onSelect((folder) => {
          const merged = replaceLastListSegment(search.getValue(), folder.path);
          search.setValue(merged);
          this.#contentRootsRaw = merged;
          this.#refresh();
        });
      });
  }

  #resolve() {
    return resolveAgentGrantForm(
      {
        label: this.#label,
        projectPath: this.#projectPath,
        scope: this.#scope,
        contentRootsRaw: this.#contentRootsRaw,
      },
      (path) =>
        this.#indexedProjects.some((project) => project.ref.path === path),
      (path) => vaultFolderPaths(this.app).has(path),
    );
  }

  /**
   * Called on every field change: re-evaluates resolution and reflects it in
   * both the button and the status text, so an unresolved value is named
   * rather than left to a disabled button the user cannot ask about.
   */
  #refresh(): void {
    this.#syncButton();
    if (!this.#creating) {
      const resolution = this.#resolve();
      this.#setStatus(resolution.ready ? '' : (resolution.problem ?? ''));
    }
  }

  /**
   * Button-only sync, used while a create attempt is in flight or has just
   * failed — it must not overwrite the creation status message with the
   * (possibly now-ready) field resolution, which `#refresh` would do.
   */
  #syncButton(): void {
    const resolution = this.#resolve();
    const button = this.#createButton;
    if (button === null) {
      return;
    }
    const ready = resolution.ready && !this.#creating;
    button.setDisabled(!ready);
    button.setButtonText(this.#creating ? 'Creating…' : 'Create grant');
    button.buttonEl.title = ready
      ? 'Create this grant'
      : (resolution.problem ?? 'This grant cannot be created yet.');
  }

  #setStatus(text: string, tone: 'error' | 'info' = 'error'): void {
    const status = this.#statusEl;
    if (status === null) {
      return;
    }
    status.empty();
    status.classList.toggle(
      'project-weave-agent-grant-modal__status--error',
      tone === 'error',
    );
    if (text.length === 0) {
      return;
    }
    status.createEl('p', { text });
  }

  async #create(): Promise<void> {
    if (this.#creating) {
      return;
    }
    const resolution = this.#resolve();
    if (!resolution.ready) {
      this.#setStatus(
        resolution.problem ?? 'This grant cannot be created yet.',
      );
      return;
    }
    this.#creating = true;
    this.#refresh();
    this.#setStatus('Creating…', 'info');
    try {
      const created = await this.#context.createGrant({
        label: this.#label,
        projectPath: this.#projectPath.trim(),
        contentRoots: resolution.contentRoots,
      });
      const configuration = agentClientConfigurationJson({
        endpoint: this.#context.endpoint,
        grantId: created.grant.id,
        secret: created.secret,
      });
      try {
        await navigator.clipboard.writeText(configuration);
      } catch (error) {
        await this.#context.removeGrant(created.grant.id);
        throw new Error(
          'The client configuration could not be copied, so the grant was not kept.',
          { cause: error },
        );
      }
      this.close();
      new Notice(
        `Project Weave grant created. Client configuration copied once; grant id ${created.grant.id}.`,
      );
      this.#context.onCreated();
    } catch (error) {
      this.#setStatus('Project Weave: ' + errorMessage(error));
      this.#creating = false;
      this.#syncButton();
      return;
    }
    this.#creating = false;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
