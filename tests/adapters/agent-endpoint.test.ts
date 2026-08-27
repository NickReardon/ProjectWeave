import * as network from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';

import { localAgentEndpoint } from '../../src/adapters/desktop/agent-endpoint';

/**
 * The shortest `sun_path` any supported platform offers. macOS stops at 104
 * bytes and Linux at 108, so a path that fits the smaller one fits everywhere
 * a socket is used at all.
 */
const SHORTEST_SOCKET_PATH_LIMIT = 104;

/** `TMPDIR` as macOS hands it out: 49 bytes, trailing separator included. */
const MACOS_TMPDIR = '/var/folders/wt/cp0fw11j0gx6nl85g1m353200000gp/T/';

const originalTmpdir = process.env['TMPDIR'];

afterEach(() => {
  if (originalTmpdir === undefined) delete process.env['TMPDIR'];
  else process.env['TMPDIR'] = originalTmpdir;
});

describe.skipIf(process.platform === 'win32')('localAgentEndpoint', () => {
  it('derives the same endpoint every time for a vault id', () => {
    // A grant's configuration is delivered exactly once and is written before
    // the gateway has ever bound, so the value handed out has to be the value
    // bound later.
    const id = 'd6f4a3b0-6d0e-4b7a-9f1e-6c2b0a7d5e31';
    expect(localAgentEndpoint(id)).toBe(localAgentEndpoint(id));
    expect(localAgentEndpoint(id)).not.toBe(localAgentEndpoint(`${id}-other`));
  });

  it('fits the shortest platform limit under the longest TMPDIR we ship against', () => {
    // The regression. The vault id is a UUID, and spelling it in full under a
    // macOS TMPDIR came to 105 bytes — one past the limit — so the gateway
    // could not bind at all on a stock macOS install.
    process.env['TMPDIR'] = MACOS_TMPDIR;
    const endpoint = localAgentEndpoint('d6f4a3b0-6d0e-4b7a-9f1e-6c2b0a7d5e31');

    expect(endpoint.length).toBeLessThanOrEqual(SHORTEST_SOCKET_PATH_LIMIT);
    // Not merely inside the limit: far enough inside that a longer TMPDIR than
    // macOS hands out does not put it back over.
    expect(endpoint.length).toBeLessThanOrEqual(
      SHORTEST_SOCKET_PATH_LIMIT - 16,
    );
  });

  it('does not double the separator TMPDIR already carries', () => {
    // macOS ends TMPDIR with a separator and Linux does not. The wasted byte
    // was the whole of the overage.
    process.env['TMPDIR'] = MACOS_TMPDIR;
    expect(localAgentEndpoint('vault')).not.toContain('//');
    process.env['TMPDIR'] = '/tmp';
    expect(localAgentEndpoint('vault')).toBe(localAgentEndpoint('vault'));
  });

  it('names a path the platform will actually bind', async () => {
    // The assertion the length budget exists to serve, made against the
    // running kernel rather than against our arithmetic about it.
    const endpoint = localAgentEndpoint(crypto.randomUUID());
    const server = network.createServer();
    try {
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.once('listening', resolve);
        server.listen(endpoint);
      });
      expect(server.listening).toBe(true);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
