---
type: task
title: Give the work and task model one defining owner
project: '[[Projects/Weave/Project]]'
status: done
category: chore
priority: critical
rank: 200
origin: '[[Documents/Design/Documentation authority and document lifecycle]]'
created: 2026-08-16
---

# Give the work and task model one defining owner

## Summary

The task model is currently defined in the Data model and index spec (schema), the Task management spec (status
transitions and planning fields), and the Scheduling and milestones spec (priority, rank, due dates,
completion timestamps, milestone membership). Assign each fact one owner and
make the other documents link to it.

## Acceptance criteria

- Each task property is defined in exactly one specification; the others cite
  the owner instead of restating the rule.
- The scheduling and milestones spec's "Status and precedence" section is removed. No specification
  asserts precedence over another.
- The scheduling and milestones spec's "Portfolio dashboard" and "Project workbench" subsections either
  move to the Portfolio dashboard spec and the Project workbench spec or become links to them.
- The task status vocabulary is enumerated in one place and referenced
  elsewhere.
- No behavior changes; this is a relocation of text, and any rule that would
  change meaning on the move is called out rather than silently rewritten.

## Validation

Read the affected specifications end to end for contradictions, then run
`npm run check`.
