# 15 — Project Lifecycle, Ranking, Scheduling, and Milestones

## Status and precedence

Approved for v1 on 2026-08-02. This document extends the original feature designs. Where an older design says task due dates, completion timestamps, manual ranking, milestone entities, or project lifecycle are absent or undecided, this document takes precedence.

## Goal

Add the minimum scheduling and lifecycle information needed to answer: which projects are live, what should happen next, what is due, what has actually finished, and which dated outcomes matter.

## Project lifecycle

Projects MAY declare:

```yaml
type: project
status: active
```

Controlled statuses are:

- `planned`: accepted but execution has not started;
- `active`: currently being executed;
- `paused`: intentionally not progressing but expected to resume;
- `completed`: intended project outcome was delivered;
- `cancelled`: stopped without completing the intended outcome;
- `archived`: terminal project hidden from normal operational views.

A missing project status is interpreted as `active` for backward-compatible display without rewriting the note. Invalid values are errors.

Allowed UI transitions are explicit. Only completed or cancelled projects may become archived. Unarchiving requires choosing `completed` or `cancelled`. Completing, cancelling, pausing, or archiving a project never changes tasks, epics, milestones, or sprints. A transition to a terminal state previews unfinished child work and requires acknowledgement.

Active/planned dashboards exclude archived projects by default and allow an Include Archived filter.

## Controlled task priority

Optional task `priority` values are:

```yaml
priority: critical | high | normal | low
```

Missing priority is displayed and sorted as `normal` without adding the property. Invalid values are errors. Priority affects presentation/order only; it never changes dependency readiness, sprint eligibility, or status-transition validity.

Default priority sort is critical, high, normal/missing, low, followed by rank and stable path tie-breaker.

## Stable backlog rank

Tasks MAY contain a positive integer rank:

```yaml
rank: 3000
```

Ranks are scoped to a project and sort ascending. They represent user ordering, not dependency edges, priority, or sprint commitment. A task retains its rank while assigned to a sprint so returning it to backlog restores its prior relative position.

### Creation and reorder

- New tasks default after the largest project rank using a gap of 1000.
- Inserting between ranks uses an available integer midpoint.
- Missing ranks sort after ranked tasks, using priority then normalized path for deterministic order.
- Duplicate ranks are warnings and use normalized path as a deterministic tie-breaker.
- If no integer gap remains, Rebalance Backlog Ranks proposes ranks `1000, 2000, 3000, ...` for the affected project.

Rebalancing is an explicit, previewed bulk operation. Automatic indexing/rendering never rewrites ranks. Dragging and keyboard reordering invoke the same reorder application service.

## Task due dates and overdue state

Tasks MAY declare a local calendar due date:

```yaml
due_date: 2026-08-14
```

The value is a strict `YYYY-MM-DD` date with no time component. A task is overdue when it is non-terminal and `due_date` is earlier than today's local calendar date. It is due today when equal. `done` and `cancelled` tasks are never currently overdue.

Due date does not affect readiness. A task due after a sprint ends generates a planning warning, not an error. Sprint-end risk and task overdue are distinct labels.

## Task completion timestamps

Transitioning a task into `done` records an ISO 8601 timestamp with UTC offset:

```yaml
completed_at: 2026-08-14T16:42:00-07:00
```

Rules:

- If an explicit valid `completed_at` already exists, the UI preserves it unless the user chooses Replace Timestamp.
- `completed_at` on a non-done task is a validation error.
- Cancelling a task does not set `completed_at`.
- Reopening a done task appends the prior completion and reopen timestamps to `completion_history`, then removes current `completed_at`.
- Completing it again sets a new `completed_at`.

```yaml
completion_history:
  - completed_at: 2026-08-14T16:42:00-07:00
    reopened_at: 2026-08-15T09:10:00-07:00
```

Recently Completed sorts by current `completed_at`, never file modification time. Cycle-time metrics may use trustworthy timestamps only when the required start event is available; v1 does not fabricate one from modification time.

## Milestone entity

A milestone is one dated, project-scoped outcome represented by one canonical Markdown note:

```yaml
type: milestone
title: Playable Travel Loop
project: "[[Tethered]]"
status: planned
due_date: 2026-08-16
owner: Alice
origin: "[[Vertical Slice Definition#Travel]]"
created: 2026-08-02
```

Required fields are `type`, `project`, `status`, and `due_date`. Optional fields are `title`, `owner`, `origin`, and `created`. Controlled statuses are `planned`, `achieved`, and `cancelled`.

A planned milestone is overdue when its due date is earlier than today. Overdue is derived and never persisted as a competing status. Transitioning to achieved records `achieved_at` using the completion-timestamp format. Reopening appends the prior achievement/reopen pair to `achievement_history` and clears current `achieved_at`.

Achieving, reopening, or cancelling a milestone does not change linked tasks. Terminal transitions warn about unfinished linked tasks.

## Task–milestone membership

A task MAY link to one milestone:

```yaml
milestone: "[[Playable Travel Loop]]"
```

The milestone must belong to the task's project. Membership is derived from task notes; milestones never store a mirrored task array. A milestone may span epics and sprints. Moving a task to another project requires explicitly clearing or replacing an incompatible milestone.

## Views and commands

### Portfolio dashboard

Add Upcoming Milestones, Overdue Milestones, Due Today, and Overdue Tasks. Archived projects are hidden by default. Overdue counts use local-date derivation and never substitute sprint end dates.

### Project workbench

Add:

- manually reorderable Ranked Backlog;
- Milestones perspective with progress derived from member tasks;
- Due Soon/Overdue perspective;
- project-status selector;
- priority and due-date filters;
- Recently Completed ordered by `completed_at`.

Milestone progress shows member status counts and point totals where available. It is informational; achieving a milestone remains explicit.

### Commands

- Change Project Status
- Reorder Backlog Task
- Rebalance Backlog Ranks
- Set or Clear Task Priority
- Set or Clear Task Due Date
- Create Milestone
- Edit Milestone
- Mark Milestone Achieved
- Reopen Milestone
- Cancel Milestone
- Assign Task to Milestone or Clear Milestone
- Open Related Milestone

All commands follow the validation/proposal/write-safety contract.

## Validation codes

At minimum, provide stable diagnostics for:

- `project.status.invalid`
- `project.archive.not_terminal`
- `task.priority.invalid`
- `task.rank.invalid`
- `task.rank.duplicate`
- `task.due_date.invalid`
- `task.completed_at.invalid`
- `task.completed_at.status_mismatch`
- `task.completion_history.invalid`
- `milestone.project.missing`
- `milestone.status.invalid`
- `milestone.due_date.invalid`
- `milestone.achieved_at.status_mismatch`
- `task.milestone.project_mismatch`

## Acceptance criteria

- Missing project status and task priority remain backward compatible without passive writes.
- Project terminal/archive transitions never mutate child entities and warn about unfinished work.
- Ranking is deterministic; ordinary moves normally edit one task, and any rebalance is previewed as a bulk write.
- Readiness remains unchanged by priority, rank, due date, and milestone.
- Overdue behavior is correct across local-date boundaries and excludes terminal tasks/milestones.
- Done tasks have trustworthy `completed_at`; reopening preserves prior completion history.
- Milestone membership is project-consistent and derived only from task links.
- Recently Completed uses `completed_at`, not modification time.
- Full/incremental indexes agree for every new field and derived projection.
