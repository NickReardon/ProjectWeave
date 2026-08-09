---
type: task
title: Add Epic roadmap graph fields
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-10-project-structure-and-contracts]]'
status: backlog
priority: high
created: 2026-08-09
---

# Add Epic roadmap graph fields

## Summary

Parse Epic `rank`, `depends_on`, and `milestone`; validate cycles and
cross-project links; support enforced and advisory activation modes.

## Acceptance criteria

- Roadmap order is topological, rank-ordered, and path-deterministic.
- Only completed prerequisites unblock an Epic.
- Epic milestone membership is derived and task milestone links are untouched.

## Validation

Add graph tests for cycles, project mismatches, rank ties, and activation modes.
