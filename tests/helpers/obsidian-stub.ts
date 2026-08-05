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

export function createStubApp(paths: readonly string[] = []): StubApp {
  const vault: StubVault = {
    paths: new Set(paths),
    getFileByPath(path) {
      return vault.paths.has(path) ? { path } : null;
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
