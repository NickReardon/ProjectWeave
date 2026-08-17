import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertCurrentWork,
  findCurrentWorkViolations,
} from './verify-current-work.mjs';

const VALID_RECORD = `# Project Weave Current Work

## In flight

Documentation authority repair. Four ranked tasks are done.

## Verified, not yet committed

The complete gate passes over the documentation work.

## Next

1. Split the prerelease changes from the authority changes and commit each.
`;

test('accepts a mid-flight record, including checkout state', () => {
  assert.deepEqual(findCurrentWorkViolations(VALID_RECORD), []);
  assert.doesNotThrow(() => assertCurrentWork(VALID_RECORD));
});

test('merge-ready mode requires an empty in-flight section', () => {
  const clean = `# Project Weave Current Work\n\n## In flight\n\nNone.\n\n## Verified\n\nThe gate passes.`;
  assert.doesNotThrow(() =>
    assertCurrentWork(clean, 'CURRENT_WORK.md', { mergeReady: true }),
  );

  const dirty = clean.replace('None.', 'Keep reviewing the release notes.');
  assert.throws(
    () => assertCurrentWork(dirty, 'CURRENT_WORK.md', { mergeReady: true }),
    /only `None\.`/u,
  );
});

test('ordinary mode continues to allow in-flight text', () => {
  assert.doesNotThrow(() =>
    assertCurrentWork(VALID_RECORD, 'CURRENT_WORK.md', { mergeReady: false }),
  );
});

test('merge-ready mode rejects duplicate in-flight sections', () => {
  const duplicate = `# Project Weave Current Work

## In flight

None.

## Next

Ship it.

## In flight

None.
`;
  assert.throws(
    () => assertCurrentWork(duplicate, 'CURRENT_WORK.md', { mergeReady: true }),
    /exactly one `## In flight`/u,
  );
});

test('accepts the branch and commit detail the old gate rejected', () => {
  const source = `${VALID_RECORD}
## Snapshot

- **Branch:** feat/multi-file-commit-coordinator
- **Commit:** abc1234

1. Merge the dashboard branch into main.
`;

  assert.deepEqual(findCurrentWorkViolations(source), []);
});

test('rejects the accumulated verification log', () => {
  const source = `${VALID_RECORD}
## Automated verification
`;

  assert.deepEqual(
    findCurrentWorkViolations(source).map(({ message }) => message),
    [
      'remove the accumulated verification log; a commit records the gate result for its own change',
    ],
  );
  assert.throws(() => assertCurrentWork(source), /accumulating history/u);
});

test('rejects dated gate evidence in either order', () => {
  const trailing = `${VALID_RECORD}
- \`npm run check\` passed on 2026-08-09 against source commit \`ef1db32\`.
`;
  const leading = `${VALID_RECORD}
- On 2026-08-09, \`npm run check\` passed against source commit \`ef1db32\`.
`;

  for (const source of [trailing, leading]) {
    assert.deepEqual(
      findCurrentWorkViolations(source).map(({ message }) => message),
      [
        'remove dated gate evidence; `git log` is the accounting and cannot drift from it',
      ],
    );
  }
});

test('rejects a record that has grown back into an accounting', () => {
  const source = `${VALID_RECORD}${'\nfiller line'.repeat(100)}`;

  const messages = findCurrentWorkViolations(source).map(
    ({ message }) => message,
  );
  assert.ok(messages.some((message) => message.includes('under 90 lines')));
});
