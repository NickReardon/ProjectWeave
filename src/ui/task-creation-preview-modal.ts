import { Modal, Setting } from 'obsidian';
import type { App } from 'obsidian';

import type {
  TaskCreationPreviewRequest,
  TaskCreationPreviewResult,
} from '../application/task-creation-preview';
import type { Diagnostic } from '../domain/model';

/** Pause after typing before a preview runs. */
const PREVIEW_DEBOUNCE_MS = 250;

/** Runs one preview against the current index publication. */
export type TaskCreationPreviewRunner = (
  request: Omit<TaskCreationPreviewRequest, 'projectPath' | 'clock'>,
) => Promise<TaskCreationPreviewResult>;

export interface TaskCreationPreviewContext {
  readonly projectTitle: string;
  readonly projectPath: string;
  readonly run: TaskCreationPreviewRunner;
}

/**
 * Shows exactly what creating one task would produce: the allocated path and
 * rank, the resolved template, the preconditions that must hold, the rendered
 * bytes, and the expected postconditions.
 *
 * The modal cannot create anything. Project Weave has no write coordinator, so
 * there is deliberately no confirm action here — offering one that silently did
 * nothing, or that wrote without commit-time staleness checks, would be worse
 * than offering none.
 */
export class TaskCreationPreviewModal extends Modal {
  readonly #context: TaskCreationPreviewContext;

  #title = '';
  #subfolder = '';
  #createOnBoard = false;
  #result: TaskCreationPreviewResult | null = null;
  #pending = 0;
  #debounce: number | null = null;
  #outputEl: HTMLElement | null = null;

  public constructor(app: App, context: TaskCreationPreviewContext) {
    super(app);
    this.#context = context;
  }

  public override onOpen(): void {
    this.setTitle('Project Weave — Preview task creation');
    this.contentEl.empty();
    this.contentEl.addClass('project-weave-task-preview');

    this.contentEl.createEl('p', {
      cls: 'project-weave-task-preview__summary',
      text: `Previewing a new task in ${this.#context.projectTitle}. Nothing is written.`,
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

    this.#outputEl = this.contentEl.createDiv({
      cls: 'project-weave-task-preview__output',
    });
    this.#renderOutput();
  }

  public override onClose(): void {
    // Abandons any in-flight preview: a later response must not repopulate a
    // closed modal, and an uncommitted draft is never authorization to write.
    this.#pending += 1;
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

  #renderOutput(): void {
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
      text: 'Project Weave cannot create this note yet. Task creation lands with the write coordinator.',
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
