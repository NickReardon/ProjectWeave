import * as fileSystem from 'node:fs/promises';
import * as network from 'node:net';
import { describe, expect, it } from 'vitest';

import { LocalAgentBridge } from '../../src/adapters/desktop/local-agent-bridge';

describe('LocalAgentBridge', () => {
  it('opens only when started, forwards one NDJSON request, and closes cleanly', async () => {
    const endpoint =
      process.platform === 'win32'
        ? `\\\\.\\pipe\\project-weave-test-${crypto.randomUUID()}`
        : `${process.env['TMPDIR'] ?? '/tmp'}/project-weave-test-${crypto.randomUUID()}.sock`;
    const gateway = {
      handle: async (request: { readonly requestId: string }) => ({
        requestId: request.requestId,
        ok: true as const,
        result: { revision: 7 },
      }),
    };
    const bridge = new LocalAgentBridge(gateway, endpoint, {
      fileSystem,
      network,
    });
    expect(bridge.state).toEqual({ listening: false, endpoint: null });

    await bridge.start();
    expect(bridge.state).toEqual({ listening: true, endpoint });
    const response = await exchange(endpoint, {
      requestId: 'one',
      grantId: 'grant',
      secret: 'secret',
      operation: 'project_context',
    });
    expect(response).toEqual({
      requestId: 'one',
      ok: true,
      result: { revision: 7 },
    });

    await bridge.stop();
    expect(bridge.state).toEqual({ listening: false, endpoint: null });
  });
});

async function exchange(
  endpoint: string,
  request: Readonly<Record<string, unknown>>,
): Promise<unknown> {
  const socket = network.createConnection(endpoint);
  socket.setEncoding('utf8');
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('error', reject);
  });
  const response = await new Promise<string>((resolve, reject) => {
    socket.once('data', (chunk: string) => resolve(chunk));
    socket.once('error', reject);
    socket.write(JSON.stringify(request) + '\n');
  });
  socket.end();
  return JSON.parse(response.trim()) as unknown;
}
