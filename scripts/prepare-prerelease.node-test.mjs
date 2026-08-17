import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  preparePrerelease,
  prereleaseNotes,
  prereleaseVersion,
  stampPreviewManifest,
} from './prepare-prerelease.mjs';

const SOURCE_SHA = 'a'.repeat(40);
const CHECKSUM = 'b'.repeat(64);

test('derives one semantic prerelease version from the target and run', () => {
  assert.equal(prereleaseVersion('0.7.0', 42), '0.7.0-beta.42');
  assert.throws(() => prereleaseVersion('v0.7.0', 42), /MAJOR/u);
  assert.throws(() => prereleaseVersion('0.7.0', 0), /positive/u);
});

test('uses the globally unique workflow run ID for preview versions', async () => {
  const workflow = await readFile(
    new URL('../.github/workflows/prerelease.yml', import.meta.url),
    'utf8',
  );
  assert.match(workflow, /beta\.\$\{GITHUB_RUN_ID\}/u);
  assert.doesNotMatch(workflow, /beta\.\$\{GITHUB_RUN_NUMBER\}/u);
});

test('stamps only the generated manifest version', () => {
  assert.deepEqual(
    stampPreviewManifest(
      { id: 'project-weave', minAppVersion: '1.8.0', version: '0.6.0' },
      '0.7.0-beta.42',
    ),
    {
      id: 'project-weave',
      minAppVersion: '1.8.0',
      version: '0.7.0-beta.42',
    },
  );
});

test('writes release notes with source, validation, compatibility, and checksum', () => {
  const notes = prereleaseNotes({
    version: '0.7.0-beta.42',
    sourceSha: SOURCE_SHA,
    minAppVersion: '1.8.0',
    testFocus: 'Install and update from a clean vault.',
    companionChecksum: CHECKSUM,
  });
  for (const value of [
    '0.7.0-beta.42',
    SOURCE_SHA,
    'complete `npm run check` gate passed',
    '1.8.0 or newer',
    'Install and update from a clean vault.',
    CHECKSUM,
    'BRAT installs only',
  ]) {
    assert.match(notes, new RegExp(value.replaceAll('.', '\\.')));
  }
});

test('prepares matching manifest, notes, and companion metadata', async () => {
  const root = await mkdtemp(join(tmpdir(), 'project-weave-prerelease-'));
  try {
    const pluginDirectory = join(root, 'project-weave');
    const companionDirectory = join(root, 'companion');
    await Promise.all([
      mkdir(pluginDirectory, { recursive: true }),
      mkdir(companionDirectory, { recursive: true }),
    ]);
    await writeFile(
      join(pluginDirectory, 'manifest.json'),
      JSON.stringify({
        id: 'project-weave',
        minAppVersion: '1.8.0',
        version: '0.6.0',
      }),
    );
    const companion = 'bundle 0.7.0-beta.42';
    await writeFile(
      join(companionDirectory, 'project-weave-mcp.cjs'),
      companion,
    );
    const checksum = createHash('sha256').update(companion).digest('hex');
    await writeFile(
      join(companionDirectory, 'project-weave-mcp.cjs.sha256'),
      `${checksum}  project-weave-mcp.cjs\n`,
    );

    const result = await preparePrerelease({
      exportRoot: root,
      version: '0.7.0-beta.42',
      sourceSha: SOURCE_SHA,
      testFocus: 'Fresh BRAT installation.',
    });
    const manifest = JSON.parse(await readFile(result.manifestPath, 'utf8'));
    assert.equal(manifest.version, '0.7.0-beta.42');
    assert.match(await readFile(result.notesPath, 'utf8'), /Fresh BRAT/u);
    assert.equal(result.companionChecksum, checksum);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
