---
type: task
title: Add Epic roadmap graph fields
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-project-structure-and-contracts]]'
status: backlog
priority: high
created: 2026-08-09
---

# Add Epic roadmap graph fields

## Summary

Parse Epic `rank`, `depends_on`, and `milestone`, and milestone `rank`, so the
roadmap order this project already authors becomes queryable and validated.
Respecified by [[Documents/Decisions/0024-order-the-roadmap-by-milestone-and-rank|ADR 0024]]:
order comes from the milestone and from rank, never from a note name.

## Acceptance criteria

- Roadmap order is milestone rank, then topological order within the milestone,
  then Epic rank, then normalized path.
- Only completed prerequisites unblock an Epic; cycles and cross-project targets
  are errors, and enforced and advisory activation modes are both supported.
- Epic milestone membership is derived from the Epic link, and task milestone
  links are untouched.
- Milestone `rank` orders milestones; `due_date` orders nothing and is valid
  when absent.
- Renaming an Epic note changes no ordering.
- Dated and undated milestones both parse, and only a valid date derives due or
  overdue state.

## Validation

Graph tests for cycles, project mismatches, rank ties, missing ranks, and
activation modes. Parser, query, fixture, and workbench coverage for dated and
undated milestones.
