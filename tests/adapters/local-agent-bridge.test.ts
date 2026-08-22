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

  // Unix-domain socket files have POSIX mode bits; Windows named pipes do
  // not, so there is nothing to assert there. Skipping keeps that gap
  // visible in the run instead of the assertion silently passing on a mode
  // value Windows does not have.
  it.skipIf(process.platform === 'win32')(
    'binds the Unix-domain socket file as owner-only',
    async () => {
      const endpoint = `${process.env['TMPDIR'] ?? '/tmp'}/project-weave-test-${crypto.randomUUID()}.sock`;
      const gateway = {
        handle: async (request: { readonly requestId: string }) => ({
          requestId: request.requestId,
          ok: true as const,
          result: { revision: 1 },
        }),
      };
      const bridge = new LocalAgentBridge(gateway, endpoint, {
        fileSystem,
        network,
      });
      // Force a permissive umask first. Without this the assertion can pass
      // by inheriting a restrictive one: under an ambient 0o077 the socket
      // would be 0600 whether or not start() hardened anything, so the test
      // would keep passing if the hardening were deleted.
      const ambientUmask = process.umask(0o000);

      try {
        await bridge.start();
        try {
          const stats = await fileSystem.stat(endpoint);
          expect(stats.mode & 0o777).toBe(0o600);
          // The tightened umask must not leak past start(): it is restored
          // before the listen result is awaited, so what is observable here
          // is the permissive mask this test installed, not 0o177.
          expect(process.umask()).toBe(0o000);
        } finally {
          await bridge.stop();
        }
      } finally {
        process.umask(ambientUmask);
      }
    },
  );
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
