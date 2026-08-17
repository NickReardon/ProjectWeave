---
type: task
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-template-catalog]]'
status: done
category: loose-end
rank: 4700
milestone: '[[Milestones/v1 release]]'
---

# Wire the remaining packaged starter templates to a note kind

The complete packaged starter set is embedded in the plugin and registered by
note kind and variant. Task and project have runtime creation consumers today;
the epic, milestone, planning-period, and document starters are ready for the
later creation services that own those kinds.

## Validation

- `PACKAGED_STARTER_TEMPLATES` publishes all seven kind/variant entries.
- Every embedded template parses for its declared kind and remains
  byte-identical to its editable source under `templates/default/`.
- `vitest run tests/unit/packaged-templates.test.ts` passed 22 tests on
  2026-08-09 against commit `816d036` plus the current dogfood-vault metadata
  edits.
