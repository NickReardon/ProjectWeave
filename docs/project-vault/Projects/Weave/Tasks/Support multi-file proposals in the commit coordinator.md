---
type: task
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-mutation-kernel]]'
status: done
category: loose-end
rank: 3800
milestone: '[[Milestones/v1 release]]'
---

# Support multi-file proposals in the commit coordinator

The create-only commit coordinator accepts proposals with an explicit,
deterministic write order. It rejects duplicate or incompletely preconditioned
targets, rechecks the complete read set and every target, validates every
output before the first write, stops at the first unexpected failure, and
reports written, unchanged, and unwritten paths separately.

Focused tests cover ordered success, an invalid later output aborting before
the first write, malformed bulk proposals, and exact partial-success reporting.
Existing-note mutation remains separate Slice 3 work.
