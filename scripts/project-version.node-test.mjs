import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertProjectVersion,
  createUpdatedState,
  incrementVersion,
} from './project-version.mjs';

test('increments stable project versions', () => {
  assert.equal(incrementVersion('0.1.9', 'patch'), '0.1.10');
  assert.equal(incrementVersion('0.1.9', 'minor'), '0.2.0');
  assert.equal(incrementVersion('0.1.9', 'major'), '1.0.0');
  assert.equal(incrementVersion('0.1.9', '2.3.4'), '2.3.4');
  assert.throws(() => incrementVersion('0.1.9', 'v1.0.0'));
  assert.throws(() => incrementVersion('0.1.9', '0.1.9'));
  assert.throws(() => incrementVersion('0.1.9', '0.1.8'));
});

test('synchronizes every project version record', () => {
  const updated = createUpdatedState(fixtureState(), 'patch');
  assert.equal(assertProjectVersion(updated), '0.1.1');
  assert.equal(updated.packageJson.version, '0.1.1');
  assert.equal(updated.packageLock.version, '0.1.1');
  assert.equal(updated.packageLock.packages[''].version, '0.1.1');
  assert.equal(updated.manifest.version, '0.1.1');
  assert.equal(updated.versions['0.1.1'], '1.8.0');
  assert.equal(updated.versions['0.1.0'], '1.8.0');
});

test('rejects inconsistent metadata and version reuse', () => {
  const inconsistent = fixtureState();
  inconsistent.manifest.version = '0.0.9';
  assert.throws(() => assertProjectVersion(inconsistent));

  const reused = fixtureState();
  reused.versions['0.1.1'] = '1.8.0';
  assert.throws(() => createUpdatedState(reused, 'patch'));
});

function fixtureState() {
  return {
    packageJson: { name: 'project-weave', version: '0.1.0' },
    packageLock: {
      name: 'project-weave',
      version: '0.1.0',
      packages: { '': { name: 'project-weave', version: '0.1.0' } },
    },
    manifest: {
      id: 'project-weave',
      version: '0.1.0',
      minAppVersion: '1.8.0',
    },
    versions: { '0.1.0': '1.8.0' },
  };
}
