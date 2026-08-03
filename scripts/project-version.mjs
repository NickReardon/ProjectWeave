import { readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;
const PROJECT_FILES = {
  packageJson: 'package.json',
  packageLock: 'package-lock.json',
  manifest: 'manifest.json',
  versions: 'versions.json',
};

export async function readProjectState() {
  const [packageJson, packageLock, manifest, versions] = await Promise.all([
    readJson(PROJECT_FILES.packageJson),
    readJson(PROJECT_FILES.packageLock),
    readJson(PROJECT_FILES.manifest),
    readJson(PROJECT_FILES.versions),
  ]);
  return { packageJson, packageLock, manifest, versions };
}

export function assertProjectVersion(state) {
  const current = state.packageJson.version;
  const errors = [];

  try {
    parseVersion(current);
  } catch (error) {
    errors.push(errorMessage(error));
  }

  if (state.manifest.version !== current) {
    errors.push(
      'manifest.json version ' +
        String(state.manifest.version) +
        ' does not match package.json version ' +
        String(current) +
        '.',
    );
  }
  if (state.packageLock.version !== current) {
    errors.push(
      'package-lock.json version ' +
        String(state.packageLock.version) +
        ' does not match package.json version ' +
        String(current) +
        '.',
    );
  }
  if (state.packageLock.packages?.['']?.version !== current) {
    errors.push(
      'package-lock.json root package version ' +
        String(state.packageLock.packages?.['']?.version) +
        ' does not match package.json version ' +
        String(current) +
        '.',
    );
  }
  if (state.versions[current] !== state.manifest.minAppVersion) {
    errors.push(
      'versions.json must map ' +
        String(current) +
        ' to minAppVersion ' +
        String(state.manifest.minAppVersion) +
        '.',
    );
  }

  if (errors.length > 0) {
    throw new Error(
      'Project version metadata is inconsistent:\n- ' + errors.join('\n- '),
    );
  }
  return current;
}

export function incrementVersion(current, requested) {
  const [major, minor, patch] = parseVersion(current);
  if (requested === 'major') {
    return [major + 1, 0, 0].join('.');
  }
  if (requested === 'minor') {
    return [major, minor + 1, 0].join('.');
  }
  if (requested === 'patch') {
    return [major, minor, patch + 1].join('.');
  }
  parseVersion(requested);
  if (compareVersions(requested, current) <= 0) {
    throw new Error(
      'Explicit project version ' +
        requested +
        ' must be greater than current version ' +
        current +
        '.',
    );
  }
  return requested;
}

export function createUpdatedState(state, requested) {
  const current = assertProjectVersion(state);
  const next = incrementVersion(current, requested);
  if (next === current) {
    throw new Error('Project version is already ' + current + '.');
  }
  if (Object.hasOwn(state.versions, next)) {
    throw new Error(
      'versions.json already contains ' +
        next +
        '; refusing to reuse a published version.',
    );
  }

  const packageLock = structuredClone(state.packageLock);
  if (packageLock.packages?.[''] === undefined) {
    throw new Error('package-lock.json is missing its root package record.');
  }
  packageLock.version = next;
  packageLock.packages[''].version = next;

  const versions = Object.fromEntries(
    [
      ...Object.entries(state.versions),
      [next, state.manifest.minAppVersion],
    ].sort(([left], [right]) => compareVersions(left, right)),
  );

  return {
    packageJson: { ...state.packageJson, version: next },
    packageLock,
    manifest: { ...state.manifest, version: next },
    versions,
  };
}

export async function writeProjectState(state) {
  await Promise.all([
    writeJson(PROJECT_FILES.packageJson, state.packageJson),
    writeJson(PROJECT_FILES.packageLock, state.packageLock),
    writeJson(PROJECT_FILES.manifest, state.manifest),
    writeJson(PROJECT_FILES.versions, state.versions),
  ]);
}

async function main() {
  const command = process.argv[2];
  const state = await readProjectState();
  const current = assertProjectVersion(state);

  if (command === 'check') {
    console.log('Project version verified: ' + current);
    return;
  }
  if (command === 'show') {
    console.log(current);
    return;
  }
  if (command === undefined) {
    throw new Error(
      'Provide patch, minor, major, or an explicit MAJOR.MINOR.PATCH version.',
    );
  }

  const updated = createUpdatedState(state, command);
  await writeProjectState(updated);
  const next = assertProjectVersion(updated);
  console.log('Project version updated: ' + current + ' -> ' + next);
}

function parseVersion(value) {
  if (typeof value !== 'string') {
    throw new Error('Project version must be a string.');
  }
  const match = VERSION_PATTERN.exec(value);
  if (match === null) {
    throw new Error(
      'Project version ' +
        value +
        ' must use stable MAJOR.MINOR.PATCH semantic versioning.',
    );
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareVersions(left, right) {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);
  for (let index = 0; index < leftParts.length; index += 1) {
    const difference = leftParts[index] - rightParts[index];
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function writeJson(path, value) {
  await writeFile(path, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

const isMain =
  process.argv[1] !== undefined &&
  pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  main().catch((error) => {
    console.error(errorMessage(error));
    process.exitCode = 1;
  });
}
