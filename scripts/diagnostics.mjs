import { build } from 'esbuild';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const result = await build({
  absWorkingDir: resolve('.'),
  bundle: true,
  entryPoints: ['scripts/diagnostics-cli.ts'],
  format: 'esm',
  logLevel: 'silent',
  packages: 'external',
  platform: 'node',
  write: false,
});

const output = result.outputFiles[0];
if (output === undefined) {
  throw new Error('Could not build the diagnostics CLI.');
}

const temporaryDirectory = await mkdtemp(
  join(resolve('.'), '.project-weave-diagnostics-'),
);
const temporaryModule = join(temporaryDirectory, 'diagnostics.mjs');
await writeFile(temporaryModule, output.contents);
try {
  await import(pathToFileURL(temporaryModule).href);
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
