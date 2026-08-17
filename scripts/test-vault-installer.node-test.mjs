import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  installConfiguredTestVault,
  installPluginInTestVault,
  PLUGIN_RUNTIME_FILES,
  RETIRED_PLUGIN_RUNTIME_FILES,
  resolveConfiguredTestVaultPath,
} from './test-vault-installer.mjs';

test('resolves an environment override before a local config file', async () => {
  const configured = await resolveConfiguredTestVaultPath({
    environment: { PROJECT_WEAVE_TEST_VAULT: 'Environment Vault' },
    configPath: join('missing', 'config'),
  });

  assert.ok(configured?.endsWith(join('Environment Vault')));
});

test('returns null when no test vault is configured', async () => {
  const configured = await resolveConfiguredTestVaultPath({
    environment: {},
    configPath: join('missing', 'config'),
  });

  assert.equal(configured, null);
});

test('fails when an explicitly required test vault is not configured', async () => {
  await assert.rejects(
    installConfiguredTestVault({
      environment: {},
      configPath: join('missing', 'config'),
      pluginId: 'project-weave',
      required: true,
      sourceDirectory: join('missing', 'export'),
    }),
    /No test vault configured/u,
  );
});

test('updates only runtime plugin files and preserves local settings', async () => {
  const root = await mkdtemp(join(tmpdir(), 'project-weave-test-vault-'));
  try {
    const vaultPath = join(root, 'Vault');
    const sourceDirectory = join(root, 'export', 'project-weave');
    const pluginDirectory = join(
      vaultPath,
      '.obsidian',
      'plugins',
      'project-weave',
    );
    await mkdir(join(vaultPath, '.obsidian'), { recursive: true });
    await mkdir(sourceDirectory, { recursive: true });
    await mkdir(pluginDirectory, { recursive: true });
    await writeFile(join(pluginDirectory, 'data.json'), '{"keep":true}');
    await writeFile(
      join(pluginDirectory, RETIRED_PLUGIN_RUNTIME_FILES[0]),
      'old companion',
    );

    for (const file of PLUGIN_RUNTIME_FILES) {
      await writeFile(join(sourceDirectory, file), 'new ' + file);
      await writeFile(join(pluginDirectory, file), 'old ' + file);
    }

    const installed = await installPluginInTestVault({
      vaultPath,
      pluginId: 'project-weave',
      sourceDirectory,
    });

    assert.equal(installed, pluginDirectory);
    assert.equal(
      await readFile(join(pluginDirectory, 'data.json'), 'utf8'),
      '{"keep":true}',
    );
    for (const file of PLUGIN_RUNTIME_FILES) {
      assert.equal(
        await readFile(join(pluginDirectory, file), 'utf8'),
        'new ' + file,
      );
    }
    await assert.rejects(
      readFile(join(pluginDirectory, RETIRED_PLUGIN_RUNTIME_FILES[0])),
      { code: 'ENOENT' },
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects a configured folder that is not an Obsidian vault', async () => {
  const root = await mkdtemp(join(tmpdir(), 'project-weave-not-vault-'));
  try {
    await assert.rejects(
      installPluginInTestVault({
        vaultPath: root,
        pluginId: 'project-weave',
        sourceDirectory: root,
      }),
      /no \.obsidian directory/u,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
