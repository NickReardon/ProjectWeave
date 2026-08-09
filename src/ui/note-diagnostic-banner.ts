import { MarkdownView } from 'obsidian';
import type { App } from 'obsidian';

import {
  buildNoteDiagnosticBannerModel,
  buildNoteDiagnosticBannerModelFromDiagnostics,
  type NoteDiagnosticBannerItem,
  type NoteDiagnosticBannerModel,
} from '../application/note-diagnostic-banner-model';
import {
  diagnoseTemplateNote,
  isInTemplateLibrary,
} from '../application/template-note-diagnostics';
import type { ProjectWeaveReadSource } from '../application/project-weave-read-source';

const BANNER_ATTRIBUTE = 'data-project-weave-note-diagnostics';

export class NoteDiagnosticBannerController {
  readonly #app: App;
  readonly #readSource: ProjectWeaveReadSource;
  readonly #banners = new Set<HTMLElement>();
  #unsubscribe: (() => void) | null = null;
  #refreshScheduled = false;
  #templateRefreshToken = 0;
  #disposed = false;
  readonly #templateLibraryFolder: () => string;

  public constructor(
    app: App,
    readSource: ProjectWeaveReadSource,
    templateLibraryFolder: () => string = () => '',
  ) {
    this.#app = app;
    this.#readSource = readSource;
    this.#templateLibraryFolder = templateLibraryFolder;
  }

  public start(): void {
    if (this.#disposed || this.#unsubscribe !== null) {
      return;
    }
    this.#unsubscribe = this.#readSource.subscribe(() => {
      this.scheduleRefresh();
    });
  }

  public scheduleRefresh(): void {
    if (this.#disposed || this.#refreshScheduled) {
      return;
    }
    this.#refreshScheduled = true;
    queueMicrotask(() => {
      this.#refreshScheduled = false;
      if (!this.#disposed) {
        this.refresh();
      }
    });
  }

  public refresh(): void {
    if (this.#disposed) {
      return;
    }

    this.#clearBanners();
    const { snapshot } = this.#readSource.current;
    for (const leaf of this.#app.workspace.getLeavesOfType('markdown')) {
      if (!(leaf.view instanceof MarkdownView) || leaf.view.file === null) {
        continue;
      }
      const model = buildNoteDiagnosticBannerModel(
        snapshot,
        leaf.view.file.path,
      );
      if (model !== null) {
        this.#mountBanner(leaf.view, model);
      }
    }
    void this.#refreshTemplateBanners(++this.#templateRefreshToken).catch(
      (error: unknown) => {
        console.error(
          'Project Weave could not refresh template-note diagnostics',
          error,
        );
      },
    );
  }

  public dispose(): void {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    this.#clearBanners();
  }

  async #refreshTemplateBanners(token: number): Promise<void> {
    const folder = this.#templateLibraryFolder();
    if (folder.trim().length === 0) {
      return;
    }
    const candidates = this.#app.workspace
      .getLeavesOfType('markdown')
      .filter(
        (leaf) =>
          leaf.view instanceof MarkdownView &&
          leaf.view.file !== null &&
          isInTemplateLibrary(leaf.view.file.path, folder),
      );
    const results = await Promise.all(
      candidates.map(async (leaf) => {
        if (!(leaf.view instanceof MarkdownView) || leaf.view.file === null) {
          return null;
        }
        const path = leaf.view.file.path;
        const content = await this.#app.vault.cachedRead(leaf.view.file);
        return {
          view: leaf.view,
          model: buildNoteDiagnosticBannerModelFromDiagnostics(
            path,
            diagnoseTemplateNote(path, content, folder),
            this.#readSource.current.snapshot.freshness,
          ),
        };
      }),
    );
    if (this.#disposed || token !== this.#templateRefreshToken) {
      return;
    }
    for (const result of results) {
      if (result !== null && result.model !== null) {
        this.#mountBanner(result.view, result.model);
      }
    }
  }

  #mountBanner(view: MarkdownView, model: NoteDiagnosticBannerModel): void {
    for (const stale of view.containerEl.querySelectorAll<HTMLElement>(
      '[' + BANNER_ATTRIBUTE + ']',
    )) {
      stale.remove();
    }

    const parent = view.contentEl.parentElement;
    if (parent === null) {
      return;
    }
    const banner = renderNoteDiagnosticBanner(
      view.containerEl.ownerDocument,
      model,
    );
    parent.insertBefore(banner, view.contentEl);
    this.#banners.add(banner);
  }

  #clearBanners(): void {
    for (const banner of this.#banners) {
      banner.remove();
    }
    this.#banners.clear();
  }
}

function renderNoteDiagnosticBanner(
  document: Document,
  model: NoteDiagnosticBannerModel,
): HTMLElement {
  const banner = document.createElement('aside');
  banner.className =
    'project-weave-note-diagnostics project-weave-note-diagnostics--' +
    model.tone;
  banner.setAttribute(BANNER_ATTRIBUTE, '');
  banner.setAttribute('data-note-path', model.path);
  banner.setAttribute('role', 'status');
  banner.setAttribute('aria-live', 'polite');
  banner.setAttribute('aria-label', 'Project Weave diagnostics for this note');

  const header = document.createElement('div');
  header.className = 'project-weave-note-diagnostics__header';
  const title = document.createElement('strong');
  title.textContent = 'Project Weave';
  header.append(title);
  const summary = document.createElement('span');
  summary.textContent = diagnosticSummary(model);
  header.append(summary);
  banner.append(header);

  const list = document.createElement('ul');
  list.className = 'project-weave-note-diagnostics__list';
  for (const item of model.items) {
    list.append(renderDiagnosticItem(document, item));
  }
  banner.append(list);

  if (model.truncated) {
    const limit = document.createElement('p');
    limit.className = 'project-weave-note-diagnostics__note';
    limit.textContent =
      'Showing ' +
      String(model.displayed) +
      ' of ' +
      String(model.total) +
      ' diagnostics. Open Project Weave for the complete list.';
    banner.append(limit);
  }
  if (model.freshness !== 'current') {
    const freshness = document.createElement('p');
    freshness.className = 'project-weave-note-diagnostics__note';
    freshness.textContent =
      model.freshness === 'rebuilding'
        ? 'The index is rebuilding; these results may change.'
        : 'These results come from the last good index and may be out of date.';
    banner.append(freshness);
  }

  return banner;
}

function renderDiagnosticItem(
  document: Document,
  item: NoteDiagnosticBannerItem,
): HTMLLIElement {
  const row = document.createElement('li');
  row.className =
    'project-weave-note-diagnostics__item project-weave-note-diagnostics__item--' +
    item.severity;

  const type = document.createElement('div');
  type.className = 'project-weave-note-diagnostics__type';
  const severity = document.createElement('span');
  severity.className = 'project-weave-note-diagnostics__severity';
  severity.textContent = item.severity;
  type.append(severity);
  const code = document.createElement('code');
  code.textContent = item.code;
  type.append(code);
  row.append(type);

  const message = document.createElement('p');
  message.className = 'project-weave-note-diagnostics__message';
  message.textContent = item.message;
  row.append(message);

  if (item.field !== undefined) {
    const field = document.createElement('div');
    field.className = 'project-weave-note-diagnostics__field';
    field.textContent = 'Field: ' + item.field;
    row.append(field);
  }
  if (item.recovery !== undefined) {
    const recovery = document.createElement('p');
    recovery.className = 'project-weave-note-diagnostics__recovery';
    const label = document.createElement('strong');
    label.textContent = 'How to fix: ';
    recovery.append(label, item.recovery);
    row.append(recovery);
  }

  return row;
}

function diagnosticSummary(model: NoteDiagnosticBannerModel): string {
  const parts = [
    diagnosticCountLabel(model.errors, 'error'),
    diagnosticCountLabel(model.warnings, 'warning'),
    diagnosticCountLabel(model.info, 'info', 'info'),
  ].filter((part): part is string => part !== null);
  return parts.join(' · ');
}

function diagnosticCountLabel(
  count: number,
  label: string,
  plural = label + 's',
): string | null {
  if (count === 0) {
    return null;
  }
  return String(count) + ' ' + (count === 1 ? label : plural);
}
