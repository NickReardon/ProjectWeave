import { builtinModules } from 'node:module';
import { cp, mkdir, readFile, rm } from 'node:fs/promises';
import process from 'node:process';
import esbuild from 'esbuild';

const production = process.argv[2] === 'production';
const outputDirectory = 'dist';
const project = JSON.parse(await readFile('package.json', 'utf8'));
const version = JSON.stringify(project.version);

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  cp('manifest.json', `${outputDirectory}/manifest.json`),
  cp('styles.css', `${outputDirectory}/styles.css`),
]);

const plugin = await esbuild.context({
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
    ...builtinModules.map((moduleName) => `node:${moduleName}`),
  ],
  format: 'cjs',
  logLevel: 'info',
  minify: production,
  outfile: `${outputDirectory}/main.js`,
  sourcemap: production ? false : 'inline',
  target: 'es2022',
  treeShaking: true,
});

const companion = await esbuild.context({
  bundle: true,
  define: { PROJECT_WEAVE_VERSION: version },
  entryPoints: ['src/agent/mcp-companion.ts'],
  format: 'cjs',
  logLevel: 'info',
  minify: production,
  outfile: `${outputDirectory}/project-weave-mcp.cjs`,
  platform: 'node',
  sourcemap: production ? false : 'inline',
  target: 'node22',
  treeShaking: true,
});

if (production) {
  await Promise.all([plugin.rebuild(), companion.rebuild()]);
  await Promise.all([plugin.dispose(), companion.dispose()]);
} else {
  await Promise.all([plugin.watch(), companion.watch()]);
}
