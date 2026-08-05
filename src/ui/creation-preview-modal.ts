import { Modal, Notice, Setting } from 'obsidian';
import type { App, ButtonComponent } from 'obsidian';

import type { NoteCreationCommitResult } from '../application/note-creation-commit';
import type { Diagnostic } from '../domain/model';

/** Pause after typing before a preview runs. */
const PREVIEW_DEBOUNCE_MS = 250;

/** What every creation preview shows, whichever kind is being created. */
export interface CreationPreviewSuccessLike {
  readonly ok: true;
  readonly index_revision: number;
  readonly proposal: {
    readonly action: string;
    readonly template: {
      readonly reference: string;
      readonly source: string;
    };
    readonly preconditions: readonly {
      readonly kind: string;
      readonly path: string;
    }[];
    readonly expected_postconditions: readonly {
      readonly entity: string;
      readonly path: string;
    }[];
    readonly read_set: readonly {
      readonly role: string;
      readonly path: string;
    }[];
  };
  readonly content: string;
  readonly byteLength: number;
  readonly lineCount: number;
  readonly diagnostics: readonly Diagnostic[];
}

export interface CreationPreviewFailureLike {
  readonly ok: false;
  readonly diagnostics: readonly Diagnostic[];
}

export type CreationPreviewLike =
  CreationPreviewSuccessLike | CreationPreviewFailureLike;

/**
 * Shows exactly what creating one note would produce: the allocated path, the
 * resolved template, the preconditions that must hold, the rendered bytes, and
 * the expected postconditions.
 *
 * Creation is a separate, explicit action. The confirm button names what it
 * will do and is disabled until a valid proposal exists, so nothing is written
 * by dismissing the modal or by pressing an unlabelled control. The commit
 * re-checks its inputs before writing, so a proposal that went stale while the
 * modal sat open is refused rather than silently written.
 *
 * Everything specific to a kind — its fields, the facts worth showing, and
 * which commit path takes the proposal — is left to a subclass. What is shared
 * is the part where a mistake writes the wrong bytes.
 */
export abstract class CreationPreviewModal<
  TResult extends CreationPreviewLike,
> extends Modal {
  #openAfterCreate = false;
  #result: TResult | null = null;
  #pending = 0;
  #debounce: number | null = null;
  #committing = false;
  #outputEl: HTMLElement | null = null;
  #createButton: ButtonComponent | null = null;
  #statusEl: HTMLElement | null = null;

  public constructor(app: App) {
    super(app);
  }

  /** Title of the modal window, such as `Project Weave — Create task`. */
  protected abstract get modalTitle(): string;

  /** Label of the confirm button, such as `Create task`. */
  protected abstract get confirmLabel(): string;

  /** One line under the title saying what will happen, and that nothing has. */
  protected abstract get summaryText(): string;

  /** The noun used when explaining why nothing can be created yet. */
  protected abstract get kindNoun(): string;

  /** Builds the kind's own fields. Each change should call `schedulePreview`. */
  protected abstract renderFields(container: HTMLElement): void;

  /** Runs one preview against the current index publication. */
  protected abstract runPreview(): Promise<TResult>;

  /** Commits the previewed proposal through the one write path. */
  protected abstract commitPreview(
    result: TResult & { ok: true },
  ): Promise<NoteCreationCommitResult>;

  /** Opens the created note; called only when the user asked for it. */
  protected abstract openNote(path: string): Promise<void>;

  /** True once the form carries enough to preview anything. */
  protected abstract get hasTitle(): boolean;

  /** Kind-specific rows shown above the shared ones. */
  protected abstract facts(
    result: TResult & { ok: true },
  ): readonly (readonly [string, string])[];

  /**
   * Rows worth showing even though the preview failed, such as a path that was
   * allocated before something later refused. Abstract rather than defaulted:
   * a kind that shows nothing here should say so deliberately.
   */
  protected abstract failureFacts(
    result: TResult & { ok: false },
  ): readonly (readonly [string, string])[];

  /** A notice about the allocation, such as a name changed for a collision. */
  protected abstract collisionNotice(
    result: TResult & { ok: true },
  ): string | null;

  public override onOpen(): void {
    this.setTitle(this.modalTitle);
    this.contentEl.empty();
    this.contentEl.addClass('project-weave-creation-preview');

    this.contentEl.createEl('p', {
      cls: 'project-weave-creation-preview__summary',
      text: this.summaryText,
    });

    this.renderFields(this.contentEl);

    new Setting(this.contentEl)
      .setName('Open the note after creating it')
      .setDesc('Otherwise the note is created without changing your view.')
      .addToggle((toggle) => {
        toggle.setValue(false).onChange((value) => {
          this.#openAfterCreate = value;
        });
      });

    this.#outputEl = this.contentEl.createDiv({
      cls: 'project-weave-creation-preview__output',
    });

    new Setting(this.contentEl).addButton((button) => {
      button
        .setButtonText(this.confirmLabel)
        .setCta()
        .onClick(() => {
          void this.#create();
        });
      // Keep the component, not its element. Driving the disabled state
      // through Obsidian's own API in both directions avoids a button that is
      // disabled by the component but re-enabled only on the raw element.
      this.#createButton = button;
    });
    this.#statusEl = this.contentEl.createDiv({
      cls: 'project-weave-creation-preview__status',
    });

    this.renderOutput();
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
  protected schedulePreview(): void {
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
    void this.runPreview()
      .then((result) => {
        if (token !== this.#pending || this.#outputEl === null) {
          return;
        }
        this.#result = result;
        this.renderOutput();
      })
      .catch((error: unknown) => {
        console.error(
          `Project Weave could not build a ${this.kindNoun} preview`,
          error,
        );
        if (token !== this.#pending || this.#outputEl === null) {
          return;
        }
        this.#result = null;
        this.renderOutput();
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
    if (this.#committing) {
      return;
    }
    // Never return silently: a click that does nothing is indistinguishable
    // from a broken button.
    if (result === null) {
      this.#setStatus(
        this.hasTitle
          ? 'Still preparing the preview — try again in a moment.'
          : 'Enter a title first.',
        'error',
      );
      return;
    }
    if (!result.ok) {
      this.#setStatus(
        result.diagnostics[0]?.message ??
          `This ${this.kindNoun} cannot be created as previewed.`,
        'error',
      );
      return;
    }
    this.#committing = true;
    this.#syncCreateButton();
    this.#setStatus('Creating…');

    try {
      const outcome = await this.commitPreview(
        result as TResult & { ok: true },
      );
      if (!outcome.ok) {
        this.#setStatus(
          outcome.diagnostics[0]?.message ??
            `The ${this.kindNoun} was not created.`,
          'error',
        );
        // Re-preview so the user sees the current situation, not the stale one.
        this.schedulePreview();
        return;
      }

      const created = outcome.created_path;
      this.close();
      new Notice('Created ' + created);
      if (this.#openAfterCreate) {
        await this.openNote(created);
      }
    } catch (error) {
      console.error(
        `Project Weave could not create the ${this.kindNoun}`,
        error,
      );
      this.#setStatus(
        `Project Weave could not create the ${this.kindNoun}. Nothing was written.`,
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
    button.setDisabled(!ready);
    button.setButtonText(this.#committing ? 'Creating…' : this.confirmLabel);
    // A disabled control that looks enabled reads as a broken button, so say
    // why it cannot run rather than silently ignoring the click.
    button.buttonEl.title = ready
      ? 'Create this note'
      : this.hasTitle
        ? `This ${this.kindNoun} cannot be created yet — see the diagnostics above`
        : 'Enter a title first';
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
        'project-weave-creation-preview__status-text' +
        (tone === 'error'
          ? ' project-weave-creation-preview__status-text--error'
          : ''),
      text,
    });
  }

  protected renderOutput(): void {
    this.#syncCreateButton();
    const container = this.#outputEl;
    if (container === null) {
      return;
    }
    container.empty();

    if (!this.hasTitle) {
      container.createEl('p', {
        cls: 'project-weave-creation-preview__hint',
        text: 'Enter a title to see the note that would be created.',
      });
      return;
    }

    const result = this.#result;
    if (result === null) {
      container.createEl('p', {
        cls: 'project-weave-creation-preview__hint',
        text: 'Building preview…',
      });
      return;
    }

    if (!result.ok) {
      const failure = result as TResult & { ok: false };
      this.#renderFacts(container, this.failureFacts(failure));
      this.#renderDiagnostics(container, result.diagnostics);
      return;
    }

    const success = result as TResult & { ok: true };
    const { proposal } = success;
    this.#renderFacts(container, [
      ['Action', proposal.action],
      ...this.facts(success),
      [
        'Template',
        `${proposal.template.reference} (${proposal.template.source})`,
      ],
      ['Index revision', String(success.index_revision)],
      [
        'Rendered note',
        `${String(success.lineCount)} lines · ${String(success.byteLength)} bytes`,
      ],
    ]);

    const notice = this.collisionNotice(success);
    if (notice !== null) {
      container.createEl('p', {
        cls: 'project-weave-creation-preview__notice',
        text: notice,
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
      cls: 'project-weave-creation-preview__content',
      text: success.content,
    });

    this.#renderDiagnostics(container, result.diagnostics);

    container.createEl('p', {
      cls: 'project-weave-creation-preview__notice',
      text: 'Creating writes exactly these bytes to that path. Existing notes are never modified or overwritten.',
    });
  }

  #renderFacts(
    container: HTMLElement,
    facts: readonly (readonly [string, string])[],
  ): void {
    if (facts.length === 0) {
      return;
    }
    const list = container.createEl('dl', {
      cls: 'project-weave-creation-preview__facts',
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
      cls: 'project-weave-creation-preview__list',
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
      cls: 'project-weave-creation-preview__list',
    });
    for (const issue of diagnostics) {
      const row = list.createEl('li', {
        cls: `project-weave-creation-preview__diagnostic--${issue.severity}`,
      });
      row.createDiv({ text: `${issue.code}: ${issue.message}` });
      if (issue.recovery !== undefined) {
        row.createDiv({
          cls: 'project-weave-creation-preview__recovery',
          text: issue.recovery,
        });
      }
    }
  }

  #renderSection(container: HTMLElement, heading: string): HTMLElement {
    const section = container.createDiv({
      cls: 'project-weave-creation-preview__section',
    });
    section.createEl('h3', {
      cls: 'project-weave-creation-preview__heading',
      text: heading,
    });
    return section;
  }
}
