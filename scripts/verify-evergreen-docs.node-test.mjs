import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertEvergreenDocumentation,
  findEvergreenDocumentationViolations,
} from './verify-evergreen-docs.mjs';

test('accepts evergreen placeholders and historical evidence is outside the scan', () => {
  assert.deepEqual(
    findEvergreenDocumentationViolations([
      {
        path: 'README.md',
        source:
          'tag=PASTE_EXACT_PRERELEASE_TAG_HERE\nchecksum is release-owned',
      },
    ]),
    [],
  );
});

test('rejects generated beta tags and concrete checksums', () => {
  const entries = [
    { path: 'README.md', source: '0.7.0-beta.42\n' + 'a'.repeat(64) },
  ];
  assert.equal(findEvergreenDocumentationViolations(entries).length, 2);
  assert.throws(
    () => assertEvergreenDocumentation(entries),
    /release-specific SHA-256/u,
  );
});

test('rejects concrete checksums in every evergreen file', () => {
  for (const path of [
    'README.md',
    '.env.example',
    'docs/development/release.md',
  ]) {
    assert.equal(
      findEvergreenDocumentationViolations([{ path, source: 'a'.repeat(64) }])
        .length,
      1,
    );
  }
});

test('does not inspect historical task evidence', () => {
  assert.doesNotThrow(() =>
    assertEvergreenDocumentation([
      { path: 'docs/project-vault/task.md', source: '0.7.0-beta.42' },
    ]),
  );
});
