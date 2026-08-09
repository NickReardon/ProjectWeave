---
type: milestone
title: Project Weave v1 Release Milestone
project: "[[Projects/Weave/Project]]"
status: planned
due_date: 2026-08-14
owner: ""
origin: "[[Projects/Weave/Project]]"
created: 2026-08-07
---

# Project Weave v1 Release Milestone

## Outcome

All nine slice Epics pass their exit gates, manual checks are recorded, and the
plugin ships a stable v1.

The required `due_date` is currently provisional. The roadmap being ported did
not set a release date, so `2026-08-14` must be confirmed before it is treated
as a release commitment.

## Success conditions

- [ ] Slice 1 accepted: creation flow, template catalog, remaining desktop checks
- [ ] Slice 2 implemented: shared reads + Agent Slice A (read-only bounded API)
- [ ] Slice 3 implemented: typed mutation kernel + multi-file preflight
- [ ] Slice 4 implemented: task editor, Board, Plan, My Work perspectives
- [ ] Slice 5 implemented: design-to-task planning + Agent Slice B
- [ ] Slice 6 implemented: epic, milestone, planning period entities
- [ ] Slice 7 implemented: optional planning periods + Agent Slice C
- [ ] Slice 8 implemented: controlled document patch engine + Agent Slice D
- [ ] Slice 9 accepted: schemas frozen, skill shipped, benchmarks recorded, desktop/mobile/manual checks passed

## Included work

Task membership is derived from task `milestone` links. The nine slice Epics
also declare this milestone, but the current Epic model does not interpret that
property; the intended Epic grouping is therefore documented rather than
queryable.

## Cross-cutting acceptance

- Full and incremental index behavior remain equivalent and project-isolated.
- Ordering and cursor bounds are deterministic; no view renders unbounded
  result sets.
- Preview bytes, stale fingerprints, collisions, dependency cycles, and
  partial failures have regression coverage.
- Supported edits preserve unknown fields, body content, and newline style.
- Gateway scope, path aliases, revocation, oversized proposals, untrusted note
  text, and approval replay fail closed.
- Plugin load, settings, indexing, navigation, and views remain non-writing
  except for explicitly configured derived diagnostics output.
- Automated and manual verification are reported separately before release.

## Progress

> Derived from member tasks with ``milestone`` property set to: [[Project Weave v1 Release Milestone]]

<!-- progress-placeholder -->

## Review

<!-- review notes, retrospective content, outcome captured on achieve/cancel -->
