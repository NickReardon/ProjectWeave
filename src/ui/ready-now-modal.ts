import { Modal } from 'obsidian';
import type { App } from 'obsidian';

import type { ReadyNowResult } from '../application/query-api';

export class ReadyNowModal extends Modal {
  readonly #result: ReadyNowResult;

  public constructor(app: App, result: ReadyNowResult) {
    super(app);
    this.#result = result;
  }

  public override onOpen(): void {
    this.setTitle('Project Weave — Ready Now');
    this.contentEl.empty();
    this.contentEl.addClass('project-weave-ready-now');

    this.contentEl.createEl('p', {
      cls: 'project-weave-ready-now__summary',
      text: `${this.#result.items.length} ready board task${this.#result.items.length === 1 ? '' : 's'} · index revision ${String(this.#result.index_revision)}`,
    });

    if (this.#result.items.length === 0) {
      this.contentEl.createEl('p', {
        text: 'No todo tasks currently have all same-project prerequisites satisfied.',
      });
      return;
    }

    const list = this.contentEl.createEl('ul', {
      cls: 'project-weave-ready-now__list',
    });
    for (const item of this.#result.items) {
      const row = list.createEl('li', {
        cls: 'project-weave-ready-now__item',
      });
      const openButton = row.createEl('button', {
        text: item.title,
        attr: { type: 'button' },
      });
      openButton.addEventListener('click', () => {
        this.close();
        void this.app.workspace.openLinkText(
          item.ref.path,
          this.#result.project_ref.path,
          false,
        );
      });
      const metadata = [
        item.rank === null ? null : `rank ${String(item.rank)}`,
        item.priority === 'normal' ? null : item.priority,
        item.unlocks.length === 0
          ? null
          : `unlocks ${String(item.unlocks.length)}`,
      ].filter((value): value is string => value !== null);
      if (metadata.length > 0) {
        row.createDiv({
          cls: 'project-weave-ready-now__metadata',
          text: metadata.join(' · '),
        });
      }
    }
  }

  public override onClose(): void {
    this.contentEl.empty();
  }
}
