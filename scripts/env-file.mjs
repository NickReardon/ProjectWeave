import { resolve } from 'node:path';

/**
 * Loads an optional `.env` beside the repository root.
 *
 * The install target is a machine-specific absolute path, so it cannot be
 * committed; a Git-ignored `.env` keeps it out of the shell history and out of
 * every command. `.env.example` documents the shape and is committed.
 *
 * Node's own loader is used rather than a dependency, and it never overwrites a
 * variable the environment already carries. Precedence is therefore an
 * explicit variable first, then `.env`, then the pointer file — most specific
 * to least, and a one-off `PROJECT_WEAVE_TEST_VAULT=... npm run ...` always
 * wins over the file.
 */
export const DEFAULT_ENV_FILE = '.env';

export function loadEnvFile(path = resolve(DEFAULT_ENV_FILE)) {
  try {
    process.loadEnvFile(path);
    return { loaded: true, path };
  } catch (error) {
    // A missing file is the ordinary case: the pointer file and an explicit
    // variable both work without one.
    if (error?.code === 'ENOENT') {
      return { loaded: false, path };
    }
    throw error;
  }
}
