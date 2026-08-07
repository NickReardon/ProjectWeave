import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertCurrentWork,
  findCurrentWorkViolations,
} from './verify-current-work.mjs';

const VALID_HANDOFF = `# Project Weave Current Work

## Operational state

- The complete gate passed against source commit \`abc1234\`.
- Detailed release steps remain in \`docs/development/release.md\`.

## Next decision point

1. Complete the outstanding manual checks.
`;

test('accepts post-merge operational state and immutable evidence', () => {
  assert.deepEqual(findCurrentWorkViolations(VALID_HANDOFF), []);
  assert.doesNotThrow(() => assertCurrentWork(VALID_HANDOFF));
});

test('rejects checkout-oriented sections and fields', () => {
  const source = `${VALID_HANDOFF}
## Snapshot

- **Branch:** codex/current-work-workflow
- **Commit:** abc1234
- **Branch hygiene:** clean

## Active slices
`;

  const violations = findCurrentWorkViolations(source);
  assert.equal(violations.length, 5);
  assert.throws(() => assertCurrentWork(source), /volatile checkout state/u);
});

test('rejects branch identifiers and landing instructions', () => {
  const source = `${VALID_HANDOFF}
1. Merge the dashboard branch into main.
- Validation ran on feat/all-tasks.
`;

  assert.deepEqual(
    findCurrentWorkViolations(source).map(({ message }) => message),
    [
      'write the next decision for the post-merge state, not as a merge instruction',
      'remove branch identifiers; keep pre-merge handoff details outside CURRENT_WORK.md',
    ],
  );
});
