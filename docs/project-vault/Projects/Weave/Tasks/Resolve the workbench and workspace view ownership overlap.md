---
type: task
title: Resolve the workbench and workspace view ownership overlap
project: '[[Projects/Weave/Project]]'
status: backlog
category: loose-end
priority: high
rank: 500
origin: '[[Documents/Design/Documentation authority and document lifecycle]]'
created: 2026-08-16
---

# Resolve the workbench and workspace view ownership overlap

## Summary

Found while giving the work and task model one owner, and deliberately left
alone rather than resolved silently. The project workbench spec specifies
workbench perspectives and the streamlined long-project workflow spec specifies
the Plan/Board/My Work workspace, and the two overlap: ranked backlog ordering,
priority and due filters, and the backlog/board boundary are described in both.

The scheduling and milestones spec's scheduling-derived view requirements have been moved to the Portfolio dashboard spec
and the Project workbench spec, so the overlap is now visible rather than hidden behind a
precedence claim.

## Acceptance criteria

- It is stated whether the Project workbench spec and the Streamlined long-project workflow spec describe one surface or two.
- If one surface, one document owns it and the other links; if two, each states
  what it owns and how they differ.
- Ranked backlog ordering, priority/due filtering, and the backlog/board
  boundary each have exactly one owner.
- No behavior changes without a decision record.

## Validation

Read Designs 09 and 16 together for contradictions, then `npm run check`.
