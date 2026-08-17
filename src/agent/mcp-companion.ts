#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createConnection, type Socket } from 'node:net';
import * as z from 'zod/v4';

import type {
  AgentGatewayResponse,
  ReadOnlyAgentOperation,
} from '../application/read-only-agent-gateway';

declare const PROJECT_WEAVE_VERSION: string;

const REQUIRED_ENVIRONMENT_NAMES = [
  'PROJECT_WEAVE_ENDPOINT',
  'PROJECT_WEAVE_GRANT_ID',
  'PROJECT_WEAVE_GRANT_SECRET',
] as const;

/**
 * A lightweight, always-permitted operation used only to prove at connect
 * time that the gateway is reachable, authenticated, and running a
 * compatible release. It exercises the exact same authentication and
 * version-handshake path as every other operation (see
 * `ReadOnlyAgentGateway.handle`), so a mismatched/disabled/revoked gateway
 * fails here instead of on the first real tool call.
 */
const HANDSHAKE_OPERATION: ReadOnlyAgentOperation = 'projects_list';

let bridge: BridgeClient;
let endpoint = '';

const server = new McpServer(
  { name: 'project-weave', version: PROJECT_WEAVE_VERSION },
  { capabilities: { tools: {} } },
);

const pageShape = {
  cursor: z.string().optional(),
  limit: z.number().int().positive().max(200).optional(),
};

register(
  'weave_projects_list',
  'List the project permitted by this local grant.',
  {},
  'projects_list',
);
register(
  'weave_project_context',
  'Read workflow capabilities and policy for the granted project.',
  {},
  'project_context',
);
register(
  'weave_search',
  'Search bounded entity metadata and explicitly permitted Markdown content.',
  {
    query: z.string().optional(),
    kinds: z
      .array(z.enum(['project', 'epic', 'task', 'milestone', 'sprint']))
      .optional(),
    statuses: z.array(z.string()).optional(),
    includeTerminal: z.boolean().optional(),
    includeBody: z.boolean().optional(),
    mode: z.enum(['substring', 'words', 'fuzzy']).optional(),
    ...pageShape,
  },
  'search',
);
register(
  'weave_read_note',
  'Read one exact permitted Markdown note or heading with fingerprinted, bounded output.',
  {
    path: z.string().min(1),
    heading: z.string().optional(),
    cursor: z.string().optional(),
    maxBytes: z.number().int().positive().max(65_536).optional(),
  },
  'read_note',
);
register(
  'weave_related_work',
  'Find work whose origin points to a document or heading.',
  { notePath: z.string().min(1), heading: z.string().optional(), ...pageShape },
  'related_work',
);
register(
  'weave_focus',
  'Read Ready Now, or owner-filtered My Work when owner is supplied.',
  { owner: z.string().optional(), ...pageShape },
  'focus',
);
register(
  'weave_sequence',
  'Read a bounded dependency-respecting task sequence.',
  { includeTerminal: z.boolean().optional(), ...pageShape },
  'sequence',
);
register(
  'weave_action_context',
  'Read current task readiness and enabled or disabled actions.',
  { taskPath: z.string().min(1) },
  'action_context',
);
register(
  'weave_creation_context',
  'Read available task template variants and the task destination.',
  {},
  'creation_context',
);
register(
  'weave_diagnostics',
  'Read bounded validation diagnostics for the granted project.',
  pageShape,
  'diagnostics',
);

function register(
  name: string,
  description: string,
  inputSchema: z.ZodRawShape,
  operation: ReadOnlyAgentOperation,
): void {
  server.registerTool(
    name,
    { description, inputSchema },
    async (input: Readonly<Record<string, unknown>>) => {
      let response: AgentGatewayResponse;
      try {
        response = await bridge.request(operation, input);
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: describeTransportFailure(error, endpoint),
            },
          ],
          isError: true,
        };
      }
      if (!response.ok) {
        return {
          content: [
            {
              type: 'text' as const,
              text: describeGatewayFailure(response.error),
            },
          ],
          isError: true,
        };
      }
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(response.result, null, 2),
          },
        ],
        structuredContent: asObject(response.result),
      };
    },
  );
}

class BridgeClient {
  readonly #endpoint: string;
  readonly #grantId: string;
  readonly #secret: string;
  readonly #pending = new Map<
    string,
    {
      readonly resolve: (response: AgentGatewayResponse) => void;
      readonly reject: (error: Error) => void;
    }
  >();
  #socket: Socket | null = null;
  #buffer = '';
  #counter = 0;

  public constructor(
    endpointValue: string,
    grantIdValue: string,
    secretValue: string,
  ) {
    this.#endpoint = endpointValue;
    this.#grantId = grantIdValue;
    this.#secret = secretValue;
  }

  public async request(
    operation: ReadOnlyAgentOperation,
    input: Readonly<Record<string, unknown>>,
  ): Promise<AgentGatewayResponse> {
    const socket = await this.#connect();
    this.#counter += 1;
    const requestId = `mcp:${String(this.#counter)}`;
    return await new Promise<AgentGatewayResponse>((resolve, reject) => {
      this.#pending.set(requestId, { resolve, reject });
      socket.write(
        JSON.stringify({
          requestId,
          companionVersion: PROJECT_WEAVE_VERSION,
          grantId: this.#grantId,
          secret: this.#secret,
          operation,
          input,
        }) + '\n',
        (error) => {
          if (error === null || error === undefined) return;
          this.#pending.delete(requestId);
          reject(error);
        },
      );
    });
  }

  async #connect(): Promise<Socket> {
    if (this.#socket !== null && !this.#socket.destroyed) return this.#socket;
    const socket = createConnection(this.#endpoint);
    socket.setEncoding('utf8');
    socket.on('data', (chunk: string) => this.#receive(chunk));
    socket.on('close', () =>
      this.#failAll(new Error('Project Weave bridge closed.')),
    );
    socket.on('error', (error) => this.#failAll(error));
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('error', reject);
    });
    this.#socket = socket;
    return socket;
  }

  #receive(chunk: string): void {
    this.#buffer += chunk;
    let newline = this.#buffer.indexOf('\n');
    while (newline >= 0) {
      const line = this.#buffer.slice(0, newline).trim();
      this.#buffer = this.#buffer.slice(newline + 1);
      if (line.length > 0) {
        const response = JSON.parse(line) as AgentGatewayResponse;
        const pending = this.#pending.get(response.requestId);
        if (pending !== undefined) {
          this.#pending.delete(response.requestId);
          pending.resolve(response);
        }
      }
      newline = this.#buffer.indexOf('\n');
    }
  }

  #failAll(error: Error): void {
    this.#socket = null;
    for (const pending of this.#pending.values()) pending.reject(error);
    this.#pending.clear();
  }
}

/**
 * Reads every required environment variable and reports every missing or
 * blank one together, instead of throwing on the first. Callers must invoke
 * this from inside the async entry point so a missing variable is routed
 * through the same one-line error formatter as every other startup failure,
 * rather than escaping as an unhandled synchronous throw during module
 * evaluation.
 */
function collectRequiredEnvironment(
  names: readonly string[],
): Record<string, string> {
  const missing: string[] = [];
  const values: Record<string, string> = {};
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value === undefined || value.length === 0) {
      missing.push(name);
    } else {
      values[name] = value;
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `${formatList(missing)} ${missing.length === 1 ? 'is' : 'are'} required.`,
    );
  }
  return values;
}

function formatList(items: readonly string[]): string {
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]!} and ${items[1]!}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]!}`;
}

const GATEWAY_ERROR_REMEDY: Partial<Record<string, string>> = {
  'gateway.disabled':
    'Enable the agent gateway for this vault in Obsidian: Project Weave settings > Agent Access.',
  'gateway.authentication_failed':
    'The grant may have been revoked or the secret rotated. Create a new grant in Project Weave settings and update PROJECT_WEAVE_GRANT_ID and PROJECT_WEAVE_GRANT_SECRET.',
};

/**
 * Turns a denial returned by the gateway itself into actionable guidance.
 * The gateway already names a stable error code and a human-readable cause
 * (see `ReadOnlyAgentGateway.handle`); this only appends a concrete remedy
 * where one is not already implied by the message.
 */
function describeGatewayFailure(error: {
  readonly code: string;
  readonly message: string;
}): string {
  const remedy = GATEWAY_ERROR_REMEDY[error.code];
  return remedy === undefined ? error.message : `${error.message} ${remedy}`;
}

const DEFAULT_TRANSPORT_GUIDANCE =
  'Could not reach the Project Weave gateway at {endpoint}. Confirm Obsidian is running with this vault open and Agent Access enabled in Project Weave settings, and that PROJECT_WEAVE_ENDPOINT matches the endpoint shown there.';

const TRANSPORT_GUIDANCE_BY_CODE: Record<string, string> = {
  ENOENT: DEFAULT_TRANSPORT_GUIDANCE,
  ECONNREFUSED: DEFAULT_TRANSPORT_GUIDANCE,
  ETIMEDOUT:
    'Timed out reaching the Project Weave gateway at {endpoint}. Confirm Obsidian is running and responsive, and that Agent Access is enabled for this vault.',
  ECONNRESET:
    'The connection to the Project Weave gateway at {endpoint} was reset. The vault may have closed or Agent Access may have been disabled; reconnect after confirming it is enabled.',
  EPIPE:
    'The connection to the Project Weave gateway at {endpoint} closed unexpectedly. Reconnect after confirming Agent Access is still enabled for this vault.',
};

/**
 * Maps a raw transport/syscall failure (a dead endpoint, a refused
 * connection, a mid-session drop) to a message that names the likely cause
 * -- gateway not enabled, endpoint stale, vault closed -- and the remedy,
 * while keeping the original errno detail as secondary context. Never
 * includes the grant secret; only the endpoint path and the Node error text
 * are surfaced, neither of which carries the secret.
 */
function describeTransportFailure(
  error: unknown,
  endpointValue: string,
): string {
  const detail = error instanceof Error ? error.message : String(error);
  const code = errorCode(error);
  const guidance =
    (code === undefined ? undefined : TRANSPORT_GUIDANCE_BY_CODE[code]) ??
    DEFAULT_TRANSPORT_GUIDANCE;
  return `${guidance.replace('{endpoint}', endpointValue || '(not set)')} (${detail})`;
}

function errorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }
  const value = error.code;
  return typeof value === 'string' ? value : undefined;
}

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : { value };
}

async function main(): Promise<void> {
  const environment = collectRequiredEnvironment(REQUIRED_ENVIRONMENT_NAMES);
  endpoint = environment['PROJECT_WEAVE_ENDPOINT']!;
  const grantId = environment['PROJECT_WEAVE_GRANT_ID']!;
  const secret = environment['PROJECT_WEAVE_GRANT_SECRET']!;
  bridge = new BridgeClient(endpoint, grantId, secret);

  // Verify connectivity, authentication, and the companion/plugin version
  // handshake before serving any MCP request. Doing this eagerly at startup
  // -- rather than only on the first real tool call, and rather than
  // relying on the shape of a failed `initialize` response, which MCP
  // clients surface inconsistently -- guarantees a mismatched, disabled, or
  // revoked gateway is unmistakable: the process exits non-zero with one
  // actionable line before the stdio transport ever connects, so no client
  // can observe a "successful" connection to a companion that cannot
  // actually serve requests.
  let handshake: AgentGatewayResponse;
  try {
    handshake = await bridge.request(HANDSHAKE_OPERATION, {});
  } catch (error) {
    throw new Error(describeTransportFailure(error, endpoint), {
      cause: error,
    });
  }
  if (!handshake.ok) {
    throw new Error(describeGatewayFailure(handshake.error));
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
