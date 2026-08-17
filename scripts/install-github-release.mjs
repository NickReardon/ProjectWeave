import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseEnv } from 'node:util';

import { PLUGIN_RUNTIME_FILES } from './release-inventory.mjs';
import { RETIRED_PLUGIN_RUNTIME_FILES } from './test-vault-installer.mjs';

const DEFAULT_REPOSITORY = 'NickReardon/ProjectWeave';
const SEMANTIC_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u;

export async function loadGitHubUpdateEnvironment({
  environment = process.env,
  configPath = resolve('.env'),
} = {}) {
  const contents = await readFile(configPath, 'utf8').catch((error) => {
    if (error?.code === 'ENOENT') {
      return null;
    }
    throw error;
  });
  return contents === null
    ? environment
    : { ...parseEnv(contents), ...environment };
}

export function parseGitHubUpdateOptions(argv, environment = process.env) {
  let version = environment.PROJECT_WEAVE_RELEASE_VERSION?.trim() ?? '';
  let repository =
    environment.PROJECT_WEAVE_GITHUB_REPOSITORY?.trim() ?? DEFAULT_REPOSITORY;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--version') {
      version = argv[index + 1]?.trim() ?? '';
      index += 1;
    } else if (argument === '--repository') {
      repository = argv[index + 1]?.trim() ?? '';
      index += 1;
    } else {
      throw new Error(`Unsupported plugin update argument: ${argument}.`);
    }
  }

  const pluginPath = environment.PROJECT_WEAVE_PLUGIN_PATH?.trim() ?? '';
  if (pluginPath.length === 0) {
    throw new Error(
      'Set PROJECT_WEAVE_PLUGIN_PATH to the exact .obsidian/plugins/project-weave directory.',
    );
  }
  if (!SEMANTIC_VERSION.test(version)) {
    throw new Error(
      'Set PROJECT_WEAVE_RELEASE_VERSION or pass --version MAJOR.MINOR.PATCH[-PRERELEASE].',
    );
  }
  if (!REPOSITORY.test(repository)) {
    throw new Error('GitHub repository must use owner/name form.');
  }

  return {
    pluginPath: assertPluginDirectory(pluginPath),
    version,
    repository,
    token: environment.GITHUB_TOKEN?.trim() || null,
  };
}

export function assertPluginDirectory(path) {
  const pluginPath = resolve(path);
  if (
    basename(pluginPath).toLowerCase() !== 'project-weave' ||
    basename(dirname(pluginPath)).toLowerCase() !== 'plugins' ||
    basename(dirname(dirname(pluginPath))).toLowerCase() !== '.obsidian'
  ) {
    throw new Error(
      'PROJECT_WEAVE_PLUGIN_PATH must end with .obsidian/plugins/project-weave.',
    );
  }
  return pluginPath;
}

export function releaseByTagUrl(repository, version) {
  if (!REPOSITORY.test(repository) || !SEMANTIC_VERSION.test(version)) {
    throw new Error('Cannot build a release URL from unsafe input.');
  }
  return `https://api.github.com/repos/${repository}/releases/tags/${encodeURIComponent(version)}`;
}

export function releaseAssetApiUrl(repository, assetId, file) {
  if (!REPOSITORY.test(repository) || !Number.isSafeInteger(assetId)) {
    throw new Error('Cannot build a release asset URL from unsafe input.');
  }
  if (!PLUGIN_RUNTIME_FILES.includes(file)) {
    throw new Error(`Refusing to download an unmanaged plugin file: ${file}.`);
  }
  return `https://api.github.com/repos/${repository}/releases/assets/${String(assetId)}`;
}

export async function installGitHubRelease({
  pluginPath,
  version,
  repository = DEFAULT_REPOSITORY,
  token = null,
  fetchImpl = globalThis.fetch,
}) {
  const target = assertPluginDirectory(pluginPath);
  if (!SEMANTIC_VERSION.test(version)) {
    throw new Error('Release version must be semantic.');
  }
  if (!REPOSITORY.test(repository)) {
    throw new Error('GitHub repository must use owner/name form.');
  }
  if (typeof fetchImpl !== 'function') {
    throw new Error('This Node.js runtime does not provide fetch.');
  }

  const stagingRoot = await mkdtemp(
    join(tmpdir(), 'project-weave-github-update-'),
  );
  const stagedPlugin = join(stagingRoot, 'project-weave');
  const backupDirectory = join(stagingRoot, 'backup');
  try {
    await Promise.all([
      mkdir(stagedPlugin, { recursive: true }),
      mkdir(backupDirectory, { recursive: true }),
    ]);
    const apiHeaders = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'Project-Weave-release-updater',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(token === null ? {} : { Authorization: `Bearer ${token}` }),
    };
    const releaseResponse = await fetchImpl(
      releaseByTagUrl(repository, version),
      { headers: apiHeaders, redirect: 'follow' },
    );
    if (!releaseResponse.ok) {
      throw new Error(
        `GitHub release ${version} could not be read (${String(releaseResponse.status)}).`,
      );
    }
    const release = await releaseResponse.json();
    if (release?.tag_name !== version || !Array.isArray(release.assets)) {
      throw new Error(`GitHub release ${version} returned invalid metadata.`);
    }
    const assets = new Map();
    for (const asset of release.assets) {
      if (
        asset !== null &&
        typeof asset === 'object' &&
        typeof asset.name === 'string' &&
        Number.isSafeInteger(asset.id)
      ) {
        if (assets.has(asset.name)) {
          throw new Error(
            `GitHub release ${version} contains duplicate ${asset.name} assets.`,
          );
        }
        assets.set(asset.name, asset.id);
      }
    }
    await Promise.all(
      PLUGIN_RUNTIME_FILES.map(async (file) => {
        const assetId = assets.get(file);
        if (!Number.isSafeInteger(assetId)) {
          throw new Error(`GitHub release ${version} did not provide ${file}.`);
        }
        const url = releaseAssetApiUrl(repository, assetId, file);
        const response = await fetchImpl(url, {
          headers: { ...apiHeaders, Accept: 'application/octet-stream' },
          redirect: 'follow',
        });
        if (!response.ok) {
          throw new Error(
            `GitHub release ${version} did not provide ${file} (${String(response.status)}).`,
          );
        }
        const bytes = Buffer.from(await response.arrayBuffer());
        if (bytes.length === 0) {
          throw new Error(`GitHub release asset ${file} is empty.`);
        }
        await writeFile(join(stagedPlugin, file), bytes);
      }),
    );

    const manifest = JSON.parse(
      await readFile(join(stagedPlugin, 'manifest.json'), 'utf8'),
    );
    if (manifest.id !== 'project-weave') {
      throw new Error('Downloaded manifest does not identify Project Weave.');
    }
    if (manifest.version !== version) {
      throw new Error(
        `Downloaded manifest version ${String(manifest.version)} does not match release ${version}.`,
      );
    }
    const bundle = await readFile(join(stagedPlugin, 'main.js'), 'utf8');
    if (bundle.includes('sourceMappingURL')) {
      throw new Error('Downloaded main.js unexpectedly contains a source map.');
    }

    await mkdir(target, { recursive: true });
    const managedFiles = [
      ...PLUGIN_RUNTIME_FILES,
      ...RETIRED_PLUGIN_RUNTIME_FILES,
    ];
    const previouslyPresent = new Set();
    for (const file of managedFiles) {
      const installed = join(target, file);
      if ((await stat(installed).catch(() => null)) !== null) {
        previouslyPresent.add(file);
        await copyFile(installed, join(backupDirectory, file));
      }
    }

    try {
      for (const file of PLUGIN_RUNTIME_FILES) {
        await copyFile(join(stagedPlugin, file), join(target, file));
      }
      for (const file of RETIRED_PLUGIN_RUNTIME_FILES) {
        await rm(join(target, file), { force: true });
      }
    } catch (error) {
      for (const file of managedFiles) {
        const installed = join(target, file);
        if (previouslyPresent.has(file)) {
          await copyFile(join(backupDirectory, file), installed);
        } else {
          await rm(installed, { force: true });
        }
      }
      throw error;
    }

    return {
      pluginPath: target,
      repository,
      version,
      installedFiles: PLUGIN_RUNTIME_FILES,
    };
  } finally {
    await rm(stagingRoot, { recursive: true, force: true });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const environment = await loadGitHubUpdateEnvironment();
  const options = parseGitHubUpdateOptions(process.argv.slice(2), environment);
  const result = await installGitHubRelease(options);
  console.log(
    `Installed Project Weave ${result.version} from ${result.repository}:`,
  );
  console.log('  ' + result.pluginPath);
  for (const file of result.installedFiles) {
    console.log('  ' + file);
  }
  console.log('Reload Obsidian or disable and re-enable Project Weave.');
}
