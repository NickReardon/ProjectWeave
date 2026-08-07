---
type: spec
area: planning-periods
status: current
canonical: true
related_decisions: ["0003"]
---

# 06 — Sprints

## Goal

Plan and run time-bounded work for one project or a portfolio while preventing contradictory active assignments and retaining an auditable outcome history.

## Scope and optionality

Timeboxed planning is supported but never required. The board works with no planning period, and a project that uses none produces no warnings, empty views, or required setup.

A project displays the feature as **Sprint**, **Cycle**, or **Period** through `weave.planning_period_label`, defaulting to `sprint`. The label is presentation only: one stable Markdown schema — the `sprint` type and its fields — backs all three, and notes remain portable across the choice. This document uses "sprint" for that schema.

A task may be assigned to at most one current planning period. Goals, dates, activation, commitment totals, guided closing, and task history are available when the project uses them.

Portfolio-scoped planning periods sit outside the single-project v1 core. The portfolio-sprint behavior below remains the specified contract for that scope; it is deferred rather than redesigned, and the same deferral applies as in [14 — Non-goals and future features](14-non-goals-and-future-features.md).

## Sprint types

### Project sprint

Has `scope: project` and exactly one `project` wiki link.

### Portfolio sprint

Deferred beyond the single-project v1 core. Has `scope: portfolio` and a non-empty, unique `projects` wiki-link list. Every assigned task must belong to one participating project.

Both support `planned`, `active`, `completed`, and `cancelled` status; goal; start/end date; activation commitment; and closure summary.

## Create and edit

Creation requires title, scope, participating project(s), and status (default `planned`). Dates and goal are optional during creation but activation requires a non-empty goal plus valid start/end dates with `start_date <= end_date`.

Changing scope or participants preflights every assigned task. The change is blocked until incompatible assignments are explicitly removed or the relevant project is included. Active sprint scope/participants cannot be edited; return it to planned or close/cancel it through an explicit workflow.

## Planning

The planning view lists eligible backlog tasks grouped by project and optionally epic. It shows status, owner, points, readiness, direct blockers, and cross-project warnings.

- Tasks already assigned to another planned sprint may be moved only through an explicit reassignment.
- Tasks in another active sprint are ineligible.
- Terminal tasks are excluded by default and cannot be committed unless reopened.
- Selection shows total tasks, estimated tasks, total points, unestimated count, and warning count.
- Assignment to a planned sprint writes the task's `sprint` link; it does not activate the sprint.

## Activation

Activation is a multi-file proposal that validates:

1. sprint fields and participants;
2. every assigned task and project membership;
3. absence of overlapping active sprint participation for every project;
4. absence of tasks assigned to a different active sprint;
5. all same-project dependency graphs;
6. current file fingerprints.

Warnings for blocked, waiting, unowned, unestimated, or cross-project-dependent work require acknowledgement but do not prevent activation. Errors prevent it.

On confirmation, the sprint note records an immutable aggregate snapshot:

```yaml
commitment:
  activated_at: 2026-08-03T09:00:00-07:00
  task_count: 8
  estimated_task_count: 6
  points: 21
  unestimated_task_count: 2
```

The snapshot contains aggregates, not a mirrored task list. Sprint status becomes `active`. Task assignments already point to the sprint.

## Overlap rule

A project may participate in at most one active sprint regardless of scope. Date overlap among planned/completed sprints is allowed. Active participation—not calendar dates alone—enforces exclusivity. Activation fails with the conflicting sprint and project names.

## Closing

Closing an active sprint presents all non-terminal assigned tasks and requires exactly one outcome per task:

- **Return to backlog:** clear current `sprint`.
- **Carry forward:** assign an explicitly selected eligible planned/active target sprint.
- **Cancel task:** set status to `cancelled` and clear current `sprint`.

Done/cancelled tasks have current `sprint` cleared at close after history is appended. For every assigned task, append one history record:

```yaml
sprint_history:
  - sprint: "[[Vertical Slice Sprint 1]]"
    outcome: completed
    closed_at: 2026-08-16T17:00:00-07:00
```

Allowed outcomes are `completed`, `cancelled`, `returned`, and `carried`. A carried record also includes `carried_to`. The sprint records closure aggregates and becomes `completed`. Retrospective/review prose remains in its Markdown body.

## Cancellation

Cancelling a planned sprint requires all assigned tasks to be returned to backlog or reassigned. Cancelling an active sprint uses the same per-task resolution workflow as closing, records outcomes, and sets sprint status to `cancelled`; it does not imply task cancellation.

## Partial failure

Sprint activation and closing are multi-file writes. The preflight is all-or-nothing, but the vault has no assumed transaction. Writes use deterministic ordering and an operation report. If a runtime failure occurs, stop, list written and unwritten files, retain the proposal, and offer a safe retry that re-reads and reconciles current state.

## Acceptance criteria

- Project and portfolio membership constraints are enforced.
- No command can activate overlapping project participation.
- Activation records accurate aggregate commitments without mirrored task arrays.
- Closing cannot proceed until every unfinished task has an explicit outcome.
- Every departed task receives one history entry and no stale current sprint link.
- Planning/closing conflicts caused by external edits abort before overwriting.
