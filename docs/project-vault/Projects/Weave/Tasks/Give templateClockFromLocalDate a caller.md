---
type: task
project: '[[Projects/Weave/Project]]'
status: done
category: loose-end
rank: 4600
---

# Give templateClockFromLocalDate a caller

`templateClockFromLocalDate` exists for a future caller. Nothing calls it
yet.

Resolved without a change: `src/main.ts` now imports and calls it at two
call sites, with unit coverage in `tests/unit/template-clock.test.ts`.
