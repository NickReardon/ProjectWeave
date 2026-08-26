/**
 * Runtime stand-in for the `obsidian` module, which ships types only and has an
 * empty `main`. `vitest.config.ts` aliases `obsidian` here so UI modules can be
 * imported and exercised in tests.
 *
 * This is deliberately thin: it implements the Obsidian surface Project Weave's
 * views actually use, and nothing else. It is a test double, never a model of
 * Obsidian's real behavior — anything that depends on how Obsidian itself
 * manages tabs, workspaces, or layout still needs a manual check.
 */

export interface StubTFile {
  readonly path: string;
}

export interface StubOpenedFile {
  readonly file: StubTFile;
  readonly active: boolean;
}

export interface StubLeaf {
  readonly app: StubApp;
  openFile(file: StubTFile, options?: { active?: boolean }): Promise<void>;
}

export interface StubApp {
  readonly workspace: StubWorkspace;
  readonly vault: StubVault;
}

export interface StubWorkspace {
  activeFilePath: string | null;
  readonly saveLayoutCount: () => number;
  readonly openedFiles: StubOpenedFile[];
  /** Every `getLeaf` argument, so tests can assert a note opened in a tab. */
  readonly requestedLeafKinds: string[];
  getActiveFile(): StubTFile | null;
  requestSaveLayout(): void;
  getLeaf(kind: string): StubLeaf;
}

export interface StubVault {
  readonly paths: Set<string>;
  getFileByPath(path: string): StubTFile | null;
  getAllLoadedFiles(): readonly unknown[];
}

/**
 * Obsidian's platform flags.
 *
 * Defaults to desktop, because that is where every surface exists and where a
 * test that says nothing about the platform means to run. `setPlatform` lets a
 * test ask for the mobile branch; call `resetPlatform` after, since this is
 * module state shared by every test in the run.
 */
export const Platform = { isDesktopApp: true, isMobile: false };

export function setPlatform(next: {
  readonly isDesktopApp: boolean;
  readonly isMobile: boolean;
}): void {
  Platform.isDesktopApp = next.isDesktopApp;
  Platform.isMobile = next.isMobile;
}

export function resetPlatform(): void {
  setPlatform({ isDesktopApp: true, isMobile: false });
}

/** Every `new Notice(...)` raised since the last `clearNotices()`. */
export const recordedNotices: string[] = [];

export function clearNotices(): void {
  recordedNotices.length = 0;
}

export class Notice {
  public constructor(message: string) {
    recordedNotices.push(message);
  }

  public hide(): void {
    // Nothing to dismiss in a test.
  }
}

export interface ViewStateResult {
  history?: boolean;
}

export class ItemView {
  public readonly leaf: StubLeaf;
  public readonly app: StubApp;
  public readonly containerEl: HTMLElement;
  public readonly contentEl: HTMLElement;
  public navigation = true;
  public icon = '';
  public readonly actions: {
    readonly icon: string;
    readonly title: string;
    readonly callback: () => void;
  }[] = [];

  public constructor(leaf: StubLeaf) {
    this.leaf = leaf;
    this.app = leaf.app;
    this.containerEl = document.createElement('div');
    this.contentEl = document.createElement('div');
    this.containerEl.appendChild(this.contentEl);
  }

  public addAction(icon: string, title: string, callback: () => void): void {
    this.actions.push({ icon, title, callback });
  }

  /** The last state Obsidian would have been asked to persist. */
  public restoredState: unknown = null;

  public getState(): Record<string, unknown> {
    return {};
  }

  public async setState(
    state: unknown,
    result: ViewStateResult,
  ): Promise<void> {
    this.restoredState = state;
    result.history = false;
  }

  public getViewType(): string {
    return '';
  }

  public getDisplayText(): string {
    return '';
  }

  public getIcon(): string {
    return this.icon;
  }

  protected async onOpen(): Promise<void> {
    // Overridden by the view under test.
  }

  protected async onClose(): Promise<void> {
    // Overridden by the view under test.
  }
}

export class Modal {
  public readonly app: StubApp;
  public readonly containerEl: HTMLElement;
  public readonly modalEl: HTMLElement;
  public readonly titleEl: HTMLElement;
  public readonly contentEl: HTMLElement;
  public isOpen = false;

  public constructor(app: StubApp) {
    this.app = app;
    this.containerEl = document.createElement('div');
    this.modalEl = document.createElement('div');
    this.titleEl = document.createElement('div');
    this.contentEl = document.createElement('div');
    this.modalEl.appendChild(this.titleEl);
    this.modalEl.appendChild(this.contentEl);
    this.containerEl.appendChild(this.modalEl);
  }

  public setTitle(title: string): this {
    this.titleEl.textContent = title;
    return this;
  }

  public open(): void {
    this.isOpen = true;
    document.body.appendChild(this.containerEl);
    this.onOpen();
  }

  public close(): void {
    this.isOpen = false;
    this.onClose();
    this.containerEl.remove();
  }

  public onOpen(): void {
    // Overridden by the modal under test.
  }

  public onClose(): void {
    // Overridden by the modal under test.
  }
}

export class TextComponent {
  public readonly inputEl: HTMLInputElement;

  public constructor(container: HTMLElement) {
    this.inputEl = container.ownerDocument.createElement('input');
    this.inputEl.type = 'text';
    container.appendChild(this.inputEl);
  }

  public setPlaceholder(placeholder: string): this {
    this.inputEl.placeholder = placeholder;
    return this;
  }

  public setValue(value: string): this {
    this.inputEl.value = value;
    return this;
  }

  public getValue(): string {
    return this.inputEl.value;
  }

  public onChange(callback: (value: string) => void): this {
    this.inputEl.addEventListener('input', () => {
      callback(this.inputEl.value);
    });
    return this;
  }
}

export class SearchComponent extends TextComponent {}

export class ToggleComponent {
  public readonly toggleEl: HTMLInputElement;

  public constructor(container: HTMLElement) {
    this.toggleEl = container.ownerDocument.createElement('input');
    this.toggleEl.type = 'checkbox';
    container.appendChild(this.toggleEl);
  }

  public setValue(value: boolean): this {
    this.toggleEl.checked = value;
    return this;
  }

  public getValue(): boolean {
    return this.toggleEl.checked;
  }

  public onChange(callback: (value: boolean) => void): this {
    this.toggleEl.addEventListener('change', () => {
      callback(this.toggleEl.checked);
    });
    return this;
  }
}

export class ButtonComponent {
  public readonly buttonEl: HTMLButtonElement;

  public constructor(container: HTMLElement) {
    this.buttonEl = container.ownerDocument.createElement('button');
    container.appendChild(this.buttonEl);
  }

  public setButtonText(text: string): this {
    this.buttonEl.textContent = text;
    return this;
  }

  public setCta(): this {
    this.buttonEl.classList.add('mod-cta');
    return this;
  }

  public setDisabled(disabled: boolean): this {
    this.buttonEl.disabled = disabled;
    return this;
  }

  public onClick(callback: () => void): this {
    this.buttonEl.addEventListener('click', () => {
      // Obsidian does not invoke a disabled button's handler.
      if (!this.buttonEl.disabled) {
        callback();
      }
    });
    return this;
  }
}

export class ExtraButtonComponent extends ButtonComponent {
  public setIcon(icon: string): this {
    this.buttonEl.dataset['icon'] = icon;
    return this;
  }

  public setTooltip(tooltip: string): this {
    this.buttonEl.title = tooltip;
    return this;
  }
}

/** Models Obsidian's dropdown surface, not its styling. */
export class DropdownComponent {
  public readonly selectEl: HTMLSelectElement;

  public constructor(container: HTMLElement) {
    this.selectEl = container.ownerDocument.createElement('select');
    container.appendChild(this.selectEl);
  }

  public addOption(value: string, display: string): this {
    const option = this.selectEl.ownerDocument.createElement('option');
    option.value = value;
    option.textContent = display;
    this.selectEl.appendChild(option);
    return this;
  }

  public setValue(value: string): this {
    this.selectEl.value = value;
    return this;
  }

  public setDisabled(disabled: boolean): this {
    this.selectEl.disabled = disabled;
    return this;
  }

  public getValue(): string {
    return this.selectEl.value;
  }

  public onChange(callback: (value: string) => void): this {
    this.selectEl.addEventListener('change', () => {
      callback(this.selectEl.value);
    });
    return this;
  }
}

export class Setting {
  public readonly settingEl: HTMLElement;
  public readonly nameEl: HTMLElement;
  public readonly descEl: HTMLElement;
  public readonly controlEl: HTMLElement;

  public constructor(container: HTMLElement) {
    const document = container.ownerDocument;
    this.settingEl = document.createElement('div');
    this.settingEl.classList.add('setting-item');
    this.nameEl = document.createElement('div');
    this.descEl = document.createElement('div');
    this.controlEl = document.createElement('div');
    this.settingEl.append(this.nameEl, this.descEl, this.controlEl);
    container.appendChild(this.settingEl);
  }

  public setName(name: string): this {
    this.nameEl.textContent = name;
    return this;
  }

  public setDesc(desc: string): this {
    this.descEl.textContent = desc;
    return this;
  }

  public setHeading(): this {
    this.settingEl.classList.add('setting-item-heading');
    return this;
  }

  public addText(configure: (text: TextComponent) => void): this {
    configure(new TextComponent(this.controlEl));
    return this;
  }

  public addSearch(configure: (search: SearchComponent) => void): this {
    configure(new SearchComponent(this.controlEl));
    return this;
  }

  public addToggle(configure: (toggle: ToggleComponent) => void): this {
    configure(new ToggleComponent(this.controlEl));
    return this;
  }

  public addButton(configure: (button: ButtonComponent) => void): this {
    configure(new ButtonComponent(this.controlEl));
    return this;
  }

  public addExtraButton(
    configure: (button: ExtraButtonComponent) => void,
  ): this {
    configure(new ExtraButtonComponent(this.controlEl));
    return this;
  }

  public addDropdown(configure: (dropdown: DropdownComponent) => void): this {
    configure(new DropdownComponent(this.controlEl));
    return this;
  }
}

/**
 * Enough of `Plugin` to construct the real plugin class and drive one method.
 *
 * Deliberately not enough to run `onload`, which registers views, commands,
 * ribbon icons, and workspace listeners. Tests that need a loaded plugin want
 * the harness from "Lift a testable workspace out of the plugin entry point";
 * this covers methods reachable on a constructed instance.
 */
export class Plugin {
  public readonly app: unknown;
  public readonly manifest: { readonly version: string };
  /** Whatever `loadData()` should return; set it to stage a synced file. */
  public storedData: unknown = null;

  public constructor(app: unknown, manifest: { readonly version: string }) {
    this.app = app;
    this.manifest = manifest;
  }

  public async loadData(): Promise<unknown> {
    return this.storedData;
  }

  public async saveData(data: unknown): Promise<void> {
    this.storedData = data;
  }

  public registerView(): void {}
  public registerEvent(): void {}
  public addSettingTab(): void {}
  public addRibbonIcon(): void {}
  public addCommand(): void {}
}

export class PluginSettingTab {
  public readonly app: StubApp;
  public readonly plugin: unknown;
  public readonly containerEl: HTMLElement;

  public constructor(app: StubApp, plugin: unknown) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl = document.createElement('div');
  }

  public display(): void {
    // Overridden by the settings tab.
  }
}

export class TFolder {
  public readonly path: string;

  public constructor(path: string) {
    this.path = path;
  }
}

export class AbstractInputSuggest<T> {
  protected readonly app: StubApp;
  protected readonly inputEl: HTMLInputElement;

  public constructor(app: StubApp, inputEl: HTMLInputElement) {
    this.app = app;
    this.inputEl = inputEl;
  }

  public onSelect(_callback: (value: T) => void): void {
    void _callback;
    // Suggestions are an Obsidian integration boundary.
  }

  protected getSuggestions(_query: string): T[] {
    void _query;
    return [];
  }

  public renderSuggestion(_value: T, _element: HTMLElement): void {
    void _value;
    void _element;
    // Overridden by the suggestion provider.
  }
}

export function createStubApp(
  paths: readonly string[] = [],
  folderPaths: readonly string[] = [],
): StubApp {
  const folders = folderPaths.map((path) => new TFolder(path));
  const vault: StubVault = {
    paths: new Set(paths),
    getFileByPath(path) {
      return vault.paths.has(path) ? { path } : null;
    },
    getAllLoadedFiles() {
      return folders;
    },
  };

  let saveLayouts = 0;
  const openedFiles: StubOpenedFile[] = [];
  const requestedLeafKinds: string[] = [];

  const workspace: StubWorkspace = {
    activeFilePath: null,
    openedFiles,
    requestedLeafKinds,
    saveLayoutCount: () => saveLayouts,
    getActiveFile() {
      return workspace.activeFilePath === null
        ? null
        : { path: workspace.activeFilePath };
    },
    requestSaveLayout() {
      saveLayouts += 1;
    },
    getLeaf(kind) {
      requestedLeafKinds.push(kind);
      return createStubLeaf(app);
    },
  };

  const app: StubApp = { vault, workspace };
  return app;
}

export function createStubLeaf(app: StubApp): StubLeaf {
  return {
    app,
    async openFile(file, options) {
      app.workspace.openedFiles.push({
        file,
        active: options?.active ?? false,
      });
    },
  };
}
