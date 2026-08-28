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
  /**
   * Ids of grants that have been revoked, kept after the grant itself is gone
   * (ADR 0035).
   *
   * Revocation used to be expressed only by a grant's absence, which a stale
   * save could undo: sync writes the revocation, a local save that read the
   * file first lands on top of it, and the notification for that revocation
   * then reads back the list the save restored. Recording the id instead makes
   * the merge monotonic — a restored entry is dropped on adoption, so it never
   * reaches the list authorization is served from.
   *
   * Grow-only, and never emptied. Nothing short of an acknowledgement from
   * every device proves an id is safe to drop, since an offline device can
   * hold a stale grant indefinitely.
   *
   * Deliberately not guarded by a `settingsVersion` bump: an older build
   * ignores the field, and would refuse the whole file for a version it does
   * not know.
   */
  readonly revokedAgentGrantIds: readonly string[];
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
    revokedAgentGrantIds: [],
  };
}

/**
 * Whether a stored payload is a settings record this build can adopt in place
 * of the one it is already running.
 *
 * `loadProjectWeaveSettings` answers a different question: it always returns a
 * usable object, falling back to defaults for anything it cannot read. That is
 * right at load, where defaults are the only alternative to failing to start,
 * and wrong when settings already exist — silently replacing real grants with
 * an empty list is not a reasonable reading of a damaged file.
 *
 * The identity and the grant list are the two fields a default cannot stand in
 * for: every grant is bound to the vault id, so a payload missing it is not a
 * settings record this vault can be described by. Requiring both is also what
 * rejects a record that merely claims a version, such as `{settingsVersion: 2}`.
 * The remaining fields may fall back, because a default root or folder is a
 * usable value rather than a silent loss of authority.
 */
export function isAdoptableSettingsPayload(
  value: unknown,
): value is Record<string, unknown> {
  if (!isRecord(value)) {
    return false;
  }
  const version = value.settingsVersion;
  if (version !== undefined && version !== 1 && version !== 2) {
    return false;
  }
  if (hasUnreadableRevocationRecord(value)) {
    return false;
  }
  return (
    typeof value.agentVaultId === 'string' &&
    value.agentVaultId.trim().length > 0 &&
    Array.isArray(value.agentGrants)
  );
}

/**
 * Whether a payload carries a revocation record that cannot be read.
 *
 * Absent is not unreadable: every file written before revocations were
 * recorded has no field at all, and it means what it says — nothing has been
 * revoked. A field that is present and is not a list of ids means something
 * else entirely. It is the record of which credentials were withdrawn, and a
 * value that cannot be parsed is not evidence that none were.
 *
 * Callers fail closed on this rather than substituting an empty list, which
 * would read a damaged file as permission to serve every grant it still names.
 */
export function hasUnreadableRevocationRecord(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const stored = value.revokedAgentGrantIds;
  if (stored === undefined) return false;
  if (!Array.isArray(stored)) return true;
  // An entry that normalizes away is an id this build cannot account for, so
  // the record is incomplete in exactly the direction that matters.
  return stored.some((entry) => normalizeIdentifier(entry).length === 0);
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

  if (hasUnreadableRevocationRecord(value)) {
    // Authorization state that cannot be read authorizes nothing. Grants are
    // dropped and the gateway is forced off rather than trusting a file whose
    // record of what was withdrawn is damaged; the grants themselves are still
    // in the file, and stay there until something writes settings again.
    return {
      ...defaults,
      projectRoots,
      templateScaffoldFolder,
      diagnosticsLogFolder,
      taskCategories: Array.isArray(value.taskCategories)
        ? normalizeTaskCategories(value.taskCategories)
        : defaults.taskCategories,
      agentVaultId:
        typeof value.agentVaultId === 'string'
          ? normalizeIdentifier(value.agentVaultId)
          : '',
      agentGatewayEnabled: false,
      agentGrants: [],
      revokedAgentGrantIds: [],
    };
  }

  const revokedAgentGrantIds = Array.isArray(value.revokedAgentGrantIds)
    ? normalizeRevokedGrantIds(value.revokedAgentGrantIds)
    : defaults.revokedAgentGrantIds;
  const revoked = new Set(revokedAgentGrantIds);

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
    // A recorded revocation outranks an entry for the same grant, wherever the
    // two arrive together. Filtering here rather than only where a synced file
    // is adopted is what makes it survive a restart: load is the path with no
    // previous settings to merge against, so a file carrying both a restored
    // grant and the id that withdrew it would otherwise come back authorized.
    agentGrants: Array.isArray(value.agentGrants)
      ? normalizeAgentGrants(value.agentGrants).filter(
          (grant) => !revoked.has(grant.id),
        )
      : [],
    revokedAgentGrantIds,
  };
}

/**
 * Normalizes stored revoked ids through the same identifier rule grants are
 * stored under, so a tombstone and the grant it withdraws always compare equal.
 */
export function normalizeRevokedGrantIds(
  values: readonly unknown[],
): readonly string[] {
  const ids = new Set<string>();
  for (const value of values) {
    const id = normalizeIdentifier(value);
    if (id.length > 0) ids.add(id);
  }
  return [...ids].sort((left, right) => left.localeCompare(right));
}

/**
 * The union of two revoked-id sets.
 *
 * Union rather than replacement is the whole mechanism: adopting a file that
 * omits an id this device already holds must not drop it, or a stale save
 * would undo a revocation exactly as it did before these existed.
 */
export function mergeRevokedGrantIds(
  left: readonly string[],
  right: readonly string[],
): readonly string[] {
  return normalizeRevokedGrantIds([...left, ...right]);
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
