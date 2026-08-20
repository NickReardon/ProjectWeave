---
type: task
title: Retire the old document directories
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-dogfood-vault-migration]]'
status: done
category: loose-end
priority: normal
rank: 2900
milestone: '[[Milestones/v1 release]]'
created: 2026-08-18
---

# Retire the old document directories

## Summary

The staged migration leaves short routing pointers at `docs/spec/` and
`docs/decisions/` so that existing links and habits keep working while the
documents move. A pointer is a temporary measure, and the migration is not
finished while two locations still answer the same question. This task removes
them once nothing depends on them.

## Why it is separate

Retiring the pointers is the step that can only happen after the links have
been migrated and used for a while. Folding it into the move would either hold
the move open or delete the pointers before anything has proven it is safe —
and a pointer that outlives its purpose is a second answer to "where does this
live", which is the condition the migration exists to end.

## Acceptance criteria

- `docs/spec/` and `docs/decisions/` no longer exist, or contain nothing that
  reads as authoritative.
- No link in the repository, the vault, or the generated context files resolves
  through a pointer.
- `npm run docs:links` and `./agents doctor` pass afterwards.

## Notes

Blocked by [[Tasks/Migrate document links and tooling paths]]. Deliberately not
done in the same change: the pointers exist precisely so the two steps can be
separated.
