/**
 * Pure logic behind the agent grant creation dialog: parsing the
 * content-roots field, the local resolution gate that decides whether the
 * create action is pressable, the one-line scope description the grant list
 * shows, and the client configuration copied on creation. Nothing here
 * touches Obsidian, so it is directly testable without emulating the vault
 * or the dialog's DOM.
 *
 * See "Grant lifecycle and creation" in
 * `docs/spec/agent-access-and-mcp.md` for the rules this implements: scope
 * is an explicit choice rather than inferred from an empty field,
 * metadata-only is unconditionally resolvable and carries no content roots,
 * and an empty folder list in the content-readable state does not resolve.
 *
 * The grant name is required at this dialog, with no default and no
 * prefill: a fallback to the project title would let two grants serving
 * different tools on the same project both be named after the project,
 * looking meaningful while carrying no information. This is a UI-level
 * requirement only — the application layer (`main.ts#createAgentGrant`)
 * still tolerates a blank label and falls back to the project title, and
 * that fallback is intentionally left in place.
 */

/** The two read levels a grant may choose, stated explicitly rather than inferred. */
export type AgentGrantScope = 'metadata' | 'content';

export interface AgentGrantFormFields {
  /**
   * Which tool the grant is for. Required at the dialog: a fallback to the
   * project title would let two grants serving different tools on the same
   * project both end up named after the project, so the name would look
   * meaningful while carrying no information. Only the user can answer
   * "which tool is this for" — see the settled design record in
   * [[Tasks/Move agent grant creation into a dialog]].
   */
  readonly label: string;
  readonly projectPath: string;
  readonly scope: AgentGrantScope;
  /** Comma-separated, only meaningful when `scope` is `'content'`. */
  readonly contentRootsRaw: string;
}

export interface AgentGrantResolution {
  readonly ready: boolean;
  /** Parsed, trimmed content roots; empty for a metadata-only grant. */
  readonly contentRoots: readonly string[];
  /** Which field is unresolved and why, or `null` once everything resolves. */
  readonly problem: string | null;
}

/** Splits, trims, and drops empty segments from a comma-separated folder list. */
export function parseContentRoots(raw: string): string[] {
  return raw
    .split(',')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}

/**
 * The local resolution gate for grant creation: the chosen project must name
 * an indexed project, and — only when note text is readable — every chosen
 * folder must exist in the vault. Both predicates are supplied by the caller
 * so this stays free of any Obsidian or index dependency; the dialog passes
 * in checks backed by the live index and vault.
 */
export function resolveAgentGrantForm(
  fields: AgentGrantFormFields,
  isIndexedProject: (path: string) => boolean,
  folderExists: (path: string) => boolean,
): AgentGrantResolution {
  if (fields.label.trim().length === 0) {
    return {
      ready: false,
      contentRoots: [],
      problem: 'Name which tool this grant is for.',
    };
  }
  const projectPath = fields.projectPath.trim();
  if (projectPath.length === 0) {
    return { ready: false, contentRoots: [], problem: 'Choose a project.' };
  }
  if (!isIndexedProject(projectPath)) {
    return {
      ready: false,
      contentRoots: [],
      problem: `"${projectPath}" is not an indexed project. Choose one of the suggested projects.`,
    };
  }
  if (fields.scope === 'metadata') {
    return { ready: true, contentRoots: [], problem: null };
  }

  const contentRoots = parseContentRoots(fields.contentRootsRaw);
  if (contentRoots.length === 0) {
    return {
      ready: false,
      contentRoots,
      problem: 'Add at least one content folder, or switch to metadata only.',
    };
  }
  const missing = contentRoots.find((root) => !folderExists(root));
  if (missing !== undefined) {
    return {
      ready: false,
      contentRoots,
      problem: `"${missing}" is not an existing vault folder.`,
    };
  }
  return { ready: true, contentRoots, problem: null };
}

/**
 * What a grant permits, in one line, for the grant list and for status text.
 * Stated plainly rather than left for a reader to infer from a bare folder
 * list — see [[Tasks/Describe what each agent grant permits in the grant
 * list]].
 */
export function describeAgentGrantScope(
  contentRoots: readonly string[],
): string {
  return contentRoots.length === 0
    ? 'Entity metadata only'
    : `Note text in ${contentRoots.join(', ')}`;
}

export interface AgentClientConfigurationInput {
  readonly endpoint: string | null;
  readonly grantId: string;
  readonly secret: string;
}

/**
 * The server key used in the copied `mcpServers` entry, matching the key
 * README's "Read-only agent access" worked example uses.
 */
export const AGENT_MCP_SERVER_KEY = 'project-weave';

/**
 * Stands in for the one value the plugin cannot know: where the reader put
 * `project-weave-mcp.cjs`. Angle brackets keep it unmistakable as something
 * to fill in, not a real path, even to someone who pastes the block and
 * reads nothing else.
 */
export const AGENT_MCP_COMPANION_PATH_PLACEHOLDER =
  '<path to project-weave-mcp.cjs>';

/**
 * A complete, ready-to-paste `mcpServers` entry for the companion — the
 * whole configuration a client needs, the way a WireGuard peer config
 * arrives whole rather than as loose fields the reader must assemble
 * themselves. Endpoint, grant id, and secret are filled in; the one thing
 * only the reader can know — where they placed `project-weave-mcp.cjs` — is
 * left as an unmistakable placeholder in `args` rather than omitted, since an
 * unknown value is a reason to mark it, not a reason to drop it.
 *
 * `endpoint` is `null` when the gateway is currently disabled; creation
 * still succeeds in that case (resolution is local and gateway-independent),
 * so the field is emitted empty rather than omitted.
 */
export function agentClientConfigurationJson(
  input: AgentClientConfigurationInput,
): string {
  return JSON.stringify(
    {
      mcpServers: {
        [AGENT_MCP_SERVER_KEY]: {
          command: 'node',
          args: [AGENT_MCP_COMPANION_PATH_PLACEHOLDER],
          env: {
            PROJECT_WEAVE_ENDPOINT: input.endpoint ?? '',
            PROJECT_WEAVE_GRANT_ID: input.grantId,
            PROJECT_WEAVE_GRANT_SECRET: input.secret,
          },
        },
      },
    },
    null,
    2,
  );
}
