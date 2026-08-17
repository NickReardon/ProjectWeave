import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const SEMANTIC_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u;
const STABLE_VERSION = /^\d+\.\d+\.\d+$/u;
const SHA_256 = /^[a-f0-9]{64}$/u;

export function prereleaseVersion(targetVersion, runNumber) {
  if (!STABLE_VERSION.test(targetVersion)) {
    throw new Error('target_version must be MAJOR.MINOR.PATCH.');
  }
  if (!/^[1-9]\d*$/u.test(String(runNumber))) {
    throw new Error('run_number must be a positive integer.');
  }
  return `${targetVersion}-beta.${String(runNumber)}`;
}

export function stampPreviewManifest(manifest, version) {
  if (!SEMANTIC_VERSION.test(version)) {
    throw new Error('Preview version is not semantic.');
  }
  if (
    manifest === null ||
    typeof manifest !== 'object' ||
    Array.isArray(manifest) ||
    typeof manifest.id !== 'string' ||
    typeof manifest.minAppVersion !== 'string'
  ) {
    throw new Error('Generated plugin manifest is invalid.');
  }
  return { ...manifest, version };
}

export function prereleaseNotes({
  version,
  sourceSha,
  minAppVersion,
  testFocus,
  companionChecksum,
}) {
  if (!SEMANTIC_VERSION.test(version)) {
    throw new Error('Preview version is not semantic.');
  }
  if (!/^[a-f0-9]{40}$/u.test(sourceSha)) {
    throw new Error('Source SHA must be a full lowercase Git commit SHA.');
  }
  if (!SHA_256.test(companionChecksum)) {
    throw new Error('Companion checksum must be SHA-256.');
  }
  const focus = testFocus.trim();
  if (focus.length === 0) {
    throw new Error('Test focus must not be empty.');
  }

  return [
    `# Project Weave ${version}`,
    '',
    'Public preview for installation through BRAT.',
    '',
    `- Source commit: \`${sourceSha}\``,
    '- Validation: complete `npm run check` gate passed before publication',
    `- Obsidian compatibility: ${minAppVersion} or newer`,
    `- Test focus: ${focus}`,
    `- Optional companion SHA-256: \`${companionChecksum}\``,
    '',
    '## Installation',
    '',
    'BRAT installs only `main.js`, `manifest.json`, and `styles.css`. Add',
    '`NickReardon/ProjectWeave` as a beta plugin and select this version.',
    '',
    'The `project-weave-mcp.cjs` asset is optional and must be downloaded and',
    'configured separately. Core plugin behavior does not require it.',
    '',
    '## Preview limitations',
    '',
    '- This is a prerelease for focused testing, not a stable Community release.',
    '- Use BRAT to move between prerelease and later stable versions.',
    '- Report the version, source SHA, Obsidian version, platform, and steps.',
    '',
  ].join('\n');
}

export async function preparePrerelease({
  exportRoot,
  version,
  sourceSha,
  testFocus,
}) {
  const manifestPath = join(exportRoot, 'project-weave', 'manifest.json');
  const companionPath = join(exportRoot, 'companion', 'project-weave-mcp.cjs');
  const checksumPath = companionPath + '.sha256';
  const notesPath = join(exportRoot, 'prerelease-notes.md');

  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const stamped = stampPreviewManifest(manifest, version);
  await writeFile(manifestPath, JSON.stringify(stamped, null, 2) + '\n');

  const companion = await readFile(companionPath, 'utf8');
  if (!companion.includes(version)) {
    throw new Error(
      'Companion bundle does not contain the generated preview version.',
    );
  }
  const checksumLine = (await readFile(checksumPath, 'utf8')).trim();
  const companionChecksum = checksumLine.split(/\s+/u)[0] ?? '';
  const notes = prereleaseNotes({
    version,
    sourceSha,
    minAppVersion: stamped.minAppVersion,
    testFocus,
    companionChecksum,
  });
  await writeFile(notesPath, notes);
  return { manifestPath, notesPath, companionChecksum };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const version = process.env.PROJECT_WEAVE_BUILD_VERSION?.trim() ?? '';
  const sourceSha = process.env.PROJECT_WEAVE_SOURCE_SHA?.trim() ?? '';
  const testFocus = process.env.PROJECT_WEAVE_TEST_FOCUS?.trim() ?? '';
  if (!SEMANTIC_VERSION.test(version)) {
    throw new Error('PROJECT_WEAVE_BUILD_VERSION must be a semantic version.');
  }
  const result = await preparePrerelease({
    exportRoot: resolve('export'),
    version,
    sourceSha,
    testFocus,
  });
  console.log(`Prepared prerelease manifest: ${result.manifestPath}`);
  console.log(`Prepared prerelease notes: ${result.notesPath}`);
  console.log(`Companion SHA-256: ${result.companionChecksum}`);
}
