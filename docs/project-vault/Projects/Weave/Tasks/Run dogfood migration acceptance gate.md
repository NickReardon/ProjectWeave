---
type: task
title: Run dogfood migration acceptance gate
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-dogfood-vault-migration]]'
status: backlog
priority: high
created: 2026-08-09
---

# Run dogfood migration acceptance gate

## Summary

Exercise full and incremental indexing, document browsing, warning banners,
origin navigation, live refresh, mobile behavior, and workspace restoration on
the migrated dogfood vault.

## Acceptance criteria

- No unexpected diagnostics or duplicate canonical documents remain.
- Compatibility pointers resolve and manual checks are recorded in the vault.
- `npm run check` passes against the completed implementation.

## Validation

Capture automated evidence in `docs/CURRENT_WORK.md` and track remaining manual
checks as Project Weave tasks.
