import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  assertPluginDirectory,
  installGitHubRelease,
  loadGitHubUpdateEnvironment,
  parseGitHubUpdateOptions,
  releaseAssetUrl,
} from './install-github-release.mjs';

const VERSION = '0.7.0-beta.42';

function pluginPath(root) {
  return join(root, 'Vault', '.obsidian', 'plugins', 'project-weave');
}

function releaseFetch(overrides = {}) {
  const assets = {
    'main.js': '/* bundled plugin */',
    'manifest.json': JSON.stringify({
      id: 'project-weave',
      version: VERSION,
      minAppVersion: '1.8.0',
    }),
    'styles.css': '.project-weave { display: block; }',
    ...overrides,
  };
  return async (url) => {
    const file = new URL(url).pathname.split('/').at(-1);
    const body = assets[file];
    return body === undefined
      ? new Response('missing', { status: 404 })
      : new Response(body, { status: 200 });
  };
}

test('reads the exact plugin path and pinned version from environment', () => {
  const configuredPath = pluginPath(tmpdir());
  const options = parseGitHubUpdateOptions([], {
    PROJECT_WEAVE_PLUGIN_PATH: configuredPath,
    PROJECT_WEAVE_RELEASE_VERSION: VERSION,
  });
  assert.equal(options.version, VERSION);
  assert.equal(options.repository, 'NickReardon/ProjectWeave');
  assert.match(options.pluginPath, /project-weave$/u);
});

test('loads ignored local configuration while preserving environment precedence', async () => {
  const root = await mkdtemp(join(tmpdir(), 'project-weave-github-env-'));
  const configPath = join(root, '.env');
  try {
    await writeFile(
      configPath,
      [
        `PROJECT_WEAVE_PLUGIN_PATH=${pluginPath(root)}`,
        'PROJECT_WEAVE_RELEASE_VERSION=0.7.0-beta.1',
        'PROJECT_WEAVE_GITHUB_REPOSITORY=example/project-weave',
      ].join('\n'),
    );
    const environment = await loadGitHubUpdateEnvironment({
      environment: { PROJECT_WEAVE_RELEASE_VERSION: VERSION },
      configPath,
    });
    const options = parseGitHubUpdateOptions([], environment);

    assert.equal(options.pluginPath, pluginPath(root));
    assert.equal(options.version, VERSION);
    assert.equal(options.repository, 'example/project-weave');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects a broad vault or plugins directory', () => {
  assert.throws(
    () =>
      assertPluginDirectory(join(tmpdir(), 'Vault', '.obsidian', 'plugins')),
    /must end with/u,
  );
});

test('builds only managed release asset URLs', () => {
  assert.equal(
    releaseAssetUrl('NickReardon/ProjectWeave', VERSION, 'main.js'),
    `https://github.com/NickReardon/ProjectWeave/releases/download/${VERSION}/main.js`,
  );
  assert.throws(
    () =>
      releaseAssetUrl(
        'NickReardon/ProjectWeave',
        VERSION,
        'project-weave-mcp.cjs',
      ),
    /unmanaged/u,
  );
});

test('downloads and validates everything before changing the plugin folder', async () => {
  const root = await mkdtemp(join(tmpdir(), 'project-weave-github-fail-'));
  const target = pluginPath(root);
  try {
    await mkdir(target, { recursive: true });
    await writeFile(join(target, 'main.js'), 'old main');
    await writeFile(join(target, 'data.json'), '{"preserve":true}');

    await assert.rejects(
      installGitHubRelease({
        pluginPath: target,
        version: VERSION,
        fetchImpl: releaseFetch({ 'styles.css': undefined }),
      }),
      /did not provide styles\.css/u,
    );
    assert.equal(await readFile(join(target, 'main.js'), 'utf8'), 'old main');
    assert.equal(
      await readFile(join(target, 'data.json'), 'utf8'),
      '{"preserve":true}',
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('installs a pinned release, preserves settings, and removes the old companion', async () => {
  const root = await mkdtemp(join(tmpdir(), 'project-weave-github-ok-'));
  const target = pluginPath(root);
  try {
    await mkdir(target, { recursive: true });
    await writeFile(join(target, 'data.json'), '{"preserve":true}');
    await writeFile(join(target, 'project-weave-mcp.cjs'), 'old companion');

    const result = await installGitHubRelease({
      pluginPath: target,
      version: VERSION,
      fetchImpl: releaseFetch(),
    });

    assert.equal(result.version, VERSION);
    assert.equal(
      JSON.parse(await readFile(join(target, 'manifest.json'), 'utf8')).version,
      VERSION,
    );
    assert.equal(
      await readFile(join(target, 'data.json'), 'utf8'),
      '{"preserve":true}',
    );
    await assert.rejects(readFile(join(target, 'project-weave-mcp.cjs')), {
      code: 'ENOENT',
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
