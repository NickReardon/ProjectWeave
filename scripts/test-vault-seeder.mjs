import {
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';

/**
 * Materializes a disposable Obsidian vault for the manual checks, seeded from
 * the same fixture the automated tests use, so both start from one baseline.
 *
 * This deletes files, and a user's real vault is usually one directory away, so
 * every destructive path is gated on a manifest this tool wrote itself. A
 * directory it did not seed is never modified, whatever the arguments say.
 */

export const SEED_SOURCE = 'tests/fixtures/vault';
export const DEFAULT_VAULT_DIRECTORY = 'test-vault';
export const MANIFEST_NAME = '.project-weave-seed.json';
export const SEED_VERSION = 1;

const OBSIDIAN_FILES = {
  'app.json': '{}\n',
  'community-plugins.json': '["project-weave"]\n',
};

/** Rank gap matching the allocator's convention. */
const BULK_RANK_GAP = 1000;
const BULK_RANK_BASE = 100000;

export function bulkTaskNote(index) {
  const rank = BULK_RANK_BASE + index * BULK_RANK_GAP;
  return [
    '---',
    'type: task',
    "project: '[[Projects/Game/Project]]'",
    'status: todo',
    'rank: ' + String(rank),
    '---',
    '',
    '# Bulk ' + paddedIndex(index),
    '',
  ].join('\n');
}

export function paddedIndex(index) {
  return String(index).padStart(3, '0');
}

/**
 * Seeds a vault, or resets one this tool previously seeded.
 *
 * Reset preserves `.obsidian/`, so the installed plugin and its local settings
 * survive; reinstalling after every check would make resetting expensive
 * enough that nobody would do it.
 */
export async function seedTestVault({
  vaultPath = resolve(DEFAULT_VAULT_DIRECTORY),
  repositoryRoot = resolve('.'),
  seedSource = resolve(SEED_SOURCE),
  reset = false,
  scale = 0,
  allowOutsideRepository = false,
} = {}) {
  const vaultRoot = resolve(vaultPath);
  assertSafeTarget(vaultRoot, resolve(repositoryRoot), allowOutsideRepository);

  const existingManifest = await readManifest(vaultRoot);
  const exists = (await stat(vaultRoot).catch(() => null)) !== null;

  if (exists && existingManifest === null) {
    throw new Error(
      'Refusing to touch a directory this tool did not seed: ' +
        vaultRoot +
        '. Remove it yourself if it is disposable.',
    );
  }
  if (!exists && reset) {
    throw new Error('No seeded test vault to reset at ' + vaultRoot + '.');
  }

  const unknown =
    existingManifest === null
      ? []
      : await findUnknownNotes(vaultRoot, existingManifest);

  if (existingManifest !== null) {
    await removeSeededFiles(vaultRoot, existingManifest);
  }

  const seededFiles = await copySeed(seedSource, vaultRoot);
  for (let index = 1; index <= scale; index += 1) {
    const relativePath = join(
      'Projects',
      'Game',
      'Tasks',
      'Bulk ' + paddedIndex(index) + '.md',
    );
    await writeVaultFile(vaultRoot, relativePath, bulkTaskNote(index));
    seededFiles.push(toManifestPath(relativePath));
  }

  await writeObsidianDirectory(vaultRoot);

  const manifest = {
    seedVersion: SEED_VERSION,
    scale,
    files: [...seededFiles].sort(),
  };
  await writeFile(
    join(vaultRoot, MANIFEST_NAME),
    JSON.stringify(manifest, null, 2) + '\n',
    'utf8',
  );

  return { vaultRoot, files: manifest.files, unknown, reset };
}

/**
 * A target must be one this tool can safely own. Inside the repository is the
 * default; anywhere else has to be asked for explicitly, and even then the
 * manifest check above still applies.
 */
function assertSafeTarget(vaultRoot, repositoryRoot, allowOutsideRepository) {
  if (vaultRoot === repositoryRoot) {
    throw new Error('Refusing to seed over the repository root.');
  }
  const inside = vaultRoot.startsWith(repositoryRoot + sep);
  if (!inside && !allowOutsideRepository) {
    throw new Error(
      'Refusing to seed outside the repository without --allow-outside: ' +
        vaultRoot +
        '.',
    );
  }
}

async function readManifest(vaultRoot) {
  let raw;
  try {
    raw = await readFile(join(vaultRoot, MANIFEST_NAME), 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
  const manifest = JSON.parse(raw);
  if (!Array.isArray(manifest.files)) {
    throw new Error('The seed manifest is unreadable: ' + vaultRoot + '.');
  }
  return manifest;
}

/** Notes present in the vault that the manifest does not claim. */
async function findUnknownNotes(vaultRoot, manifest) {
  const seeded = new Set(manifest.files);
  const found = [];
  for (const relativePath of await listMarkdown(vaultRoot, '')) {
    if (!seeded.has(relativePath)) {
      found.push(relativePath);
    }
  }
  return found.sort();
}

async function listMarkdown(vaultRoot, prefix) {
  const directory = join(vaultRoot, prefix);
  const entries = await readdir(directory, { withFileTypes: true }).catch(
    () => [],
  );
  const found = [];
  for (const entry of entries) {
    if (entry.name === '.obsidian') {
      continue;
    }
    const relativePath = prefix === '' ? entry.name : prefix + '/' + entry.name;
    if (entry.isDirectory()) {
      found.push(...(await listMarkdown(vaultRoot, relativePath)));
    } else if (entry.name.endsWith('.md')) {
      found.push(relativePath);
    }
  }
  return found;
}

/**
 * Removes only what the manifest lists, then prunes the directories that
 * emptied. Files the user added survive, and are reported instead.
 */
async function removeSeededFiles(vaultRoot, manifest) {
  for (const relativePath of manifest.files) {
    const target = resolveInside(vaultRoot, relativePath);
    await rm(target, { force: true });
  }
  const directories = new Set(
    manifest.files
      .map((relativePath) => dirname(relativePath))
      .filter((directory) => directory !== '.'),
  );
  // Deepest first, so a nested folder empties before its parent is considered.
  for (const directory of [...directories].sort(
    (left, right) => right.length - left.length,
  )) {
    const target = resolveInside(vaultRoot, directory);
    const remaining = await readdir(target).catch(() => null);
    if (remaining !== null && remaining.length === 0) {
      await rm(target, { recursive: true, force: true });
    }
  }
}

async function copySeed(seedSource, vaultRoot) {
  const source = resolve(seedSource);
  const seeded = [];
  for (const relativePath of await listFiles(source, '')) {
    const content = await readFile(join(source, relativePath));
    await writeVaultFile(vaultRoot, relativePath, content);
    seeded.push(toManifestPath(relativePath));
  }
  if (seeded.length === 0) {
    throw new Error('The seed source contains no files: ' + source + '.');
  }
  return seeded;
}

async function listFiles(root, prefix) {
  const entries = await readdir(join(root, prefix), { withFileTypes: true });
  const found = [];
  for (const entry of entries) {
    const relativePath = prefix === '' ? entry.name : join(prefix, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await listFiles(root, relativePath)));
    } else {
      found.push(relativePath);
    }
  }
  return found;
}

async function writeVaultFile(vaultRoot, relativePath, content) {
  const target = resolveInside(vaultRoot, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content);
}

async function writeObsidianDirectory(vaultRoot) {
  const directory = join(vaultRoot, '.obsidian');
  await mkdir(directory, { recursive: true });
  for (const [name, content] of Object.entries(OBSIDIAN_FILES)) {
    const target = join(directory, name);
    if ((await stat(target).catch(() => null)) === null) {
      await writeFile(target, content, 'utf8');
    }
  }
}

/** Every write and delete resolves through here, so no path escapes the vault. */
function resolveInside(vaultRoot, relativePath) {
  const target = resolve(vaultRoot, relativePath);
  if (target !== vaultRoot && !target.startsWith(vaultRoot + sep)) {
    throw new Error('Refusing to touch a path outside the test vault.');
  }
  return target;
}

function toManifestPath(relativePath) {
  return relativePath.split(sep).join('/');
}

export const POINTER_NAME = '.project-weave-test-vault';

/**
 * Points the export installer at a vault.
 *
 * The pointer decides where the next build is installed, so an existing one is
 * never overwritten silently: it may aim at a vault the user is mid-session
 * with. Same target is a no-op, a different target refuses until forced.
 */
export async function writeTestVaultPointer({
  vaultRoot,
  pointerPath = resolve(POINTER_NAME),
  force = false,
}) {
  const target = resolve(vaultRoot);
  let existing = null;
  try {
    existing = (await readFile(pointerPath, 'utf8')).trim();
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  }

  if (existing !== null && existing.length > 0) {
    if (resolve(existing) === target) {
      return { written: false, reason: 'already', existing };
    }
    if (!force) {
      return { written: false, reason: 'conflict', existing };
    }
  }

  await writeFile(pointerPath, target + '\n', 'utf8');
  return { written: true, reason: existing === null ? 'created' : 'replaced' };
}

export function parseSeedArguments(argv) {
  const options = {
    reset: false,
    scale: 0,
    allowOutsideRepository: false,
    point: false,
    force: false,
  };
  let vaultPath = null;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--reset') {
      options.reset = true;
    } else if (argument === '--allow-outside') {
      options.allowOutsideRepository = true;
    } else if (argument === '--point') {
      options.point = true;
    } else if (argument === '--force') {
      options.force = true;
    } else if (argument === '--scale') {
      const value = Number(argv[index + 1]);
      if (!Number.isInteger(value) || value < 0 || value > 5000) {
        throw new Error('--scale expects a whole number of tasks up to 5000.');
      }
      options.scale = value;
      index += 1;
    } else if (argument === '--path') {
      vaultPath = argv[index + 1];
      if (vaultPath === undefined) {
        throw new Error('--path expects a directory.');
      }
      index += 1;
    } else {
      throw new Error('Unsupported test vault argument: ' + argument + '.');
    }
  }
  return vaultPath === null
    ? options
    : { ...options, vaultPath: resolve(vaultPath) };
}

if (process.argv[1]?.endsWith('test-vault-seeder.mjs') === true) {
  const options = parseSeedArguments(process.argv.slice(2));
  const result = await seedTestVault(options);
  console.log(
    (result.reset ? 'Test vault reset: ' : 'Test vault seeded: ') +
      result.vaultRoot +
      ' (' +
      String(result.files.length) +
      ' files)',
  );
  for (const unknown of result.unknown) {
    console.log('Left in place, not seeded: ' + unknown);
  }
  // Writing the pointer is opt-in: it decides where the next build installs,
  // and it may already aim at a vault the user cares about.
  if (!options.point) {
    console.log(
      'To install builds here, put this path in ' + POINTER_NAME + ':',
    );
    console.log('  ' + result.vaultRoot);
    console.log('Or re-run with --point to write it.');
  } else {
    const pointer = await writeTestVaultPointer({
      vaultRoot: result.vaultRoot,
      force: options.force,
    });
    if (pointer.written) {
      console.log(POINTER_NAME + ' now points at ' + result.vaultRoot);
    } else if (pointer.reason === 'already') {
      console.log(POINTER_NAME + ' already points at ' + result.vaultRoot);
    } else {
      throw new Error(
        POINTER_NAME +
          ' already points at ' +
          pointer.existing +
          '. Re-run with --force to repoint it at ' +
          result.vaultRoot +
          '.',
      );
    }
  }
}
