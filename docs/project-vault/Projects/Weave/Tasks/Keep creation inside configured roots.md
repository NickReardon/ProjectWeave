---
type: task
title: Keep creation inside configured roots
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-10-project-structure-and-contracts]]'
status: backlog
priority: high
created: 2026-08-09
---

# Keep creation inside configured roots

## Summary

Apply the configured folder map to target allocation, collision checks, and
explicit typed moves while materializing only the folder needed by a confirmed
operation.

## Acceptance criteria

- Task, Epic, milestone, planning-period, and document proposals use configured roots.
- A proposal cannot escape its project root or overwrite an existing note.
- No folder is created during indexing, settings changes, or activation.

## Validation

Add path, proposal, collision, and manual first-note materialization checks.
