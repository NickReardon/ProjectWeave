export interface ProjectWeaveSettings {
  readonly settingsVersion: 1;
  readonly projectRoots: readonly string[];
  readonly templateScaffoldFolder: string;
}

export type ScopeTransition = 'ignore' | 'upsert' | 'remove' | 'rename';

const DEFAULT_PROJECT_ROOT = 'Projects';
const DEFAULT_TEMPLATE_SCAFFOLD_FOLDER = 'Templates/Project Weave';
const DRIVE_PATH_PATTERN = /^[a-z]:/iu;

export function createDefaultProjectWeaveSettings(): ProjectWeaveSettings {
  return {
    settingsVersion: 1,
    projectRoots: [DEFAULT_PROJECT_ROOT],
    templateScaffoldFolder: DEFAULT_TEMPLATE_SCAFFOLD_FOLDER,
  };
}

export function loadProjectWeaveSettings(value: unknown): ProjectWeaveSettings {
  const defaults = createDefaultProjectWeaveSettings();
  if (!isRecord(value)) {
    return defaults;
  }
  if (
    value.settingsVersion !== undefined &&
    value.settingsVersion !== defaults.settingsVersion
  ) {
    return { ...defaults, projectRoots: [] };
  }

  const projectRoots = Array.isArray(value.projectRoots)
    ? normalizeStoredProjectRoots(value.projectRoots)
    : defaults.projectRoots;
  const templateScaffoldFolder =
    typeof value.templateScaffoldFolder === 'string'
      ? normalizeStoredOptionalFolder(
          value.templateScaffoldFolder,
          defaults.templateScaffoldFolder,
        )
      : defaults.templateScaffoldFolder;

  return {
    settingsVersion: 1,
    projectRoots,
    templateScaffoldFolder,
  };
}

export function normalizeProjectRoots(
  values: readonly string[],
): readonly string[] {
  return [
    ...new Set(
      values
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
        .map(normalizeVaultFolderPath),
    ),
  ].sort(comparePath);
}

export function normalizeOptionalVaultFolderPath(value: string): string {
  return value.trim().length === 0 ? '' : normalizeVaultFolderPath(value);
}

export function normalizeVaultFolderPath(value: string): string {
  const withSlashes = value.trim().replaceAll('\\', '/');
  if (withSlashes.length === 0) {
    throw new Error('Folder path cannot be empty.');
  }
  if (withSlashes.startsWith('/') || DRIVE_PATH_PATTERN.test(withSlashes)) {
    throw new Error('Use a vault-relative folder path.');
  }
  if (withSlashes.includes('\0')) {
    throw new Error('Folder path cannot contain a null character.');
  }

  const normalized = withSlashes.replace(/\/{2,}/gu, '/').replace(/\/$/u, '');
  const segments = normalized.split('/');
  if (segments.some((segment) => segment === '.' || segment === '..')) {
    throw new Error('Folder path cannot contain . or .. segments.');
  }
  if (segments.some((segment) => segment.length === 0)) {
    throw new Error('Folder path contains an empty segment.');
  }
  if (segments[0]?.toLocaleLowerCase() === '.obsidian') {
    throw new Error('The vault configuration folder cannot be indexed.');
  }
  return normalized;
}

export function isPathInProjectRoots(
  path: string,
  projectRoots: readonly string[],
): boolean {
  const normalizedPath = normalizeComparablePath(path);
  return projectRoots.some((root) => {
    const normalizedRoot = normalizeComparablePath(root);
    return (
      normalizedPath === normalizedRoot ||
      normalizedPath.startsWith(normalizedRoot + '/')
    );
  });
}

export function classifyScopeTransition(
  oldIncluded: boolean,
  newIncluded: boolean,
): ScopeTransition {
  if (oldIncluded && newIncluded) {
    return 'rename';
  }
  if (oldIncluded) {
    return 'remove';
  }
  if (newIncluded) {
    return 'upsert';
  }
  return 'ignore';
}

function normalizeStoredProjectRoots(values: readonly unknown[]): string[] {
  const valid: string[] = [];
  for (const value of values) {
    if (typeof value !== 'string') {
      continue;
    }
    try {
      const normalized = normalizeVaultFolderPath(value);
      valid.push(normalized);
    } catch {
      // Ignore malformed persisted paths rather than widening index scope.
    }
  }
  return [...new Set(valid)].sort(comparePath);
}

function normalizeStoredOptionalFolder(
  value: string,
  fallback: string,
): string {
  try {
    return normalizeOptionalVaultFolderPath(value);
  } catch {
    return fallback;
  }
}

function normalizeComparablePath(value: string): string {
  return value
    .replaceAll('\\', '/')
    .replace(/^\/+|\/+$/gu, '')
    .replace(/\/{2,}/gu, '/');
}

function comparePath(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: 'accent' });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
