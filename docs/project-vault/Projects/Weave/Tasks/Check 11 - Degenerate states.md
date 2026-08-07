---
type: task
project: '[[Projects/Weave/Project]]'
status: waiting
category: manual-check
rank: 2000
---

# Check 11 - Degenerate states

Procedure: `docs/development/testing.md`, check 11.

11a (multiple projects) has passed.

Outstanding:
- 11d (stale last-good banner) needs an index rebuild that throws, which
  ordinary use does not produce, and was not reached.
- 11b, 11c, 11e, 11f, and 11g are unrecorded. 11f now covers paging and the
  **Page** field rather than truncation, so it is outstanding on its new
  terms regardless.

Everything here except narrow layouts is automated; a disagreement between
the automated result and the app is a defect in the test double and should be
recorded as one.
