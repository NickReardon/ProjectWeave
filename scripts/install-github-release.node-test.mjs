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
  releaseAssetApiUrl,
  releaseByTagUrl,
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
  const entries = Object.entries(assets)
    .filter(([, body]) => body !== undefined)
    .map(([name, body], index) => ({ id: index + 1, name, body }));
  return async (url) => {
    const pathname = new URL(url).pathname;
    if (pathname.includes('/releases/tags/')) {
      return Response.json({
        tag_name: VERSION,
        assets: entries.map(({ id, name }) => ({ id, name })),
      });
    }
    const id = Number(pathname.split('/').at(-1));
    const body = entries.find((entry) => entry.id === id)?.body;
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

test('builds only safe GitHub release API URLs', () => {
  assert.equal(
    releaseByTagUrl('NickReardon/ProjectWeave', VERSION),
    `https://api.github.com/repos/NickReardon/ProjectWeave/releases/tags/${VERSION}`,
  );
  assert.equal(
    releaseAssetApiUrl('NickReardon/ProjectWeave', 42, 'main.js'),
    'https://api.github.com/repos/NickReardon/ProjectWeave/releases/assets/42',
  );
  assert.throws(
    () =>
      releaseAssetApiUrl(
        'NickReardon/ProjectWeave',
        42,
        'project-weave-mcp.cjs',
      ),
    /unmanaged/u,
  );
});

test('authenticates release metadata and asset API requests', async () => {
  const root = await mkdtemp(join(tmpdir(), 'project-weave-github-auth-'));
  const requests = [];
  const fetchImpl = releaseFetch();
  try {
    await installGitHubRelease({
      pluginPath: pluginPath(root),
      version: VERSION,
      token: 'test-token',
      fetchImpl: async (url, options) => {
        requests.push({ url, options });
        return fetchImpl(url, options);
      },
    });

    assert.equal(requests.length, 4);
    assert.ok(
      requests.every(
        ({ options }) => options.headers.Authorization === 'Bearer test-token',
      ),
    );
    assert.equal(
      requests[0].options.headers.Accept,
      'application/vnd.github+json',
    );
    assert.ok(
      requests
        .slice(1)
        .every(
          ({ options }) =>
            options.headers.Accept === 'application/octet-stream',
        ),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
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
