/**
 * Pure grant minting and containment rules for read-only agent access.
 *
 * `ProjectWeavePlugin.createAgentGrant` can only be constructed by loading an
 * Obsidian plugin, but the rule that keeps a grant's content roots inside its
 * own project is a security boundary, not plugin wiring: it is what prevents
 * a granted agent from reading another project's notes. This module owns that
 * rule together with grant minting, importing nothing from `obsidian` or a
 * `node:*` global. An identifier source and a secret digester are injected
 * rather than reached for globally, so both can be exercised deterministically
 * in tests; `main.ts` supplies the real `crypto`-backed implementations.
 *
 * `ReadOnlyAgentGateway` re-checks the same containment at request time
 * through `projectContentRoot` and `isWithinContentRoot`, so minting and
 * enforcement can never diverge.
 */

export interface AgentGrant {
  readonly id: string;
  readonly label: string;
  readonly vaultId: string;
  readonly projectPath: string;
  readonly contentRoots: readonly string[];
  readonly secretDigest: string;
  readonly enabled: boolean;
}

/** Produces one fresh, unpredictable identifier per call. */
export type IdentifierSource = () => string;

/** Digests a plaintext secret into the form persisted on a grant. */
export type SecretDigester = (secret: string) => Promise<string>;

export interface MintAgentGrantInput {
  readonly label: string;
  /** Used as the grant's label when `label` is blank. */
  readonly fallbackLabel: string;
  readonly vaultId: string;
  /** Assumed already a normalized vault-relative Markdown path. */
  readonly projectPath: string;
  /** Assumed already normalized, deduplicated vault-relative folder paths. */
  readonly contentRoots: readonly string[];
}

export interface MintAgentGrantDependencies {
  readonly nextIdentifier: IdentifierSource;
  readonly digestSecret: SecretDigester;
}

/**
 * Mint a new agent grant, or throw when a requested content root escapes the
 * project it is scoped to. Path normalization is the caller's responsibility;
 * this function decides containment only.
 *
 * The returned secret is plaintext and must never be persisted: only
 * `grant.secretDigest`, produced by the injected `digestSecret`, is meant for
 * storage.
 */
export async function mintAgentGrant(
  input: MintAgentGrantInput,
  dependencies: MintAgentGrantDependencies,
): Promise<{ readonly grant: AgentGrant; readonly secret: string }> {
  const projectRoot = projectContentRoot(input.projectPath);
  if (
    input.contentRoots.some((root) => !isWithinContentRoot(root, projectRoot))
  ) {
    throw new Error(
      'Grant content folders must stay inside the selected project.',
    );
  }
  const id = dependencies.nextIdentifier();
  const secret = `${dependencies.nextIdentifier()}.${dependencies.nextIdentifier()}`;
  const grant: AgentGrant = {
    id,
    label:
      input.label.trim().length === 0
        ? input.fallbackLabel
        : input.label.trim(),
    vaultId: input.vaultId,
    projectPath: input.projectPath,
    contentRoots: input.contentRoots,
    secretDigest: await dependencies.digestSecret(secret),
    enabled: true,
  };
  return { grant, secret };
}

/**
 * The vault-folder boundary that scopes an agent grant to one project: the
 * project note's own folder when `projectPath` follows the ADR-0012
 * `<root>/<Title>/Project.md` convention, otherwise `projectPath` with its
 * `.md` extension removed. Backslashes are normalized first so a
 * Windows-shaped path still matches.
 */
export function projectContentRoot(projectPath: string): string {
  const normalized = projectPath.replaceAll('\\', '/');
  if (normalized.toLowerCase().endsWith('/project.md')) {
    return normalized.slice(0, -'/Project.md'.length);
  }
  return normalized.replace(/\.md$/iu, '');
}

/**
 * Whether `path` is exactly `root` or nested beneath it. A plain
 * `startsWith(root)` would also match a sibling folder whose name happens to
 * share `root` as a prefix (`Projects/Game2` against `Projects/Game`), so the
 * separator is required.
 *
 * A `.` or `..` segment in either argument is refused outright rather than
 * resolved. Prefix matching cannot see through traversal - `Projects/Game/../
 * Other` starts with `Projects/Game/` and would otherwise be accepted as
 * contained - and this is a security boundary, so it fails closed instead of
 * trusting callers to have normalized first. Every path reaching it today is
 * already normalized by `normalizeVaultFolderPath`, which rejects those
 * segments, so nothing reachable changes; the guard is what keeps that true
 * for a future caller that forgets.
 */
export function isWithinContentRoot(path: string, root: string): boolean {
  if (hasRelativeSegment(path) || hasRelativeSegment(root)) return false;
  return path === root || path.startsWith(root + '/');
}

function hasRelativeSegment(path: string): boolean {
  return path.split('/').some((segment) => segment === '.' || segment === '..');
}
