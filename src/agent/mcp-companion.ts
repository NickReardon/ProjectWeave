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

const endpoint = requiredEnvironment('PROJECT_WEAVE_ENDPOINT');
const grantId = requiredEnvironment('PROJECT_WEAVE_GRANT_ID');
const secret = requiredEnvironment('PROJECT_WEAVE_GRANT_SECRET');

let bridge: BridgeClient;
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
      const response = await bridge.request(operation, input);
      const value = response.ok ? response.result : response.error;
      return {
        content: [
          { type: 'text' as const, text: JSON.stringify(value, null, 2) },
        ],
        ...(response.ok
          ? { structuredContent: asObject(response.result) }
          : { isError: true }),
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

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (value === undefined || value.length === 0) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : { value };
}

async function main(): Promise<void> {
  bridge = new BridgeClient(endpoint, grantId, secret);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
