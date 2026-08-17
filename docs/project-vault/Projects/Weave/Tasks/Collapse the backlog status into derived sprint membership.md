---
type: task
title: Collapse the backlog status into derived sprint membership
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-planning-periods]]'
status: backlog
category: enhancement
priority: normal
rank: 6000
milestone: '[[Milestones/v1 release]]'
created: 2026-08-17
---

# Collapse the backlog status into derived sprint membership

## Summary

"Backlog" currently means two things, and they coincide only because sprints do
not exist yet.

- **A stored status.** `backlog` is one of the seven controlled status values in
  `src/domain/model.ts`. Task management specifies that initial status defaults
  to it and that Add to Board moves a backlog task to `todo`.
- **A derived condition.** Task management also states that a task reopened
  after sprint completion "is backlog work unless explicitly assigned to a
  current eligible sprint", and that removing a sprint "sends the task to
  backlog". That reading is computed from sprint membership, not stored.

Once planning periods land the two diverge: a task with `status: todo` that is
in no sprint is backlog work by the derived reading and board work by the
stored one.

## Decision

Deferred deliberately. The status-based model is correct and unambiguous while
sprints do not exist, so nothing is broken today. The collapse is folded into
the planning-periods work rather than done separately, because that is the point
at which the derived reading becomes computable and the two definitions start to
disagree.

The intended end state is that backlog is derived — a non-terminal task not
assigned to a current sprint — rather than a status a user selects.

## Why this cannot be a specification edit alone

`status` values are a compatibility surface, and `backlog` is written into every
existing task note in this vault. Removing it from the vocabulary is a migration
of notes on disk, not a redefinition. Any change therefore needs a migration
path for existing notes and a decision record.

If the collapse proves too invasive, the fallback is to keep `backlog` as a
stored status and give the derived condition its own name, so one word stops
carrying two meanings.

## Acceptance criteria

- Exactly one meaning of "backlog" survives in the specifications, or the two
  meanings carry distinct names.
- Existing notes using `status: backlog` remain readable, with a stated
  migration path if the value is retired.
- The backlog/board boundary has one owner, consistent with
  [[Tasks/Resolve the workbench and workspace view ownership overlap]].

## Notes

Found while resolving the workbench and workspace ownership overlap. That task
settled which document owns the boundary but not that the term itself is
overloaded, so this is its remainder rather than a repeat.
