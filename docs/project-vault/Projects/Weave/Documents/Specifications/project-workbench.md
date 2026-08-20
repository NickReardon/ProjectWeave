---
type: spec
area: workbench
status: current
canonical: true
related_decisions: ["0007", "0011", "0026"]
---

# Project Workbench

## Goal

Provide focused planning and execution views for one project while using the same indexed Markdown entities and domain rules as the portfolio dashboard.

## Relationship to the Streamlined workflow

The Project workbench and [Streamlined long-project workflow](streamlined-long-project-workflow.md) describe one surface, not two. This document owns the persistent view's mechanics: opening and project selection, the perspective list and what each renders, refresh/consistency guarantees, empty/invalid states, and mobile/accessibility behavior. Streamlined long-project workflow owns the workflow model those perspectives present, including the task lifecycle, progressive disclosure, ranked backlog ordering, priority/due filtering, and the backlog/board boundary. Where a perspective below implements part of that workflow, it links to the owning section instead of restating it.

## Opening and context

Open from a project note, portfolio card, command palette, or related entity. If context is ambiguous, show a project picker. The selected project is visible and switching projects updates all perspectives without creating project-specific view files.

## Perspectives

### Backlog

Shows the project's tasks within the backlog/board boundary owned by [Streamlined long-project workflow](streamlined-long-project-workflow.md#ranked-backlog). Group by epic or none; show status, readiness, owner, points, priority, and dependency warnings.

Ordering follows the ranked-backlog rules owned by [Streamlined long-project workflow](streamlined-long-project-workflow.md#ranked-backlog), including rank's interaction with priority. The perspective supports the reorder and rebalance actions specified in [Scheduling and milestones](scheduling-and-milestones.md).

### Current sprint

Tasks assigned to the project's active project sprint or active participating portfolio sprint. Show sprint goal, dates, commitment comparison, and status columns.

### Kanban

Columns map exactly to controlled task statuses. Dragging or keyboard moving a card invokes Change Status and is rejected when domain rules reject the transition. Unknown-status tasks appear in an error lane that cannot be treated as a new status.

### Epics

Group tasks by same-project epic and show progress. Tasks with missing/invalid epic links appear under Needs Repair.

### Ready, blocked, and waiting

Use shared canonical definitions. Blocked shows direct causes; waiting is status-based and separate from dependency blocking.

### Owner

Group non-terminal tasks by exact owner string, with Unowned first. V1 does not infer people identity or merge spelling variants.

### Dependencies

Show a navigable list/tree of same-project edges plus a separate cross-project warning section. The initial v1 display need not be a free-form graph.

### Recently completed

Show terminal tasks ordered by the explicit `completed_at` timestamp specified in [Scheduling and milestones](scheduling-and-milestones.md), never by file modification time. A terminal task with no valid timestamp sorts after those that have one and is labeled as lacking a completion time. The view MUST NOT present modification time as completion time.

### Milestones

Group the project's tasks by milestone and show progress derived from member status counts, plus point totals where available. Progress is informational; achieving a milestone remains explicit. The milestone entity and membership rules are specified in [Scheduling and milestones](scheduling-and-milestones.md).

### Due soon and overdue

Show non-terminal tasks with a due date, separated into overdue and due-today groups using the local-date derivation in [Scheduling and milestones](scheduling-and-milestones.md). Due date never affects readiness, so this perspective is ordering and attention only.

## Planning actions

Create/edit task, change status/owner/sprint, manage dependencies, create next iteration, open epic/origin, and start sprint planning are available according to context. Multi-select MAY support batch planning, subject to safe-write rules.

The workbench also offers a project-status selector, whose controlled values are specified in [Scheduling and milestones](scheduling-and-milestones.md). Priority and due-state filtering are owned by [Streamlined long-project workflow](streamlined-long-project-workflow.md#board).

## Consistency and refresh

All perspectives are projections over one immutable index revision. Filter changes do not write. When a note changes externally, the workbench updates after index publication and preserves the selected project/perspective when still valid.

## Empty and invalid states

- No tasks: offer Create Task.
- Invalid project note: show diagnostics and disable ambiguous writes.
- No active sprint: Current Sprint explains the state and links to planned sprints/backlog.
- Stale last-good snapshot: show a banner and disable operations whose preflight requires current global state.

## Mobile and accessibility

Every drag action has a menu and keyboard equivalent. Horizontal Kanban scrolling preserves readable card width. Controls have visible labels/tooltips, focus is restored after modal actions, and counts are announced with text.

## Acceptance criteria

- A task appears in every perspective implied by its canonical fields and derived state.
- Status changes from Kanban obey the same blocked-work rule as commands/modals.
- No view maintains or persists its own membership arrays.
- Invalid statuses/relations remain visible under repair states.
- External edits and project switches never mix data from different index revisions.
- Core actions are usable on mobile and by keyboard without drag-and-drop.
