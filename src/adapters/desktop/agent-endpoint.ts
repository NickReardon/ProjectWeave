/**
 * How much of the folded vault id names the endpoint.
 *
 * A Unix-domain socket path is bounded where nothing else about a vault id is:
 * macOS stops at 104 bytes, and its `TMPDIR` spends 49 of them before the name
 * begins. The vault id in full — 36 characters as a UUID — put the path one
 * byte past that limit, so the gateway could not bind at all on a default macOS
 * setup, and no test caught it because the tests built their paths the same
 * way.
 *
 * Sixteen hex characters leave the derived path at 84 bytes there, with room
 * for a longer `TMPDIR` than macOS hands out, and 64 bits is far more than
 * enough to separate the vault ids on one machine.
 */
const VAULT_TOKEN_LENGTH = 16;

const FNV_OFFSET_BASIS = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const SIXTY_FOUR_BITS = 0xffffffffffffffffn;

/**
 * Folds a vault id to a fixed-width, filename-safe token.
 *
 * FNV-1a rather than a digest because this module is bundled into a plugin
 * that also loads on mobile, where `node:crypto` does not exist and the release
 * gate refuses the import for exactly that reason. Nothing here is a security
 * boundary: the token names a socket, it does not authorize anything, and a
 * grant still authenticates by its own SHA-256 digest. Anyone able to choose a
 * vault id that collides with another one already writes this vault's
 * `data.json`.
 */
function foldVaultId(vaultId: string): string {
  let hash = FNV_OFFSET_BASIS;
  // Over UTF-8 bytes, so two ids that differ only beyond the BMP still differ
  // here.
  for (const byte of new TextEncoder().encode(vaultId)) {
    hash = ((hash ^ BigInt(byte)) * FNV_PRIME) & SIXTY_FOUR_BITS;
  }
  return hash.toString(16).padStart(VAULT_TOKEN_LENGTH, '0');
}

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
  const token = foldVaultId(vaultId);
  if (process.platform === 'win32') {
    return `\\\\.\\pipe\\project-weave-${token}`;
  }
  // `TMPDIR` carries a trailing separator on macOS and not on Linux. Joined
  // naively that produced `//`, one byte of pure waste in the one budget that
  // was already exhausted.
  const directory = (process.env['TMPDIR'] ?? '/tmp').replace(/\/+$/u, '');
  return `${directory}/project-weave-${token}.sock`;
}
