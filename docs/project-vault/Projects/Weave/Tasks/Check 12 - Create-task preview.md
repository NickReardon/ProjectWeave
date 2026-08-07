---
type: task
project: '[[Projects/Weave/Project]]'
status: done
category: manual-check
rank: 2100
---

# Check 12 - Create-task preview

Procedure: `docs/development/testing.md`, check 12.

Passed in two parts. Every branch — preview path and rank, subfolder
nesting, the collision suggestion, an unusable title, the changed-note
refusal, a missing `Tasks` folder, both entry points, and written bytes
matching the preview — passed against 0.3.0. ADR 0010 then changed the
frontmatter of every created task; the branches were not re-walked after
ADR 0010, but the modal tests drive the real preview service through all of
them and ADR 0010 changes only rendered bytes, not which branch is taken, so
this is accepted on that basis rather than re-run.
