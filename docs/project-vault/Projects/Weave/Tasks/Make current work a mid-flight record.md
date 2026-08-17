---
type: task
title: Make current work a mid-flight record
project: '[[Projects/Weave/Project]]'
status: done
category: chore
priority: critical
rank: 150
origin: '[[Documents/Design/Documentation authority and document lifecycle]]'
created: 2026-08-16
---

# Make current work a mid-flight record

## Summary

`docs/CURRENT_WORK.md` was an append-only accounting of every gate run, and had
gone six commits without an entry. Turn it into a short in-flight record and let
the commit log carry verification and task-state history, per ADR 0023.

## Acceptance criteria

- `CURRENT_WORK.md` holds in-flight state only and is rewritten, not appended.
- The accumulated log is archived rather than deleted, and reachable from the
  archive index.
- ADR 0015 is marked superseded, with the half that still stands named in
  ADR 0023 rather than edited into 0015.
- `scripts/verify-current-work.mjs` stops rejecting checkout state and starts
  rejecting accumulation; its Node test covers both directions.
- The routing documents point verification history at `git log`.

## Validation

`npm run current-work:check` against the rewritten file, the Node test for the
retargeted guard, and the complete automated gate.
