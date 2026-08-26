import type { AgentGrant } from '../application/agent-grants';

export interface ProjectWeaveSettings {
  readonly settingsVersion: 2;
  readonly projectRoots: readonly string[];
  readonly templateScaffoldFolder: string;
  /** Empty disables the derived diagnostics JSON export. */
  readonly diagnosticsLogFolder: string;
  /**
   * Allowed task `category` values for the whole vault (ADR 0014). Empty means
   * unconstrained: any value is accepted and the filter offers whatever tasks
   * actually use. Vault-wide rather than per-project because Obsidian's own
   * property suggestions are vault-wide, and two disagreeing lists would show
   * the user two different sets of options for one field.
   */
  readonly taskCategories: readonly string[];
  /** Desktop-only local bridge. Disabled means no pipe/socket is opened. */
  readonly agentGatewayEnabled: boolean;
  /** Stable local identity used to bind grants to this vault. */
  readonly agentVaultId: string;
  /** Local-only, secret-digest-bearing grants; never vault Markdown. */
  readonly agentGrants: readonly AgentGrant[];
}

export type ScopeTransition = 'ignore' | 'upsert' | 'remove' | 'rename';

const DEFAULT_PROJECT_ROOT = 'Projects';
const DEFAULT_TEMPLATE_SCAFFOLD_FOLDER = 'Templates/Project Weave';
const DRIVE_PATH_PATTERN = /^[a-z]:/iu;

export function createDefaultProjectWeaveSettings(): ProjectWeaveSettings {
  return {
    settingsVersion: 2,
    projectRoots: [DEFAULT_PROJECT_ROOT],
    templateScaffoldFolder: DEFAULT_TEMPLATE_SCAFFOLD_FOLDER,
    diagnosticsLogFolder: '',
    taskCategories: [],
    agentGatewayEnabled: false,
    agentVaultId: '',
    agentGrants: [],
  };
}

/**
 * Whether a stored payload is a settings record this build can adopt.
 *
 * `loadProjectWeaveSettings` answers a different question: it always returns a
 * usable object, falling back to defaults for anything it cannot read. That is
 * right at load, where defaults are the only alternative to failing to start.
 * It is wrong for a payload that is about to be written back, because adopting
 * defaults and saving them replaces real settings with empty ones. Ask this
 * first whenever the result may be persisted.
 */
export function isAdoptableSettingsPayload(
  value: unknown,
): value is Record<string, unknown> {
  if (!isRecord(value)) {
    return false;
  }
  return (
    value.settingsVersion === undefined ||
    value.settingsVersion === 1 ||
    value.settingsVersion === 2
  );
}

export function loadProjectWeaveSettings(value: unknown): ProjectWeaveSettings {
  const defaults = createDefaultProjectWeaveSettings();
  if (!isRecord(value)) {
    return defaults;
  }
  if (
    value.settingsVersion !== undefined &&
    value.settingsVersion !== 1 &&
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
  const diagnosticsLogFolder =
    typeof value.diagnosticsLogFolder === 'string'
      ? normalizeStoredOptionalFolder(value.diagnosticsLogFolder, '')
      : defaults.diagnosticsLogFolder;

  return {
    settingsVersion: 2,
    projectRoots,
    templateScaffoldFolder,
    diagnosticsLogFolder,
    taskCategories: Array.isArray(value.taskCategories)
      ? normalizeTaskCategories(value.taskCategories)
      : defaults.taskCategories,
    agentGatewayEnabled: value.agentGatewayEnabled === true,
    agentVaultId:
      typeof value.agentVaultId === 'string'
        ? normalizeIdentifier(value.agentVaultId)
        : '',
    agentGrants: Array.isArray(value.agentGrants)
      ? normalizeAgentGrants(value.agentGrants)
      : [],
  };
}

export function normalizeAgentGrants(
  values: readonly unknown[],
): readonly AgentGrant[] {
  const grants: AgentGrant[] = [];
  const ids = new Set<string>();
  for (const value of values) {
    if (!isRecord(value)) continue;
    const id = normalizeIdentifier(value.id);
    const vaultId = normalizeIdentifier(value.vaultId);
    const label = typeof value.label === 'string' ? value.label.trim() : '';
    const digest =
      typeof value.secretDigest === 'string'
        ? value.secretDigest.toLowerCase()
        : '';
    if (
      id.length === 0 ||
      ids.has(id) ||
      vaultId.length === 0 ||
      !/^[a-f0-9]{64}$/u.test(digest) ||
      typeof value.projectPath !== 'string'
    )
      continue;
    let projectPath: string;
    let contentRoots: readonly string[];
    try {
      projectPath = normalizeVaultFilePath(value.projectPath);
      contentRoots = Array.isArray(value.contentRoots)
        ? normalizeProjectRoots(
            value.contentRoots.filter(
              (root): root is string => typeof root === 'string',
            ),
          )
        : [];
    } catch {
      continue;
    }
    ids.add(id);
    grants.push({
      id,
      label: label.length === 0 ? id : label,
      vaultId,
      projectPath,
      contentRoots,
      secretDigest: digest,
      enabled: value.enabled !== false,
    });
  }
  return grants.sort((left, right) => left.id.localeCompare(right.id));
}

/**
 * Trim, drop empties, and de-duplicate case-insensitively, keeping the first
 * spelling of each. The list is what the user typed, so `Bug` stays `Bug`;
 * matching against it ignores case, since Obsidian's own suggestions do not
 * enforce one.
 */
export function normalizeTaskCategories(
  values: readonly unknown[],
): readonly string[] {
  const seen = new Set<string>();
  const categories: string[] = [];
  for (const value of values) {
    if (typeof value !== 'string') {
      continue;
    }
    const trimmed = value.trim();
    const key = trimmed.toLowerCase();
    if (trimmed.length === 0 || seen.has(key)) {
      continue;
    }
    seen.add(key);
    categories.push(trimmed);
  }
  return categories;
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

export function normalizeVaultFilePath(value: string): string {
  const normalized = normalizeVaultFolderPath(value);
  if (!normalized.toLowerCase().endsWith('.md')) {
    throw new Error('Use a vault-relative Markdown note path.');
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

function normalizeIdentifier(value: unknown): string {
  return typeof value === 'string'
    ? value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/gu, '-')
    : '';
}
