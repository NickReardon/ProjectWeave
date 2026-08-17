import { builtinModules } from 'node:module';
import { cp, mkdir, readFile, rm } from 'node:fs/promises';
import process from 'node:process';
import esbuild from 'esbuild';

const production = process.argv[2] === 'production';
const outputDirectory = 'dist';
const pluginOutputDirectory = `${outputDirectory}/plugin`;
const companionOutputDirectory = `${outputDirectory}/companion`;
const project = JSON.parse(await readFile('package.json', 'utf8'));
const buildVersion =
  process.env.PROJECT_WEAVE_BUILD_VERSION?.trim() || project.version;
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(buildVersion)) {
  throw new Error('PROJECT_WEAVE_BUILD_VERSION is not a semantic version.');
}
const version = JSON.stringify(buildVersion);

await rm(outputDirectory, { recursive: true, force: true });
await Promise.all([
  mkdir(pluginOutputDirectory, { recursive: true }),
  mkdir(companionOutputDirectory, { recursive: true }),
]);
await Promise.all([
  cp('manifest.json', `${pluginOutputDirectory}/manifest.json`),
  cp('styles.css', `${pluginOutputDirectory}/styles.css`),
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
  outfile: `${pluginOutputDirectory}/main.js`,
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
  outfile: `${companionOutputDirectory}/project-weave-mcp.cjs`,
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
