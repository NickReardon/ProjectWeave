import { Setting } from 'obsidian';
import type { App } from 'obsidian';

import type { NoteCreationCommitResult } from '../application/note-creation-commit';
import type {
  ProjectCreationPreviewRequest,
  ProjectCreationPreviewResult,
} from '../application/project-creation-preview';
import type { ProjectCreationProposal } from '../application/project-creation-proposal';
import { CreationPreviewModal } from './creation-preview-modal';

/** Runs one preview against the current index publication. */
export type ProjectCreationPreviewRunner = (
  request: Omit<ProjectCreationPreviewRequest, 'clock'>,
) => Promise<ProjectCreationPreviewResult>;

/** Commits a previewed proposal; resolves to the created path or an error. */
export type ProjectCreationCommitRunner = (
  proposal: ProjectCreationProposal,
) => Promise<NoteCreationCommitResult>;

export interface ProjectCreationPreviewContext {
  /** The indexed project folders, in the order settings lists them. */
  readonly roots: readonly string[];
  readonly run: ProjectCreationPreviewRunner;
  readonly commit: ProjectCreationCommitRunner;
  /** Opens the created note; called only when the user asked for it. */
  readonly openNote: (path: string) => Promise<void>;
}

/**
 * The create-project form: a title, and which indexed folder to create it in.
 *
 * The folder chooser appears only when settings name more than one indexed
 * root. ADR 0012 left root selection to the UI precisely because there is
 * nothing to choose in the ordinary case.
 */
export class ProjectCreationPreviewModal extends CreationPreviewModal<ProjectCreationPreviewResult> {
  readonly #context: ProjectCreationPreviewContext;

  #title = '';
  #root: string;

  public constructor(app: App, context: ProjectCreationPreviewContext) {
    super(app);
    this.#context = context;
    this.#root = context.roots[0] ?? '';
  }

  protected override get modalTitle(): string {
    return 'Project Weave — Create project';
  }

  protected override get confirmLabel(): string {
    return 'Create project';
  }

  protected override get kindNoun(): string {
    return 'project';
  }

  protected override get summaryText(): string {
    return 'New project, in a folder of its own. Nothing is written until you choose Create project.';
  }

  protected override get hasTitle(): boolean {
    return this.#title.trim() !== '';
  }

  protected override renderFields(container: HTMLElement): void {
    new Setting(container)
      .setName('Title')
      .setDesc('Becomes the project folder name and the note title.')
      .addText((text) => {
        text.setPlaceholder('Travel Planner').onChange((value) => {
          this.#title = value;
          this.schedulePreview();
        });
        text.inputEl.focus();
      });

    if (this.#context.roots.length > 1) {
      new Setting(container)
        .setName('Indexed folder')
        .setDesc('Which indexed project folder holds the new project.')
        .addDropdown((dropdown) => {
          for (const root of this.#context.roots) {
            dropdown.addOption(root, root);
          }
          dropdown.setValue(this.#root).onChange((value) => {
            this.#root = value;
            this.schedulePreview();
          });
        });
    }
  }

  protected override async runPreview(): Promise<ProjectCreationPreviewResult> {
    return await this.#context.run({ root: this.#root, title: this.#title });
  }

  protected override async commitPreview(
    result: ProjectCreationPreviewResult & { ok: true },
  ): Promise<NoteCreationCommitResult> {
    return await this.#context.commit(result.proposal);
  }

  protected override async openNote(path: string): Promise<void> {
    await this.#context.openNote(path);
  }

  protected override facts(
    result: ProjectCreationPreviewResult & { ok: true },
  ): readonly (readonly [string, string])[] {
    return [
      ['Target path', result.allocation.targetPath],
      ['Project folder', result.allocation.projectFolder],
    ];
  }

  protected override failureFacts(
    result: ProjectCreationPreviewResult & { ok: false },
  ): readonly (readonly [string, string])[] {
    return result.allocation === null
      ? []
      : [['Target path', result.allocation.targetPath]];
  }

  protected override collisionNotice(
    result: ProjectCreationPreviewResult & { ok: true },
  ): string | null {
    return result.allocation.renamedForCollision
      ? 'A folder with the derived name is already in use, so a numbered folder is suggested. Nothing in it would be touched.'
      : null;
  }
}
