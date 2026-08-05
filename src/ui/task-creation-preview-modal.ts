import { Setting } from 'obsidian';
import type { App } from 'obsidian';

import type { NoteCreationCommitResult } from '../application/note-creation-commit';
import type {
  TaskCreationPreviewRequest,
  TaskCreationPreviewResult,
} from '../application/task-creation-preview';
import type { TaskCreationProposal } from '../application/task-creation-proposal';
import { CreationPreviewModal } from './creation-preview-modal';

/** Runs one preview against the current index publication. */
export type TaskCreationPreviewRunner = (
  request: Omit<TaskCreationPreviewRequest, 'projectPath' | 'clock'>,
) => Promise<TaskCreationPreviewResult>;

/** Commits a previewed proposal; resolves to the created path or an error. */
export type TaskCreationCommitRunner = (
  proposal: TaskCreationProposal,
) => Promise<NoteCreationCommitResult>;

export interface TaskCreationPreviewContext {
  readonly projectTitle: string;
  readonly projectPath: string;
  readonly run: TaskCreationPreviewRunner;
  readonly commit: TaskCreationCommitRunner;
  /** Opens the created note; called only when the user asked for it. */
  readonly openNote: (path: string) => Promise<void>;
}

/**
 * The create-task form: a title that becomes a filename, an optional subfolder
 * beneath the project's task folder, and whether the task starts on the board.
 * Everything after the form — preview, confirmation, and the one write path —
 * belongs to `CreationPreviewModal`.
 */
export class TaskCreationPreviewModal extends CreationPreviewModal<TaskCreationPreviewResult> {
  readonly #context: TaskCreationPreviewContext;

  #title = '';
  #subfolder = '';
  #createOnBoard = false;

  public constructor(app: App, context: TaskCreationPreviewContext) {
    super(app);
    this.#context = context;
  }

  protected override get modalTitle(): string {
    return 'Project Weave — Create task';
  }

  protected override get confirmLabel(): string {
    return 'Create task';
  }

  protected override get kindNoun(): string {
    return 'task';
  }

  protected override get summaryText(): string {
    return `New task in ${this.#context.projectTitle}. Nothing is written until you choose Create task.`;
  }

  protected override get hasTitle(): boolean {
    return this.#title.trim() !== '';
  }

  protected override renderFields(container: HTMLElement): void {
    new Setting(container)
      .setName('Title')
      .setDesc(
        'Becomes the note filename after unsafe characters are replaced.',
      )
      .addText((text) => {
        text.setPlaceholder('Implement request').onChange((value) => {
          this.#title = value;
          this.schedulePreview();
        });
        text.inputEl.focus();
      });

    new Setting(container)
      .setName('Subfolder')
      .setDesc('Optional folder beneath the project task folder.')
      .addText((text) => {
        text.setPlaceholder('Combat').onChange((value) => {
          this.#subfolder = value;
          this.schedulePreview();
        });
      });

    new Setting(container)
      .setName('Create directly on board')
      .setDesc('Starts the task in todo instead of backlog.')
      .addToggle((toggle) => {
        toggle.setValue(false).onChange((value) => {
          this.#createOnBoard = value;
          this.schedulePreview();
        });
      });
  }

  protected override async runPreview(): Promise<TaskCreationPreviewResult> {
    return await this.#context.run({
      title: this.#title,
      ...(this.#subfolder.trim() === '' ? {} : { subfolder: this.#subfolder }),
      createOnBoard: this.#createOnBoard,
    });
  }

  protected override async commitPreview(
    result: TaskCreationPreviewResult & { ok: true },
  ): Promise<NoteCreationCommitResult> {
    return await this.#context.commit(result.proposal);
  }

  protected override async openNote(path: string): Promise<void> {
    await this.#context.openNote(path);
  }

  protected override facts(
    result: TaskCreationPreviewResult & { ok: true },
  ): readonly (readonly [string, string])[] {
    return [
      ['Target path', result.allocation.targetPath],
      ['Rank', String(result.allocation.rank)],
    ];
  }

  protected override failureFacts(
    result: TaskCreationPreviewResult & { ok: false },
  ): readonly (readonly [string, string])[] {
    return result.allocation === null
      ? []
      : [
          ['Target path', result.allocation.targetPath],
          ['Rank', String(result.allocation.rank)],
        ];
  }

  protected override collisionNotice(
    result: TaskCreationPreviewResult & { ok: true },
  ): string | null {
    return result.allocation.renamedForCollision
      ? 'A note with the derived name already exists, so a numbered name is suggested. Nothing would be overwritten.'
      : null;
  }
}
