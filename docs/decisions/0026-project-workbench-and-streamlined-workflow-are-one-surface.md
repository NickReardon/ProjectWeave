---
type: decision
id: '0026'
area: workbench
status: accepted
canonical: false
affects: ['project-workbench', 'streamlined-long-project-workflow']
---

# ADR 0026: Project workbench and streamlined workflow are one surface

- Status: accepted
- Date: 2026-08-17
- Owners: Project Weave

Once this record is accepted, its body is not edited. A decision that changes
is superseded by a new record; see [`README.md`](README.md).

## Context

[Project workbench](../spec/project-workbench.md) specifies workbench
perspectives and [Streamlined long-project workflow](../spec/streamlined-long-project-workflow.md)
specifies the Plan/Board/My Work workspace. Both documents described ranked
backlog ordering, priority/due filtering, and the backlog/board boundary,
each restating rather than owning the fact. This overlap was left alone
during an earlier pass that gave the work and task model one owner, and
[ADR 0007](0007-use-a-persistent-obsidian-workbench-view.md)'s follow-up
already commits to adding Plan, Board, and My Work perspectives onto the
same persistent view rather than a second one, so treating the two documents
as competing surfaces was never the intended design.

The Project workbench's Backlog perspective additionally described its scope
as "non-terminal tasks with no current sprint," which disagrees with the
status-based `backlog`/board split that
[ADR 0002](0002-single-project-first-progressive-workflow.md) already
decided and that Streamlined long-project workflow specifies throughout
(task flow, minimum data, Ranked backlog, Board).

## Decision

Project workbench and Streamlined long-project workflow describe one
surface. Project workbench owns the persistent view's mechanics: opening,
the perspective list, refresh/consistency, empty/invalid states, and
mobile/accessibility. Streamlined long-project workflow owns the workflow
model those perspectives present: task lifecycle, progressive disclosure,
ranked backlog ordering, priority/due filtering, and the backlog/board
boundary. Each specification now links to the other's owned facts instead
of restating them.

The Backlog perspective's scope description is corrected to defer to the
already-decided status-based backlog/board boundary rather than the
conflicting sprint-based wording, so the resulting text matches ADR 0002.
This is a documentation correction, not a new product decision: the
boundary itself was decided by ADR 0002 and is not reopened here.

## Alternatives considered

- **Two separate surfaces, each keeping its own view:** rejected because
  ADR 0007's follow-up already commits Plan, Board, and My Work to the same
  persistent-view boundary as the existing workbench perspectives.
- **Keep both definitions and add a precedence note:** rejected because
  [`docs/spec/README.md`](../spec/README.md) forbids one specification from
  asserting precedence over another; a precedence claim means two documents
  believe they own the same fact, which is the defect being resolved.
- **Silently keep the sprint-based Backlog wording:** rejected because it
  contradicts ADR 0002 and the status-based boundary specified throughout
  Streamlined long-project workflow.

## Consequences

- Positive: ranked backlog ordering, priority/due filtering, and the
  backlog/board boundary each have exactly one owning specification.
- Positive: the Backlog perspective's scope now matches the status-based
  boundary already decided by ADR 0002, removing a standing contradiction.
- Negative: none identified.
- Follow-up: a later documentation pass may want to align the workbench's
  perspective names (Backlog, Kanban, Owner, Ready/blocked/waiting) with the
  workflow's Plan/Board/My Work destinations explicitly, if that mapping
  ever needs to be spelled out rather than left implicit.
