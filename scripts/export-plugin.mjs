import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';

import { assertProjectVersion, readProjectState } from './project-version.mjs';
import {
  installConfiguredTestVault,
  PLUGIN_RUNTIME_FILES,
} from './test-vault-installer.mjs';
import { createZip } from './zip.mjs';

const RELEASE_FILES = PLUGIN_RUNTIME_FILES;
const EXPORT_ROOT = resolve('export');
const supportedArguments = new Set(['--require-test-vault']);
const argumentsProvided = process.argv.slice(2);
const unsupportedArguments = argumentsProvided.filter(
  (argument) => !supportedArguments.has(argument),
);
if (unsupportedArguments.length > 0) {
  throw new Error(
    'Unsupported export arguments: ' + unsupportedArguments.join(', ') + '.',
  );
}
const requireTestVault = argumentsProvided.includes('--require-test-vault');
const state = await readProjectState();
const version = assertProjectVersion(state);
const pluginId = state.manifest.id;

if (typeof pluginId !== 'string' || !/^[a-z0-9-]+$/u.test(pluginId)) {
  throw new Error('manifest.json contains an unsafe plugin id.');
}

const pluginDirectory = resolve(EXPORT_ROOT, pluginId);
const zipPath = resolve(EXPORT_ROOT, pluginId + '-' + version + '.zip');
assertWithinExport(pluginDirectory);
assertWithinExport(zipPath);

await mkdir(EXPORT_ROOT, { recursive: true });
await rm(pluginDirectory, { recursive: true, force: true });
await rm(zipPath, { force: true });
await mkdir(pluginDirectory, { recursive: true });
await Promise.all(
  RELEASE_FILES.map((file) =>
    copyFile(join('dist', file), join(pluginDirectory, file)),
  ),
);

const inventory = (await readdir(pluginDirectory)).sort();
if (JSON.stringify(inventory) !== JSON.stringify(RELEASE_FILES)) {
  throw new Error(
    'Exported plugin inventory mismatch: ' + inventory.join(', ') + '.',
  );
}

const entries = await Promise.all(
  RELEASE_FILES.map(async (file) => ({
    name: pluginId + '/' + file,
    data: await readFile(join(pluginDirectory, file)),
  })),
);
await writeFile(zipPath, createZip(entries));
const zipSize = (await stat(zipPath)).size;

console.log(
  'Plugin folder exported: ' + join('export', pluginId) + ' (' + version + ')',
);
console.log(
  'Plugin ZIP exported: ' +
    join('export', pluginId + '-' + version + '.zip') +
    ' (' +
    String(zipSize) +
    ' bytes)',
);

const testVaultPluginDirectory = await installConfiguredTestVault({
  pluginId,
  required: requireTestVault,
  sourceDirectory: pluginDirectory,
});
if (testVaultPluginDirectory !== null) {
  console.log('Test vault updated: ' + testVaultPluginDirectory);
}

function assertWithinExport(path) {
  if (!path.startsWith(EXPORT_ROOT + sep)) {
    throw new Error('Refusing to export outside ' + EXPORT_ROOT + '.');
  }
}
