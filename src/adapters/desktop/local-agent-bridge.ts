import type {
  AgentGatewayRequest,
  AgentGatewayResponse,
} from '../../application/read-only-agent-gateway';
import type * as NodeFileSystemPromises from 'node:fs/promises';
import type * as NodeNetwork from 'node:net';
import type { Server, Socket } from 'node:net';

const MAX_REQUEST_BYTES = 1_048_576;

export interface LocalAgentBridgeState {
  readonly listening: boolean;
  readonly endpoint: string | null;
}

export interface AgentGatewayHandler {
  handle(request: AgentGatewayRequest): Promise<AgentGatewayResponse>;
}

interface LocalAgentBridgeNodeRuntime {
  readonly fileSystem: typeof NodeFileSystemPromises;
  readonly network: typeof NodeNetwork;
}

/** NDJSON bridge over a local named pipe or Unix-domain socket. */
export class LocalAgentBridge {
  readonly #gateway: AgentGatewayHandler;
  readonly #endpoint: string;
  #nodeRuntime: LocalAgentBridgeNodeRuntime | null;
  #server: Server | null = null;
  readonly #sockets = new Set<Socket>();

  public constructor(
    gateway: AgentGatewayHandler,
    endpoint: string,
    nodeRuntime: LocalAgentBridgeNodeRuntime | null = null,
  ) {
    this.#gateway = gateway;
    this.#endpoint = endpoint;
    this.#nodeRuntime = nodeRuntime;
  }

  public get state(): LocalAgentBridgeState {
    return {
      listening: this.#server?.listening === true,
      endpoint: this.#server?.listening === true ? this.#endpoint : null,
    };
  }

  public async start(): Promise<void> {
    if (this.#server !== null) return;
    const runtime = this.#nodeRuntime ?? loadNodeRuntime();
    this.#nodeRuntime = runtime;
    if (process.platform !== 'win32') {
      await runtime.fileSystem.rm(this.#endpoint, { force: true });
    }
    const server = runtime.network.createServer((socket) =>
      this.#accept(socket),
    );
    this.#server = server;
    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error): void => {
        server.off('listening', onListening);
        this.#server = null;
        reject(error);
      };
      const onListening = (): void => {
        server.off('error', onError);
        resolve();
      };
      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(this.#endpoint);
    });
  }

  public async stop(): Promise<void> {
    const server = this.#server;
    this.#server = null;
    for (const socket of this.#sockets) socket.destroy();
    this.#sockets.clear();
    if (server !== null) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (process.platform !== 'win32') {
      await this.#nodeRuntime?.fileSystem.rm(this.#endpoint, { force: true });
    }
  }

  #accept(socket: Socket): void {
    this.#sockets.add(socket);
    let buffered = '';
    socket.setEncoding('utf8');
    socket.on('data', (chunk: string) => {
      buffered += chunk;
      if (new TextEncoder().encode(buffered).byteLength > MAX_REQUEST_BYTES) {
        socket.destroy(
          new Error('Project Weave request exceeded the size limit.'),
        );
        return;
      }
      let newline = buffered.indexOf('\n');
      while (newline >= 0) {
        const line = buffered.slice(0, newline).trim();
        buffered = buffered.slice(newline + 1);
        if (line.length > 0) void this.#handleLine(socket, line);
        newline = buffered.indexOf('\n');
      }
    });
    socket.on('close', () => this.#sockets.delete(socket));
    socket.on('error', () => this.#sockets.delete(socket));
  }

  async #handleLine(socket: Socket, line: string): Promise<void> {
    let response: AgentGatewayResponse;
    try {
      response = await this.#gateway.handle(
        JSON.parse(line) as AgentGatewayRequest,
      );
    } catch {
      response = {
        requestId: '',
        ok: false,
        error: {
          code: 'gateway.request_invalid',
          message: 'The request is not valid JSON.',
        },
      };
    }
    if (!socket.destroyed) socket.write(JSON.stringify(response) + '\n');
  }
}

function loadNodeRuntime(): LocalAgentBridgeNodeRuntime {
  // These stay inside the desktop-only lazy adapter. Top-level Node imports
  // would make the otherwise mobile-compatible plugin fail during load.
  /* eslint-disable @typescript-eslint/no-require-imports -- intentional lazy desktop boundary */
  const network = require('node:net') as typeof NodeNetwork;
  const fileSystem =
    require('node:fs/promises') as typeof NodeFileSystemPromises;
  /* eslint-enable @typescript-eslint/no-require-imports */
  return { fileSystem, network };
}

export function localAgentEndpoint(vaultId: string): string {
  const safe = vaultId.toLowerCase().replace(/[^a-z0-9_-]/gu, '-');
  return process.platform === 'win32'
    ? `\\\\.\\pipe\\project-weave-${safe}`
    : `${process.env['TMPDIR'] ?? '/tmp'}/project-weave-${safe}.sock`;
}
