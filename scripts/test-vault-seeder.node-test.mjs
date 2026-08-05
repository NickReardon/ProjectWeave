import assert from 'node:assert/strict';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

import {
  MANIFEST_NAME,
  localIsoDate,
  parseSeedArguments,
  seedTestVault,
  withDueDate,
  writeTestVaultPointer,
} from './test-vault-seeder.mjs';

const SEED_SOURCE = resolve('tests/fixtures/vault');

async function workspace() {
  const root = await mkdtemp(join(tmpdir(), 'project-weave-seed-'));
  return {
    root,
    vaultPath: join(root, 'test-vault'),
    async seed(options = {}) {
      return await seedTestVault({
        vaultPath: join(root, 'test-vault'),
        repositoryRoot: root,
        seedSource: SEED_SOURCE,
        // Fixed, so a seed and a later reset agree even across midnight.
        seedDate: new Date(2026, 7, 5),
        ...options,
      });
    },
    async cleanup() {
      await rm(root, { recursive: true, force: true });
    },
  };
}

test('seeds the fixture vault with an .obsidian directory and a manifest', async () => {
  const space = await workspace();
  try {
    const result = await space.seed();

    const project = await readFile(
      join(space.vaultPath, 'Projects', 'Game', 'Project.md'),
      'utf8',
    );
    assert.match(project, /type: project/u);
    assert.ok(result.files.includes('Projects/Game/Project.md'));

    // The installer refuses a folder without .obsidian, so seeding must create it.
    const obsidian = await readdir(join(space.vaultPath, '.obsidian'));
    assert.deepEqual(obsidian.sort(), ['app.json', 'community-plugins.json']);

    const manifest = JSON.parse(
      await readFile(join(space.vaultPath, MANIFEST_NAME), 'utf8'),
    );
    assert.equal(manifest.seedVersion, 1);
  } finally {
    await space.cleanup();
  }
});

test('refuses a directory it did not seed', async () => {
  const space = await workspace();
  try {
    await mkdir(space.vaultPath, { recursive: true });
    await writeFile(join(space.vaultPath, 'Important.md'), 'real work');

    await assert.rejects(space.seed(), /did not seed/u);

    const survived = await readFile(
      join(space.vaultPath, 'Important.md'),
      'utf8',
    );
    assert.equal(survived, 'real work');
  } finally {
    await space.cleanup();
  }
});

test('refuses a target outside the repository unless asked explicitly', async () => {
  const space = await workspace();
  try {
    await assert.rejects(
      seedTestVault({
        vaultPath: join(space.root, 'elsewhere'),
        repositoryRoot: join(space.root, 'repository'),
        seedSource: SEED_SOURCE,
      }),
      /--allow-outside/u,
    );
  } finally {
    await space.cleanup();
  }
});

test('refuses the repository root itself', async () => {
  const space = await workspace();
  try {
    await assert.rejects(
      seedTestVault({
        vaultPath: space.root,
        repositoryRoot: space.root,
        seedSource: SEED_SOURCE,
      }),
      /repository root/u,
    );
  } finally {
    await space.cleanup();
  }
});

test('reset restores deleted and corrupted notes', async () => {
  const space = await workspace();
  try {
    await space.seed();
    const taskPath = join(
      space.vaultPath,
      'Projects',
      'Game',
      'Tasks',
      'Implement request.md',
    );
    const original = await readFile(taskPath, 'utf8');

    await writeFile(taskPath, '---\nstatus: complete\n---\n');
    await rm(join(space.vaultPath, 'Projects', 'Game', 'Project.md'));

    await space.seed({ reset: true });

    assert.equal(await readFile(taskPath, 'utf8'), original);
    assert.match(
      await readFile(
        join(space.vaultPath, 'Projects', 'Game', 'Project.md'),
        'utf8',
      ),
      /type: project/u,
    );
  } finally {
    await space.cleanup();
  }
});

test('reset preserves the installed plugin and its local settings', async () => {
  const space = await workspace();
  try {
    await space.seed();
    const pluginDirectory = join(
      space.vaultPath,
      '.obsidian',
      'plugins',
      'project-weave',
    );
    await mkdir(pluginDirectory, { recursive: true });
    await writeFile(join(pluginDirectory, 'data.json'), '{"keep":true}');

    await space.seed({ reset: true });

    assert.equal(
      await readFile(join(pluginDirectory, 'data.json'), 'utf8'),
      '{"keep":true}',
    );
  } finally {
    await space.cleanup();
  }
});

test('reset reports notes it did not seed instead of deleting them', async () => {
  const space = await workspace();
  try {
    await space.seed();
    const mine = join(space.vaultPath, 'Projects', 'Game', 'Scratch.md');
    await writeFile(mine, 'my own note');

    const result = await space.seed({ reset: true });

    assert.deepEqual(result.unknown, ['Projects/Game/Scratch.md']);
    assert.equal(await readFile(mine, 'utf8'), 'my own note');
  } finally {
    await space.cleanup();
  }
});

test('scale generates ranked bulk tasks and drops them on the next reset', async () => {
  const space = await workspace();
  try {
    const result = await space.seed({ scale: 3 });
    const tasks = join(space.vaultPath, 'Projects', 'Game', 'Tasks');

    assert.ok(result.files.includes('Projects/Game/Tasks/Bulk 003.md'));
    assert.match(
      await readFile(join(tasks, 'Bulk 001.md'), 'utf8'),
      /rank: 101000/u,
    );
    assert.match(
      await readFile(join(tasks, 'Bulk 003.md'), 'utf8'),
      /rank: 103000/u,
    );

    const afterReset = await space.seed({ reset: true });
    assert.equal(
      afterReset.files.some((file) => file.includes('Bulk ')),
      false,
    );
    assert.deepEqual(afterReset.unknown, []);
    assert.equal(
      (await readdir(tasks)).some((name) => name.startsWith('Bulk ')),
      false,
    );
  } finally {
    await space.cleanup();
  }
});

test('reset accepts a scale so a truncation check needs one command', async () => {
  const space = await workspace();
  try {
    await space.seed();
    const result = await space.seed({ reset: true, scale: 250 });

    assert.equal(
      result.files.filter((file) => file.includes('Bulk ')).length,
      250,
    );
  } finally {
    await space.cleanup();
  }
});

test('writes the pointer when there is none', async () => {
  const space = await workspace();
  try {
    const pointerPath = join(space.root, 'pointer');
    const result = await writeTestVaultPointer({
      vaultRoot: space.vaultPath,
      pointerPath,
    });

    assert.equal(result.written, true);
    assert.equal((await readFile(pointerPath, 'utf8')).trim(), space.vaultPath);
  } finally {
    await space.cleanup();
  }
});

test('refuses to repoint an existing pointer without --force', async () => {
  const space = await workspace();
  try {
    const pointerPath = join(space.root, 'pointer');
    const theirs = join(space.root, 'Real Vault');
    await writeFile(pointerPath, theirs + '\n');

    const refused = await writeTestVaultPointer({
      vaultRoot: space.vaultPath,
      pointerPath,
    });

    assert.equal(refused.written, false);
    assert.equal(refused.reason, 'conflict');
    // The user's own vault must still be the install target.
    assert.equal((await readFile(pointerPath, 'utf8')).trim(), theirs);

    const forced = await writeTestVaultPointer({
      vaultRoot: space.vaultPath,
      pointerPath,
      force: true,
    });
    assert.equal(forced.written, true);
    assert.equal((await readFile(pointerPath, 'utf8')).trim(), space.vaultPath);
  } finally {
    await space.cleanup();
  }
});

test('treats an identical pointer as nothing to do', async () => {
  const space = await workspace();
  try {
    const pointerPath = join(space.root, 'pointer');
    await writeFile(pointerPath, space.vaultPath + '\n');

    const result = await writeTestVaultPointer({
      vaultRoot: space.vaultPath,
      pointerPath,
    });

    assert.deepEqual(
      { written: result.written, reason: result.reason },
      { written: false, reason: 'already' },
    );
  } finally {
    await space.cleanup();
  }
});

test('parses arguments and rejects unsupported ones', () => {
  assert.deepEqual(parseSeedArguments(['--reset', '--scale', '250']), {
    reset: true,
    scale: 250,
    allowOutsideRepository: false,
    point: false,
    force: false,
  });
  assert.deepEqual(parseSeedArguments(['--point', '--force']), {
    reset: false,
    scale: 0,
    allowOutsideRepository: false,
    point: true,
    force: true,
  });
  assert.throws(() => parseSeedArguments(['--wipe']), /Unsupported/u);
  assert.throws(() => parseSeedArguments(['--scale', 'lots']), /whole number/u);
  assert.throws(() => parseSeedArguments(['--path']), /expects a directory/u);
});

test('dates the fixture tasks relative to the day it seeds', async () => {
  const space = await workspace();
  try {
    // A fixed seed date, so the assertion is about the offsets rather than
    // about whatever day the suite happens to run.
    await space.seed({ seedDate: new Date(2026, 7, 5) });

    const read = async (name) =>
      await readFile(
        join(space.vaultPath, 'Projects', 'Game', 'Tasks', name),
        'utf8',
      );

    assert.match(await read('Implement request.md'), /due_date: 2026-08-05\n/u);
    assert.match(
      await read('External prerequisite.md'),
      /due_date: 2026-08-02\n/u,
    );
    assert.match(await read('Blocked request.md'), /due_date: 2026-08-12\n/u);
    // The fourth state is a task with no due date at all.
    assert.doesNotMatch(await read('Define request.md'), /due_date/u);

    // The committed fixture is untouched; only the seeded copy is dated.
    const fixture = await readFile(
      join(SEED_SOURCE, 'Projects', 'Game', 'Tasks', 'Implement request.md'),
      'utf8',
    );
    assert.doesNotMatch(fixture, /due_date/u);
  } finally {
    await space.cleanup();
  }
});

test('offsets calendar days locally and refuses notes it cannot date', () => {
  // Crossing a month boundary, and a UTC-sensitive hour: the due-state filters
  // compare local calendar dates, so this must not slip a day.
  assert.equal(localIsoDate(new Date(2026, 7, 5, 23, 30), -6), '2026-07-30');
  assert.equal(localIsoDate(new Date(2026, 11, 31, 0, 30), 1), '2027-01-01');

  assert.equal(
    withDueDate('---\ntype: task\n---\n\n# One\n', '2026-08-05'),
    '---\ntype: task\ndue_date: 2026-08-05\n---\n\n# One\n',
  );
  assert.throws(
    () => withDueDate('# No frontmatter\n', '2026-08-05'),
    /without frontmatter/u,
  );
  assert.throws(
    () => withDueDate('---\ndue_date: 2026-01-01\n---\n', '2026-08-05'),
    /already declares/u,
  );
});
