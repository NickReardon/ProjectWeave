import { builtinModules } from 'node:module';
import { cp, mkdir, rm } from 'node:fs/promises';
import process from 'node:process';
import esbuild from 'esbuild';

const production = process.argv[2] === 'production';
const outputDirectory = 'dist';

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  cp('manifest.json', `${outputDirectory}/manifest.json`),
  cp('styles.css', `${outputDirectory}/styles.css`),
]);

const context = await esbuild.context({
  banner: {
    js: `/* Project Weave: generated bundle. Source lives in the project repository. */`,
  },
  entryPoints: ['src/main.ts'],
  bundle: true,
  external: [
    'obsidian',
    'electron',
    '@codemirror/autocomplete',
    '@codemirror/collab',
    '@codemirror/commands',
    '@codemirror/language',
    '@codemirror/lint',
    '@codemirror/search',
    '@codemirror/state',
    '@codemirror/view',
    '@lezer/common',
    '@lezer/highlight',
    '@lezer/lr',
    ...builtinModules,
  ],
  format: 'cjs',
  logLevel: 'info',
  minify: production,
  outfile: `${outputDirectory}/main.js`,
  sourcemap: production ? false : 'inline',
  target: 'es2022',
  treeShaking: true,
});

if (production) {
  await context.rebuild();
  await context.dispose();
} else {
  await context.watch();
}
