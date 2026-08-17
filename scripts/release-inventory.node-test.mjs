import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  assertExactInventory,
  COMPANION_RUNTIME_FILES,
  PLUGIN_RUNTIME_FILES,
  verifyDirectoryInventory,
  verifyPluginRuntimeImports,
} from './release-inventory.mjs';

test('keeps the Obsidian plugin and optional companion inventories separate', () => {
  assert.deepEqual(PLUGIN_RUNTIME_FILES, [
    'main.js',
    'manifest.json',
    'styles.css',
  ]);
  assert.deepEqual(COMPANION_RUNTIME_FILES, ['project-weave-mcp.cjs']);
  assert.equal(
    PLUGIN_RUNTIME_FILES.includes(COMPANION_RUNTIME_FILES[0]),
    false,
  );
});

test('reports missing and unexpected artifacts by inventory', () => {
  assert.throws(
    () =>
      assertExactInventory({
        actual: ['main.js', 'project-weave-mcp.cjs'],
        expected: PLUGIN_RUNTIME_FILES,
        label: 'Plugin',
      }),
    /Plugin inventory mismatch: missing manifest\.json, styles\.css; unexpected project-weave-mcp\.cjs\./u,
  );
});

test('verifies an exact directory inventory', async () => {
  const root = await mkdtemp(join(tmpdir(), 'project-weave-inventory-'));
  try {
    const pluginDirectory = join(root, 'plugin');
    await mkdir(pluginDirectory);
    await Promise.all(
      PLUGIN_RUNTIME_FILES.map((file) =>
        writeFile(join(pluginDirectory, file), file),
      ),
    );

    assert.deepEqual(
      await verifyDirectoryInventory({
        directory: pluginDirectory,
        expected: PLUGIN_RUNTIME_FILES,
        label: 'Plugin',
      }),
      [...PLUGIN_RUNTIME_FILES].sort(),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('allows lazy desktop Node requires but rejects dynamic Node imports', () => {
  assert.deepEqual(
    verifyPluginRuntimeImports(
      'require("obsidian"); require("node:net"); require("node:fs/promises");',
    ),
    ['node:fs/promises', 'node:net', 'obsidian'],
  );
  assert.throws(
    () => verifyPluginRuntimeImports('import("node:net")'),
    /unsupported dynamic Node imports: node:net/u,
  );
  assert.throws(
    () => verifyPluginRuntimeImports('require("node:child_process")'),
    /unsupported runtime imports: node:child_process/u,
  );
});
