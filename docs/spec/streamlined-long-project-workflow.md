---
type: spec
area: workflow
status: current
canonical: true
related_decisions: ["0002", "0026"]
---

# Streamlined Long-Project Workflow

## Scope

This document implements the direction in [the product brief](product-brief.md) for the primary workspace: Plan, Board, and My Work.

## Goal

Let a solo developer or small team carry one large project from evolving Markdown design through ordered execution while requiring only the project-management concepts they choose to use.

## Relationship to the Project workbench

This document and the [Project workbench](project-workbench.md) describe one surface, not two: the workbench is the persistent Obsidian view (established in [ADR 0007](../decisions/0007-use-a-persistent-obsidian-workbench-view.md)) that presents the Plan, Board, and My Work destinations specified below. This document owns the workflow model: the task lifecycle, progressive disclosure, ranked backlog ordering, priority/due filtering, and the backlog/board boundary. Project workbench owns the view mechanics that render it — opening, perspective consistency/refresh, empty states, and mobile/accessibility.

## Core mental model

```text
Project
  Design notes ──origin──> Tasks
  Epics (optional) ──────> Tasks
  Milestones (optional) ─> Tasks
  Planning periods (optional) ─> Tasks

Task flow
  backlog -> todo -> in-progress -> done
                  \-> waiting / review (when used)
                  \-> cancelled

Task order
  dependencies determine what must happen first
  rank determines preference among otherwise available work
```

Every operational view is scoped to one project. Terminal notes remain readable/searchable Markdown and are hidden from focus views by default.

## Minimum data and compatibility

The minimum task is:

```yaml
type: task
project: "[[Project]]"
status: backlog
```

The filename supplies title when `title` is missing. The canonical task statuses are enumerated in [Data model and index](data-model-and-index.md).

Existing `todo` tasks are board tasks; no migration is needed. Existing projects without Project Weave configuration use the minimal default workflow. Missing optional fields never cause passive writes.

## Progressive disclosure

### Always visible

- Task title
- Status/backlog-to-board action
- Project context
- Rank/reorder control in planning views
- Dependency summary when dependencies exist
- Origin when created from a design

### Revealed when used or requested

- Epic and milestone
- Planning period
- Estimate/points
- Owner and My Work
- Priority and due date
- Iteration chain
- Waiting/review columns
- Advanced validation/policy controls

Task forms place these fields under More Options until the project contains such data or the user pins them. Hiding a control never removes its existing Markdown value.

## Optional project policies

A project MAY share lightweight policy choices in its project note:

```yaml
weave:
  dependency_mode: advisory
  planning_period_label: cycle
  estimation: points
  policies:
    owner_required_on_board: false
    estimate_required_in_period: false
    wip_limits: {}
```

The whole block is optional. Defaults are:

- `dependency_mode: advisory`;
- planning-period display label `sprint`;
- estimation off until points exist or the user enables it;
- no required owner or estimate;
- no WIP limits.

Supported planning-period labels are `sprint`, `cycle`, and `period`. This changes UI wording only; the existing canonical `type: sprint` and task `sprint` link remain stable.

Supported v1 estimation is optional positive-integer `points`. Points can be used without planning periods. Missing points never make a task invalid. When `estimate_required_in_period` is true, assignment/activation warns or blocks according to the confirmation policy chosen by the project; it still does not backfill a value.

## Enforcement boundary

### Always enforced by Project Weave writes

- Supported fields have valid shapes/controlled values when present.
- Task, epic, milestone, and planning-period project relations are consistent.
- A dependency target is a task.
- The UI cannot create a self-dependency or same-project cycle.
- A reviewed proposal cannot overwrite an externally changed note.
- Passive lifecycle/index/view actions write nothing.

### Enforced only when enabled

- Preventing an unfinished dependent task from starting (`dependency_mode: enforced`).
- Owner required on board work.
- Estimate required in a planning period.
- WIP limits.

In advisory dependency mode, moving a blocked task to `in-progress` shows its blockers and asks for acknowledgement but does not reject the transition. Cross-project dependencies are always advisory in v1.

## Project workspace

The primary workspace has three top-level destinations: Plan, Board, and My Work. Optional Epic, Milestone, and Planning Period views are reachable from filters/details rather than crowding primary navigation.

The selected project is always visible. Switching project replaces the entire view snapshot; data from multiple projects is never mixed in a work list.

## Plan view

Plan combines design-to-task work, the ranked backlog, and order-of-operations visibility.

### From a design note

Open Plan From Current Design. The view shows the current note outline and all tasks/epics whose `origin` points to the note or one of its headings.

The user can:

- create one task from the current heading;
- select several headings and Create Task Drafts From Outline;
- add extra task drafts not tied one-to-one to headings;
- edit titles and optional fields before creation;
- drag drafts into preferred rank order;
- choose dependencies between drafts or existing tasks;
- open/edit/unlink existing related tasks.

Outline extraction proposes heading text as editable task titles; it does not attempt AI interpretation. Confirming creates task notes with origin links but never changes the design note.

If the design later changes, the same view shows current related tasks for human review. Project Weave reports broken note/heading origins but does not automatically regenerate, rename, close, or rewrite tasks.

### Draft proposal

The multi-task draft is a single bulk proposal. Before confirmation it shows every target path, status, rank, origin, dependency, and optional field. It validates all proposed dependencies as one graph. Filename collisions or cycles prevent every write.

New design-derived tasks default to `backlog`. A visible Create Directly On Board choice may set selected drafts to `todo`.

### Ranked backlog

Backlog shows `status: backlog` tasks, grouped optionally by epic or milestone. Rank is primary. Missing/duplicate ranks remain deterministic and are repairable through explicit reorder/rebalance actions.

Add to Board changes selected valid backlog tasks to `todo`. It does not require a planning period, estimate, owner, due date, epic, or milestone unless an enabled project policy says otherwise.

## Order of Operations

This view answers what can happen now and what it unlocks.

### Ready Now

Shows non-terminal tasks in the selected scope with all same-project prerequisites satisfied. Board Ready Now defaults to `todo`; Plan Ready Now may include backlog tasks in a visually separate Future Work group.

Within one readiness level, sort by manual rank, then priority, then normalized path. Priority never overrides an explicit lower rank in the Ranked Backlog.

### Dependency sequence

Render a list/tree by default rather than requiring a large free-form graph:

- task;
- direct `blocked by` tasks;
- direct `unlocks` tasks;
- readiness state;
- optional collapsed transitive chain.

A Sequence perspective computes topological levels within the selected project. It is a derived planning aid, not a stored schedule or promise. Cross-project edges appear in an External section and do not alter levels.

### Editing order

The user can reorder independent work by rank and model true prerequisites with dependencies. The UI explains this distinction and never creates dependencies merely because one ranked task precedes another.

## Board

The default board contains `todo`, `in-progress`, and `done`. Backlog has its own planning view. `waiting` and `review` columns appear when the project enables them or tasks already use them. Cancelled tasks are hidden behind a filter.

- A task created from the Board defaults to `todo`.
- Done shows a bounded recent window with View History for older work.
- Board filters include epic, milestone, planning period, owner, priority, due state, and text.
- Drag, keyboard, and menu moves all invoke the same status command.
- Advisory blockers are visible on cards; enforced blockers prevent a start.
- Planning-period filtering is optional and never determines whether a task can appear on the board.

## My Work

Each plugin installation MAY configure `my_owner_name` locally. This preference does not rewrite project notes or create a team account.

My Work is project-scoped and shows:

- Ready for Me;
- In Progress;
- Waiting/Review;
- Blocked, with direct causes;
- Due Today/Overdue;
- optionally Unowned work.

Owner suggestions derive from exact existing owner strings. V1 does not require a roster or merge aliases. A solo developer can leave owner tracking unused; My Work then offers Use All Project Work.

## Optional planning periods and estimates

Planning periods remain useful for a long project but are overlays, not the foundation of the board.

- A project can create a sprint/cycle/period with goal and dates.
- Tasks can be assigned from backlog or board.
- Activation and closing retain the safe commitment/history behavior already designed.
- The UI uses the configured label consistently.
- No period is required to start or complete work.
- Estimates are optional points; totals always show estimated task count and unestimated count so partial totals are not misleading.
- Missing estimates produce no warning unless the project explicitly enables an estimate policy for period planning.

Portfolio-scoped planning periods are deferred beyond the core v1 even though their prior design is retained for later evaluation.

## Long-project organization and history

- Epics group large systems/outcomes and can span milestones and periods.
- Milestones represent dated results such as prototype, vertical slice, demo, alpha, or release.
- Existing Obsidian tags/links may represent discipline, subsystem, or content area without a required new entity.
- Terminal tasks remain canonical notes and participate in dependency satisfaction/history.
- Operational views exclude old terminal work by default; search and View History can retrieve it.
- Reopening uses completion/achievement history rather than erasing prior outcomes.
- No passive archive process moves, renames, or rewrites notes.

## Scale and performance design

The implementation MUST assume thousands of task notes and years of history:

- initial indexing is asynchronous and publishes one complete revision;
- one-note events trigger targeted parsing and affected-graph recomputation rather than unconditional full-vault rebuilds;
- a full rebuild remains an explicit correctness fallback;
- filtered queries run against indexed fields and reverse relations;
- task lists/boards use virtualized or paged rendering instead of one DOM node tree for every result;
- views request bounded recent history until the user expands it;
- sorting is deterministic and does not persist derived order;
- test fixtures include at least 10,000 tasks plus design, epic, milestone, and planning-period notes.

No fixed timing promise is set until a reference environment is recorded, but CI records full-index, incremental-update, query, and render benchmark trends to catch regressions.

## Multi-project acknowledgment

The vault index may contain multiple projects. A lightweight home/project picker can show title, lifecycle status, and simple counts. V1 execution views always select exactly one project.

Supported cross-project behavior is limited to navigation and advisory dependency warnings. Portfolio boards, portfolio planning periods, combined workload, aggregate health, hard cross-project blockers, and global sequencing are deferred.

## Commands

### Core

- Open Project Workspace
- Open Plan From Current Design
- Create Task
- Create Task From Current Heading
- Create Task Drafts From Outline
- Edit Task
- Add to Board
- Return to Backlog
- Reorder Task
- Add or Remove Dependency
- Open Ready Now
- Open My Work
- Navigate to Origin, Blockers, or Unlocked Work

### Optional/contextual

- Set Owner, Epic, Milestone, Priority, Due Date, Estimate, or Planning Period
- Create/Edit Epic or Milestone
- Create/Plan/Activate/Close Planning Period
- Create Next Iteration
- Configure Project Workflow

## Acceptance criteria

- A project with no `weave` configuration supports design-to-task, backlog, board, dependency visibility, and completion.
- Creating tasks from an outline changes no source-document bytes.
- Users can edit proposed titles/order/dependencies before a multi-task write.
- Backlog tasks do not flood the active board; Add to Board requires no sprint/cycle/period.
- Rank plus dependencies gives a deterministic, understandable order without conflating preference and prerequisite.
- Advisory and enforced dependency modes behave distinctly and consistently.
- Owners, estimates, due dates, epics, milestones, and planning periods generate no missing-field warnings when unused.
- The UI consistently uses the selected planning-period label while Markdown schema remains stable.
- Partial estimate totals identify estimated and unestimated task counts.
- My Work functions for a configured member and degrades cleanly for a solo project without owners.
- Portfolio features are not required to index, switch, or navigate among projects.
- A 10,000-task fixture does not render all tasks simultaneously or require a full-vault reparse after one ordinary task edit.
