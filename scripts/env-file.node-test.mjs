import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { loadEnvFile } from './env-file.mjs';

async function workspace() {
  const root = await mkdtemp(join(tmpdir(), 'project-weave-env-'));
  return {
    root,
    path: join(root, '.env'),
    async write(contents) {
      await writeFile(join(root, '.env'), contents, 'utf8');
    },
    async cleanup() {
      await rm(root, { recursive: true, force: true });
    },
  };
}

test('reads a value from the env file', async () => {
  const space = await workspace();
  const previous = process.env.PROJECT_WEAVE_ENV_TEST;
  try {
    delete process.env.PROJECT_WEAVE_ENV_TEST;
    await space.write('PROJECT_WEAVE_ENV_TEST=from_file\n');

    const result = loadEnvFile(space.path);

    assert.equal(result.loaded, true);
    assert.equal(process.env.PROJECT_WEAVE_ENV_TEST, 'from_file');
  } finally {
    if (previous === undefined) {
      delete process.env.PROJECT_WEAVE_ENV_TEST;
    } else {
      process.env.PROJECT_WEAVE_ENV_TEST = previous;
    }
    await space.cleanup();
  }
});

test('leaves a variable the environment already carries alone', async () => {
  const space = await workspace();
  const previous = process.env.PROJECT_WEAVE_ENV_TEST;
  try {
    // The precedence the docs promise: one-off command beats the file.
    process.env.PROJECT_WEAVE_ENV_TEST = 'from_shell';
    await space.write('PROJECT_WEAVE_ENV_TEST=from_file\n');

    loadEnvFile(space.path);

    assert.equal(process.env.PROJECT_WEAVE_ENV_TEST, 'from_shell');
  } finally {
    if (previous === undefined) {
      delete process.env.PROJECT_WEAVE_ENV_TEST;
    } else {
      process.env.PROJECT_WEAVE_ENV_TEST = previous;
    }
    await space.cleanup();
  }
});

test('treats a missing file as the ordinary case', async () => {
  const space = await workspace();
  try {
    const result = loadEnvFile(join(space.root, 'nothing-here.env'));

    assert.equal(result.loaded, false);
  } finally {
    await space.cleanup();
  }
});
