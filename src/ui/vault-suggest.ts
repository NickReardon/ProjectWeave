import { AbstractInputSuggest, TFolder } from 'obsidian';
import type { App } from 'obsidian';

import type { ProjectSummary } from '../application/query-api';

/** Suggests vault folders, used for any single-folder vault-path field. */
export class VaultFolderSuggest extends AbstractInputSuggest<TFolder> {
  protected override getSuggestions(query: string): TFolder[] {
    return matchingFolders(this.app, query);
  }

  public override renderSuggestion(
    folder: TFolder,
    element: HTMLElement,
  ): void {
    element.setText(folder.path);
  }
}

/**
 * Suggests vault folders for a comma-separated list field, matching only
 * against the segment currently being edited (the text after the last
 * comma) rather than the whole field value.
 */
export class VaultFolderListSuggest extends AbstractInputSuggest<TFolder> {
  protected override getSuggestions(query: string): TFolder[] {
    return matchingFolders(this.app, lastListSegment(query));
  }

  public override renderSuggestion(
    folder: TFolder,
    element: HTMLElement,
  ): void {
    element.setText(folder.path);
  }
}

/**
 * Suggests already-indexed projects, since a grant may only be scoped to a
 * project the index recognizes.
 */
export class ProjectPathSuggest extends AbstractInputSuggest<ProjectSummary> {
  readonly #listProjects: () => Promise<readonly ProjectSummary[]>;

  public constructor(
    app: App,
    textInputEl: HTMLInputElement,
    listProjects: () => Promise<readonly ProjectSummary[]>,
  ) {
    super(app, textInputEl);
    this.#listProjects = listProjects;
  }

  protected override async getSuggestions(
    query: string,
  ): Promise<ProjectSummary[]> {
    return matchingProjects(await this.#listProjects(), query);
  }

  public override renderSuggestion(
    project: ProjectSummary,
    element: HTMLElement,
  ): void {
    element.setText(`${project.title} — ${project.ref.path}`);
  }
}

/** Pure filter behind {@link ProjectPathSuggest}, exported for direct testing. */
export function matchingProjects(
  projects: readonly ProjectSummary[],
  query: string,
): ProjectSummary[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return projects
    .filter(
      (project) =>
        normalizedQuery.length === 0 ||
        project.title.toLocaleLowerCase().includes(normalizedQuery) ||
        project.ref.path.toLocaleLowerCase().includes(normalizedQuery),
    )
    .slice()
    .sort((left, right) => left.title.localeCompare(right.title));
}

function matchingFolders(app: App, query: string): TFolder[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return app.vault
    .getAllLoadedFiles()
    .filter((file): file is TFolder => file instanceof TFolder)
    .filter(
      (folder) =>
        folder.path.length > 0 &&
        folder.path !== '/' &&
        folder.path !== '.obsidian' &&
        !folder.path.startsWith('.obsidian/') &&
        (normalizedQuery.length === 0 ||
          folder.path.toLocaleLowerCase().includes(normalizedQuery)),
    )
    .sort((left, right) => left.path.localeCompare(right.path));
}

/** The comma-separated segment currently being typed, i.e. after the last comma. */
export function lastListSegment(value: string): string {
  const segments = value.split(',');
  return segments[segments.length - 1] ?? '';
}

/**
 * Replaces the segment currently being typed with `replacement`, trimming
 * and dropping empty segments the same way grant creation parses this field
 * on submit, so the preview matches what will be saved.
 */
export function replaceLastListSegment(
  value: string,
  replacement: string,
): string {
  const segments = value.split(',');
  segments[segments.length - 1] = replacement;
  return segments
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .join(', ');
}

/**
 * Vault folder paths currently loaded, as a set for local resolution checks
 * (see "Grant lifecycle and creation" in
 * `docs/project-vault/Projects/Weave/Documents/Specifications/agent-access-and-mcp.md`).
 * Shares the same folder listing as {@link VaultFolderSuggest} and
 * {@link VaultFolderListSuggest} so a folder that is suggested is exactly a
 * folder that resolves.
 */
export function vaultFolderPaths(app: App): ReadonlySet<string> {
  return new Set(
    app.vault
      .getAllLoadedFiles()
      .filter((file): file is TFolder => file instanceof TFolder)
      .map((folder) => folder.path),
  );
}
