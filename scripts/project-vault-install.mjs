import { resolve } from 'node:path';

import { readProjectState } from './project-version.mjs';
import { installPluginInTestVault } from './test-vault-installer.mjs';

const PROJECT_VAULT_PATH = resolve('docs/project-vault');
const DIST_DIRECTORY = resolve('dist');

const state = await readProjectState();
const pluginId = state.manifest.id;

if (typeof pluginId !== 'string' || !/^[a-z0-9-]+$/u.test(pluginId)) {
  throw new Error('manifest.json contains an unsafe plugin id.');
}

try {
  const pluginDirectory = await installPluginInTestVault({
    vaultPath: PROJECT_VAULT_PATH,
    pluginId,
    sourceDirectory: DIST_DIRECTORY,
  });
  console.log('Dogfood vault updated: ' + pluginDirectory);
} catch (error) {
  if (
    error instanceof Error &&
    error.message.includes('no .obsidian directory')
  ) {
    throw new Error(
      'docs/project-vault has no .obsidian directory yet. Open it once as a ' +
        'vault in Obsidian (Settings → Community plugins → enable community ' +
        'plugins) before running this script.',
      { cause: error },
    );
  }
  throw error;
}
