/**
 * The local endpoint the agent gateway listens on, and the one a client
 * configuration must carry.
 *
 * This is a pure function of the vault id and the platform, which is what lets
 * a client configuration be written before the gateway has ever run: the value
 * derived here is byte-for-byte the value `LocalAgentBridge` will bind when the
 * gateway is switched on. It lives in the desktop adapter rather than in
 * `application/` because it reads `process`, and application code stays
 * independent of Node.
 *
 * The result is machine-local by construction — a named pipe on Windows, a
 * socket under `TMPDIR` elsewhere — so a configuration copied on one machine
 * does not describe another.
 */
export function localAgentEndpoint(vaultId: string): string {
  const safe = vaultId.toLowerCase().replace(/[^a-z0-9_-]/gu, '-');
  return process.platform === 'win32'
    ? `\\\\.\\pipe\\project-weave-${safe}`
    : `${process.env['TMPDIR'] ?? '/tmp'}/project-weave-${safe}.sock`;
}
