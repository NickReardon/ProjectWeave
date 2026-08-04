import { Modal, Notice, Setting } from 'obsidian';
import type { App } from 'obsidian';

import type {
  TaskCreationPreviewRequest,
  TaskCreationPreviewResult,
} from '../application/task-creation-preview';
import type { TaskCreationCommitResult } from '../application/task-creation-commit';
import type { TaskCreationProposal } from '../application/task-creation-proposal';
import type { Diagnostic } from '../domain/model';

/** Pause after typing before a preview runs. */
const PREVIEW_DEBOUNCE_MS = 250;

/** Runs one preview against the current index publication. */
export type TaskCreationPreviewRunner = (
  request: Omit<TaskCreationPreviewRequest, 'projectPath' | 'clock'>,
) => Promise<TaskCreationPreviewResult>;

/** Commits a previewed proposal; resolves to the created path or an error. */
export type TaskCreationCommitRunner = (
  proposal: TaskCreationProposal,
) => Promise<TaskCreationCommitResult>;

export interface TaskCreationPreviewContext {
  readonly projectTitle: string;
  readonly projectPath: string;
  readonly run: TaskCreationPreviewRunner;
  readonly commit: TaskCreationCommitRunner;
  /** Opens the created note; called only when the user asked for it. */
  readonly openNote: (path: string) => Promise<void>;
}

/**
 * Shows exactly what creating one task would produce: the allocated path and
 * rank, the resolved template, the preconditions that must hold, the rendered
 * bytes, and the expected postconditions.
 *
 * Creation is a separate, explicit action. The confirm button names what it
 * will do and is disabled until a valid proposal exists, so nothing is written
 * by dismissing the modal or by pressing an unlabelled control. The commit
 * re-checks its inputs before writing, so a proposal that went stale while the
 * modal sat open is refused rather than silently written.
 */
export class TaskCreationPreviewModal extends Modal {
  readonly #context: TaskCreationPreviewContext;

  #title = '';
  #subfolder = '';
  #createOnBoard = false;
  #openAfterCreate = false;
  #result: TaskCreationPreviewResult | null = null;
  #pending = 0;
  #debounce: number | null = null;
  #committing = false;
  #outputEl: HTMLElement | null = null;
  #createButton: HTMLButtonElement | null = null;
  #statusEl: HTMLElement | null = null;

  public constructor(app: App, context: TaskCreationPreviewContext) {
    super(app);
    this.#context = context;
  }

  public override onOpen(): void {
    this.setTitle('Project Weave — Create task');
    this.contentEl.empty();
    this.contentEl.addClass('project-weave-task-preview');

    this.contentEl.createEl('p', {
      cls: 'project-weave-task-preview__summary',
      text: `New task in ${this.#context.projectTitle}. Nothing is written until you choose Create task.`,
    });

    new Setting(this.contentEl)
      .setName('Title')
      .setDesc(
        'Becomes the note filename after unsafe characters are replaced.',
      )
      .addText((text) => {
        text.setPlaceholder('Implement request').onChange((value) => {
          this.#title = value;
          this.#schedulePreview();
        });
        text.inputEl.focus();
      });

    new Setting(this.contentEl)
      .setName('Subfolder')
      .setDesc('Optional folder beneath the project task folder.')
      .addText((text) => {
        text.setPlaceholder('Combat').onChange((value) => {
          this.#subfolder = value;
          this.#schedulePreview();
        });
      });

    new Setting(this.contentEl)
      .setName('Create directly on board')
      .setDesc('Starts the task in todo instead of backlog.')
      .addToggle((toggle) => {
        toggle.setValue(false).onChange((value) => {
          this.#createOnBoard = value;
          this.#schedulePreview();
        });
      });

    new Setting(this.contentEl)
      .setName('Open the note after creating it')
      .setDesc('Otherwise the note is created without changing your view.')
      .addToggle((toggle) => {
        toggle.setValue(false).onChange((value) => {
          this.#openAfterCreate = value;
        });
      });

    this.#outputEl = this.contentEl.createDiv({
      cls: 'project-weave-task-preview__output',
    });

    const actions = new Setting(this.contentEl);
    actions.addButton((button) => {
      button
        .setButtonText('Create task')
        .setCta()
        .onClick(() => {
          void this.#create();
        });
      button.setDisabled(true);
      this.#createButton = button.buttonEl;
    });
    this.#statusEl = this.contentEl.createDiv({
      cls: 'project-weave-task-preview__status',
    });

    this.#renderOutput();
  }

  public override onClose(): void {
    // Abandons any in-flight preview: a later response must not repopulate a
    // closed modal, and an uncommitted draft is never authorization to write.
    this.#pending += 1;
    this.#committing = false;
    this.#createButton = null;
    this.#statusEl = null;
    if (this.#debounce !== null) {
      window.clearTimeout(this.#debounce);
      this.#debounce = null;
    }
    this.#result = null;
    this.#outputEl = null;
    this.contentEl.empty();
  }

  /**
   * Coalesce keystrokes before previewing. Rebuilding the output while the
   * user is still typing rewrites DOM on every character, which is both
   * wasteful and disruptive to the field being typed into; waiting for a pause
   * means the form is untouched while input is in flight.
   */
  #schedulePreview(): void {
    const token = (this.#pending += 1);
    if (this.#debounce !== null) {
      window.clearTimeout(this.#debounce);
    }
    this.#debounce = window.setTimeout(() => {
      this.#debounce = null;
      this.#runPreview(token);
    }, PREVIEW_DEBOUNCE_MS);
  }

  #runPreview(token: number): void {
    void this.#context
      .run({
        title: this.#title,
        ...(this.#subfolder.trim() === ''
          ? {}
          : { subfolder: this.#subfolder }),
        createOnBoard: this.#createOnBoard,
      })
      .then((result) => {
        if (token !== this.#pending || this.#outputEl === null) {
          return;
        }
        this.#result = result;
        this.#renderOutput();
      })
      .catch((error: unknown) => {
        console.error('Project Weave could not build a task preview', error);
        if (token !== this.#pending || this.#outputEl === null) {
          return;
        }
        this.#result = null;
        this.#renderOutput();
      });
  }

  /**
   * Commit the currently previewed proposal.
   *
   * Guarded against a double submit, and it never reuses a stale proposal
   * silently: the commit service re-checks the read set and target, and any
   * refusal is surfaced here with the vault untouched.
   */
  async #create(): Promise<void> {
    const result = this.#result;
    if (this.#committing || result === null || !result.ok) {
      return;
    }
    this.#committing = true;
    this.#syncCreateButton();
    this.#setStatus('Creating…');

    try {
      const outcome = await this.#context.commit(result.proposal);
      if (!outcome.ok) {
        this.#setStatus(
          outcome.diagnostics[0]?.message ?? 'The task was not created.',
          'error',
        );
        // Re-preview so the user sees the current situation, not the stale one.
        this.#schedulePreview();
        return;
      }

      const created = outcome.created_path;
      this.close();
      new Notice('Created ' + created);
      if (this.#openAfterCreate) {
        await this.#context.openNote(created);
      }
    } catch (error) {
      console.error('Project Weave could not create the task', error);
      this.#setStatus(
        'Project Weave could not create the task. Nothing was written.',
        'error',
      );
    } finally {
      this.#committing = false;
      this.#syncCreateButton();
    }
  }

  #syncCreateButton(): void {
    const button = this.#createButton;
    if (button === null) {
      return;
    }
    const ready = this.#result?.ok === true && !this.#committing;
    button.disabled = !ready;
    button.setText(this.#committing ? 'Creating…' : 'Create task');
  }

  #setStatus(text: string, tone: 'error' | 'info' = 'info'): void {
    const status = this.#statusEl;
    if (status === null) {
      return;
    }
    status.empty();
    if (text.length === 0) {
      return;
    }
    status.createEl('p', {
      cls:
        'project-weave-task-preview__status-text' +
        (tone === 'error'
          ? ' project-weave-task-preview__status-text--error'
          : ''),
      text,
    });
  }

  #renderOutput(): void {
    this.#syncCreateButton();
    const container = this.#outputEl;
    if (container === null) {
      return;
    }
    container.empty();

    if (this.#title.trim() === '') {
      container.createEl('p', {
        cls: 'project-weave-task-preview__hint',
        text: 'Enter a title to see the note that would be created.',
      });
      return;
    }

    const result = this.#result;
    if (result === null) {
      container.createEl('p', {
        cls: 'project-weave-task-preview__hint',
        text: 'Building preview…',
      });
      return;
    }

    if (!result.ok) {
      if (result.allocation !== null) {
        this.#renderFacts(container, [
          ['Target path', result.allocation.targetPath],
          ['Rank', String(result.allocation.rank)],
        ]);
      }
      this.#renderDiagnostics(container, result.diagnostics);
      return;
    }

    const { allocation, proposal } = result;
    this.#renderFacts(container, [
      ['Action', proposal.action],
      ['Target path', allocation.targetPath],
      ['Rank', String(allocation.rank)],
      [
        'Template',
        `${proposal.template.reference} (${proposal.template.source})`,
      ],
      ['Index revision', String(result.index_revision)],
      [
        'Rendered note',
        `${String(result.lineCount)} lines · ${String(result.byteLength)} bytes`,
      ],
    ]);

    if (allocation.renamedForCollision) {
      container.createEl('p', {
        cls: 'project-weave-task-preview__notice',
        text: 'A note with the derived name already exists, so a numbered name is suggested. Nothing would be overwritten.',
      });
    }

    this.#renderList(
      container,
      'Preconditions',
      proposal.preconditions.map((item) => `${item.kind}: ${item.path}`),
    );
    this.#renderList(
      container,
      'Expected afterwards',
      proposal.expected_postconditions.map(
        (item) => `${item.entity} indexed at ${item.path}`,
      ),
    );
    this.#renderList(
      container,
      'Read set',
      proposal.read_set.map((item) => `${item.role}: ${item.path}`),
    );

    this.#renderSection(container, 'Exact note contents').createEl('pre', {
      cls: 'project-weave-task-preview__content',
      text: result.content,
    });

    this.#renderDiagnostics(container, result.diagnostics);

    container.createEl('p', {
      cls: 'project-weave-task-preview__notice',
      text: 'Creating writes exactly these bytes to that path. Existing notes are never modified or overwritten.',
    });
  }

  #renderFacts(
    container: HTMLElement,
    facts: readonly (readonly [string, string])[],
  ): void {
    const list = container.createEl('dl', {
      cls: 'project-weave-task-preview__facts',
    });
    for (const [term, value] of facts) {
      list.createEl('dt', { text: term });
      list.createEl('dd', { text: value });
    }
  }

  #renderList(
    container: HTMLElement,
    heading: string,
    items: readonly string[],
  ): void {
    if (items.length === 0) {
      return;
    }
    const list = this.#renderSection(container, heading).createEl('ul', {
      cls: 'project-weave-task-preview__list',
    });
    for (const item of items) {
      list.createEl('li', { text: item });
    }
  }

  #renderDiagnostics(
    container: HTMLElement,
    diagnostics: readonly Diagnostic[],
  ): void {
    if (diagnostics.length === 0) {
      return;
    }
    const section = this.#renderSection(container, 'Diagnostics');
    const list = section.createEl('ul', {
      cls: 'project-weave-task-preview__list',
    });
    for (const issue of diagnostics) {
      const row = list.createEl('li', {
        cls: `project-weave-task-preview__diagnostic--${issue.severity}`,
      });
      row.createDiv({ text: `${issue.code}: ${issue.message}` });
      if (issue.recovery !== undefined) {
        row.createDiv({
          cls: 'project-weave-task-preview__recovery',
          text: issue.recovery,
        });
      }
    }
  }

  #renderSection(container: HTMLElement, heading: string): HTMLElement {
    const section = container.createDiv({
      cls: 'project-weave-task-preview__section',
    });
    section.createEl('h3', {
      cls: 'project-weave-task-preview__heading',
      text: heading,
    });
    return section;
  }
}
