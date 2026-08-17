import { copyFile, mkdir, readFile, rm, stat } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';

import { PLUGIN_RUNTIME_FILES } from './release-inventory.mjs';

export { PLUGIN_RUNTIME_FILES } from './release-inventory.mjs';

export const RETIRED_PLUGIN_RUNTIME_FILES = ['project-weave-mcp.cjs'];

const DEFAULT_CONFIG_PATH = '.project-weave-test-vault';
const TEST_VAULT_ENVIRONMENT_KEY = 'PROJECT_WEAVE_TEST_VAULT';

export async function installConfiguredTestVault(options) {
  const vaultPath = await resolveConfiguredTestVaultPath(options);
  if (vaultPath === null) {
    if (options.required === true) {
      throw new Error(
        'No test vault configured. Set PROJECT_WEAVE_TEST_VAULT or create .project-weave-test-vault with an absolute vault path.',
      );
    }
    return null;
  }
  return await installPluginInTestVault({
    vaultPath,
    pluginId: options.pluginId,
    sourceDirectory: options.sourceDirectory,
  });
}

export async function resolveConfiguredTestVaultPath({
  environment = process.env,
  configPath = resolve(DEFAULT_CONFIG_PATH),
} = {}) {
  const environmentPath = environment[TEST_VAULT_ENVIRONMENT_KEY]?.trim();
  if (environmentPath !== undefined && environmentPath.length > 0) {
    return resolve(environmentPath);
  }

  let configuredPath;
  try {
    configuredPath = (await readFile(configPath, 'utf8')).trim();
  } catch (error) {
    if (
      error !== null &&
      typeof error === 'object' &&
      error.code === 'ENOENT'
    ) {
      return null;
    }
    throw error;
  }
  return configuredPath.length === 0 ? null : resolve(configuredPath);
}

export async function installPluginInTestVault({
  vaultPath,
  pluginId,
  sourceDirectory,
}) {
  if (typeof pluginId !== 'string' || !/^[a-z0-9-]+$/u.test(pluginId)) {
    throw new Error('Refusing to install an unsafe plugin id.');
  }

  const vaultRoot = resolve(vaultPath);
  const obsidianDirectory = resolve(vaultRoot, '.obsidian');
  const obsidianStats = await stat(obsidianDirectory).catch(() => null);
  if (obsidianStats?.isDirectory() !== true) {
    throw new Error(
      'Configured test vault has no .obsidian directory: ' + vaultRoot,
    );
  }

  const pluginsDirectory = resolve(obsidianDirectory, 'plugins');
  const pluginDirectory = resolve(pluginsDirectory, pluginId);
  if (!pluginDirectory.startsWith(pluginsDirectory + sep)) {
    throw new Error(
      'Refusing to install outside the test vault plugin folder.',
    );
  }

  await mkdir(pluginDirectory, { recursive: true });
  await Promise.all(
    RETIRED_PLUGIN_RUNTIME_FILES.map((file) =>
      rm(join(pluginDirectory, file), { force: true }),
    ),
  );
  await Promise.all(
    PLUGIN_RUNTIME_FILES.map((file) =>
      copyFile(join(sourceDirectory, file), join(pluginDirectory, file)),
    ),
  );
  return pluginDirectory;
}
