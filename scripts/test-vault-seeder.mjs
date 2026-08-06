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

/**
 * Due dates the seeder injects into fixture tasks, as day offsets from the day
 * the vault is seeded.
 *
 * These cannot live in `tests/fixtures/vault/` with the rest of the baseline: a
 * committed date is a fixed date, and the **Due today** filter has to be
 * checked against the day the check is run. Offsets give one task in each due
 * state — past, today, and future — while the fourth fixture task keeps no due
 * date, which is the fourth state. The automated tests read the fixture
 * directly and so are unaffected.
 */
export const SEEDED_DUE_DATES = {
  'Projects/Game/Tasks/External prerequisite.md': -3,
  'Projects/Game/Tasks/Implement request.md': 0,
  'Projects/Game/Tasks/Blocked request.md': 7,
};

/** Rank gap matching the allocator's convention. */
const BULK_RANK_GAP = 1000;
const BULK_RANK_BASE = 100000;

/**
 * Values the bulk tasks cycle through, so a large seeded project exercises the
 * filters rather than being 250 copies of one task. Every list is short and
 * coprime-ish with the others, which spreads combinations without needing
 * randomness the seeder must not have.
 */
const BULK_OWNERS = ['Robin', 'Sam', 'Ash'];
const BULK_CATEGORIES = ['bug', 'chore', 'feature', 'spike'];
const BULK_PRIORITIES = ['critical', 'high', 'normal', 'low'];
const BULK_STATUSES = ['backlog', 'todo', 'in-progress', 'review', 'waiting'];
/** Day offsets from the seed date, covering every due state including none. */
const BULK_DUE_OFFSETS = [-7, -1, 0, 3, 21, null];

/**
 * One generated task, carrying the full planning shape a real task has.
 *
 * Every property a task can hold is present, so Obsidian learns them all from
 * a seeded vault and the workbench's filters have something to filter. Values
 * cycle by index rather than repeating, and the epic and milestone are the
 * fixture's own, so every link resolves and a scaled vault stays free of
 * diagnostics.
 */
export function bulkTaskNote(index, seedDate = new Date()) {
  const rank = BULK_RANK_BASE + index * BULK_RANK_GAP;
  const dueOffset = BULK_DUE_OFFSETS[index % BULK_DUE_OFFSETS.length];
  const status = BULK_STATUSES[index % BULK_STATUSES.length];
  return [
    '---',
    'type: task',
    "project: '[[Projects/Game/Project]]'",
    'status: ' + status,
    "epic: '[[Projects/Game/Epics/Travel system]]'",
    "milestone: '[[Projects/Game/Milestones/Alpha]]'",
    'sprint:',
    'owner: ' + BULK_OWNERS[index % BULK_OWNERS.length],
    'category: ' + BULK_CATEGORIES[index % BULK_CATEGORIES.length],
    'priority: ' + BULK_PRIORITIES[index % BULK_PRIORITIES.length],
    'points: ' + String((index % 8) + 1),
    'rank: ' + String(rank),
    dueOffset === null
      ? 'due_date:'
      : 'due_date: ' + localIsoDate(seedDate, dueOffset),
    'origin:',
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
 * A calendar date in the machine's own timezone, offset by whole days.
 *
 * Local rather than UTC on purpose: the due-state filters compare against the
 * local calendar date, so a UTC date would put a seeded "today" a day out for
 * anyone west of Greenwich for part of the day.
 */
export function localIsoDate(from, offsetDays) {
  const date = new Date(
    from.getFullYear(),
    from.getMonth(),
    from.getDate() + offsetDays,
  );
  return (
    String(date.getFullYear()).padStart(4, '0') +
    '-' +
    String(date.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(date.getDate()).padStart(2, '0')
  );
}

/**
 * Adds a `due_date` to a note's frontmatter, at the end of the block.
 *
 * Refuses anything it does not recognize rather than guessing: this rewrites a
 * fixture note, and a silent no-op would leave a check quietly unrunnable.
 */
export function withDueDate(content, isoDate) {
  const match = /^(---\r?\n)([\s\S]*?)(\r?\n---\r?\n)/u.exec(content);
  if (match === null) {
    throw new Error('Cannot add a due date to a note without frontmatter.');
  }
  if (/^due_date:/mu.test(match[2])) {
    throw new Error('The note already declares a due date.');
  }
  const newline = match[3].startsWith('\r\n') ? '\r\n' : '\n';
  return (
    match[1] +
    match[2] +
    newline +
    'due_date: ' +
    isoDate +
    match[3] +
    content.slice(match[0].length)
  );
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
  seedDate = new Date(),
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
  await addDueDates(vaultRoot, seededFiles, seedDate);
  for (let index = 1; index <= scale; index += 1) {
    const relativePath = join(
      'Projects',
      'Game',
      'Tasks',
      'Bulk ' + paddedIndex(index) + '.md',
    );
    await writeVaultFile(
      vaultRoot,
      relativePath,
      bulkTaskNote(index, seedDate),
    );
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

/**
 * Dates the copied fixture tasks relative to the seed run, so the due-state
 * filters have something to filter and **Due today** means today.
 */
async function addDueDates(vaultRoot, seededFiles, seedDate) {
  for (const [relativePath, offsetDays] of Object.entries(SEEDED_DUE_DATES)) {
    if (!seededFiles.includes(relativePath)) {
      throw new Error(
        'The seed source no longer contains ' +
          relativePath +
          ', which the seeded due dates expect.',
      );
    }
    const target = resolveInside(vaultRoot, relativePath);
    const content = await readFile(target, 'utf8');
    await writeFile(
      target,
      withDueDate(content, localIsoDate(seedDate, offsetDays)),
      'utf8',
    );
  }
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
          '. To install builds there instead, run test-vault:update. To ' +
          'repoint at ' +
          result.vaultRoot +
          ', run: npm run test-vault:create -- --point --force',
      );
    }
  }
}
