import {
  copyFile,
  mkdir,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve, sep } from 'node:path';

import { assertProjectVersion, readProjectState } from './project-version.mjs';
import { installConfiguredTestVault } from './test-vault-installer.mjs';
import {
  COMPANION_RUNTIME_FILES,
  PLUGIN_RUNTIME_FILES,
  verifyDirectoryInventory,
} from './release-inventory.mjs';
import { createZip } from './zip.mjs';

const RELEASE_FILES = PLUGIN_RUNTIME_FILES;
const EXPORT_ROOT = resolve('export');
const COMPANION_EXPORT_ROOT = resolve(EXPORT_ROOT, 'companion');
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
const companionPath = resolve(
  COMPANION_EXPORT_ROOT,
  COMPANION_RUNTIME_FILES[0],
);
const companionChecksumPath = companionPath + '.sha256';
assertWithinExport(pluginDirectory);
assertWithinExport(zipPath);
assertWithinExport(companionPath);
assertWithinExport(companionChecksumPath);

await mkdir(EXPORT_ROOT, { recursive: true });
await rm(pluginDirectory, { recursive: true, force: true });
await rm(zipPath, { force: true });
await rm(COMPANION_EXPORT_ROOT, { recursive: true, force: true });
await mkdir(pluginDirectory, { recursive: true });
await mkdir(COMPANION_EXPORT_ROOT, { recursive: true });
await Promise.all(
  RELEASE_FILES.map((file) =>
    copyFile(join('dist', 'plugin', file), join(pluginDirectory, file)),
  ),
);
await copyFile(
  join('dist', 'companion', COMPANION_RUNTIME_FILES[0]),
  companionPath,
);
const companionBytes = await readFile(companionPath);
const companionChecksum = createHash('sha256')
  .update(companionBytes)
  .digest('hex');
await writeFile(
  companionChecksumPath,
  `${companionChecksum}  ${COMPANION_RUNTIME_FILES[0]}\n`,
);

await verifyDirectoryInventory({
  directory: pluginDirectory,
  expected: RELEASE_FILES,
  label: 'Exported plugin',
});
await verifyDirectoryInventory({
  directory: COMPANION_EXPORT_ROOT,
  expected: [
    COMPANION_RUNTIME_FILES[0],
    COMPANION_RUNTIME_FILES[0] + '.sha256',
  ],
  label: 'Exported companion',
});

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
console.log(
  'Companion exported: ' +
    join('export', 'companion', COMPANION_RUNTIME_FILES[0]),
);
console.log(
  'Companion checksum exported: ' +
    join('export', 'companion', COMPANION_RUNTIME_FILES[0] + '.sha256'),
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
