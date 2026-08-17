import type { ProjectWeaveQueryApi } from './query-api';

export const READ_ONLY_AGENT_OPERATIONS = [
  'projects_list',
  'project_context',
  'search',
  'read_note',
  'related_work',
  'focus',
  'sequence',
  'action_context',
  'creation_context',
  'diagnostics',
] as const;

export type ReadOnlyAgentOperation =
  (typeof READ_ONLY_AGENT_OPERATIONS)[number];

export interface AgentGrant {
  readonly id: string;
  readonly label: string;
  readonly vaultId: string;
  readonly projectPath: string;
  readonly contentRoots: readonly string[];
  readonly secretDigest: string;
  readonly enabled: boolean;
}

export interface AgentGatewayRequest {
  readonly requestId: string;
  readonly companionVersion: string;
  readonly grantId: string;
  readonly secret: string;
  readonly operation: ReadOnlyAgentOperation;
  readonly input?: Readonly<Record<string, unknown>>;
}

export type AgentGatewayResponse =
  | {
      readonly requestId: string;
      readonly ok: true;
      readonly result: unknown;
    }
  | {
      readonly requestId: string;
      readonly ok: false;
      readonly error: {
        readonly code: string;
        readonly message: string;
      };
    };

export type SecretDigester = (secret: string) => Promise<string>;

/**
 * Grant-scoped adapter over the same application API the UI consumes.
 *
 * It owns no parsing, readiness, search, or path rules. Most importantly, it
 * overwrites every caller-supplied project/root value with the authenticated
 * grant, so schema translation can never widen authority accidentally.
 */
export class ReadOnlyAgentGateway {
  readonly #enabled: () => boolean;
  readonly #vaultId: () => string;
  readonly #grants: () => readonly AgentGrant[];
  readonly #pluginVersion: () => string;
  readonly #queryApi: () => ProjectWeaveQueryApi;
  readonly #digestSecret: SecretDigester;

  public constructor(options: {
    readonly enabled: () => boolean;
    readonly vaultId: () => string;
    readonly grants: () => readonly AgentGrant[];
    readonly pluginVersion: () => string;
    readonly queryApi: () => ProjectWeaveQueryApi;
    readonly digestSecret: SecretDigester;
  }) {
    this.#enabled = options.enabled;
    this.#vaultId = options.vaultId;
    this.#grants = options.grants;
    this.#pluginVersion = options.pluginVersion;
    this.#queryApi = options.queryApi;
    this.#digestSecret = options.digestSecret;
  }

  public async handle(
    request: AgentGatewayRequest,
  ): Promise<AgentGatewayResponse> {
    if (!this.#enabled()) {
      return denied(
        request.requestId,
        'gateway.disabled',
        'The agent gateway is disabled.',
      );
    }
    const grant = this.#grants().find(
      (candidate) =>
        candidate.enabled &&
        candidate.id === request.grantId &&
        candidate.vaultId === this.#vaultId(),
    );
    if (
      grant === undefined ||
      !constantTimeEqual(
        await this.#digestSecret(request.secret),
        grant.secretDigest,
      )
    ) {
      return denied(
        request.requestId,
        'gateway.authentication_failed',
        'The grant credentials are invalid.',
      );
    }
    const pluginVersion = this.#pluginVersion();
    if (request.companionVersion !== pluginVersion) {
      return denied(
        request.requestId,
        'gateway.companion_incompatible',
        `MCP companion ${request.companionVersion || 'unknown'} is incompatible with Project Weave ${pluginVersion}. Install project-weave-mcp.cjs from the same release tag.`,
      );
    }

    try {
      const input = request.input ?? {};
      const projectPath = grant.projectPath;
      const contentRoots = grant.contentRoots.filter((root) =>
        isWithin(root, projectContentRoot(projectPath)),
      );
      const api = this.#queryApi();
      let result: unknown;
      switch (request.operation) {
        case 'projects_list':
          result = await api.listProjects({
            ...pageInput(input),
            permittedProjectPaths: [projectPath],
          });
          break;
        case 'project_context':
          result = await api.getProjectContext({ projectPath });
          break;
        case 'search':
          result = await api.search({
            ...input,
            projectPath,
            contentRoots,
          });
          break;
        case 'read_note':
          result = await api.readNote({
            ...input,
            projectPath,
            path: requiredString(input.path, 'path'),
            contentRoots,
          });
          break;
        case 'related_work':
          result = await api.getRelatedWork({
            ...pageInput(input),
            projectPath,
            notePath: requiredString(input.notePath, 'notePath'),
            ...(optionalString(input.heading) === undefined
              ? {}
              : { heading: optionalString(input.heading) }),
          });
          break;
        case 'focus':
          result = await api.getReadyNow({
            ...pageInput(input),
            projectPath,
            ...(optionalString(input.owner) === undefined
              ? {}
              : { owner: optionalString(input.owner) }),
          });
          break;
        case 'sequence':
          result = await api.getSequence({
            ...pageInput(input),
            projectPath,
            includeTerminal: input.includeTerminal === true,
          });
          break;
        case 'action_context':
          result = await api.getActionContext({
            projectPath,
            taskPath: requiredString(input.taskPath, 'taskPath'),
          });
          break;
        case 'creation_context':
          result = await api.getCreationContext({ projectPath, kind: 'task' });
          break;
        case 'diagnostics':
          result = await api.getDiagnostics({
            ...pageInput(input),
            projectPath,
          });
          break;
      }
      return { requestId: request.requestId, ok: true, result };
    } catch (error) {
      return denied(
        request.requestId,
        'gateway.request_invalid',
        error instanceof Error ? error.message : 'The request is invalid.',
      );
    }
  }
}

function pageInput(input: Readonly<Record<string, unknown>>): {
  readonly cursor?: string;
  readonly limit?: number;
} {
  return {
    ...(optionalString(input.cursor) === undefined
      ? {}
      : { cursor: optionalString(input.cursor) }),
    ...(typeof input.limit === 'number' ? { limit: input.limit } : {}),
  };
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`\`${field}\` must be a non-empty string.`);
  }
  return value;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function constantTimeEqual(left: string, right: string): boolean {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |=
      (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

function denied(
  requestId: string,
  code: string,
  message: string,
): AgentGatewayResponse {
  return { requestId, ok: false, error: { code, message } };
}

function projectContentRoot(projectPath: string): string {
  const normalized = projectPath.replaceAll('\\', '/');
  if (normalized.toLowerCase().endsWith('/project.md')) {
    return normalized.slice(0, -'/Project.md'.length);
  }
  return normalized.replace(/\.md$/iu, '');
}

function isWithin(path: string, root: string): boolean {
  return path === root || path.startsWith(root + '/');
}
