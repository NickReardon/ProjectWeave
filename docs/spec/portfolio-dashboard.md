---
type: spec
area: portfolio
status: deferred
canonical: true
related_decisions: ["0002"]
---

# Portfolio Dashboard

## Goal

Give one person a fast, cross-project view of current goals, actionable work, risk, and data quality without maintaining a separate dashboard note.

## Entry and state

Open Portfolio Dashboard from a command or ribbon action. One workspace view instance is reused by default; users MAY open additional leaves. UI preferences such as collapsed sections and sort choice may persist in plugin settings, but dashboard data always comes from the current index snapshot.

## Sections

### Projects and sprint goals

Show active/planned project notes, active sprint participation, sprint goal/date range, task progress, and point progress when points exist. A project without an active sprint appears as backlog-only, not unhealthy by default.

### Ready and overdue work

Ready uses the canonical readiness definition. Task due dates and the derivation of due/overdue state are specified in [Scheduling and milestones](scheduling-and-milestones.md); the dashboard shows Due Today and Overdue Tasks from that derivation, using the local calendar date and never substituting a sprint end date for a task due date.

Sprint-end risk is a separate label. Tasks in an active sprint after its `end_date` are shown as sprint overdue whether or not they carry a due date.

### Milestones

Show Upcoming Milestones and Overdue Milestones for the projects in scope. The milestone entity, its statuses, and overdue derivation are specified in [Scheduling and milestones](scheduling-and-milestones.md). Milestone progress shown here is informational; achieving a milestone remains an explicit action.

### Waiting and blocked

Waiting lists tasks with `status: waiting`. Blocked lists hard same-project blockers and their direct causes. A task may appear in only its most actionable primary section, with badges for secondary conditions.

### Cross-project warnings

Show unresolved cross-project dependencies grouped by downstream project, including upstream status and target project. These warnings do not change ready counts.

### Ownership and health

Unowned work includes non-terminal active-sprint tasks without an owner. Health warnings include invalid entities, active sprint overlap, broken links, cycles, sprint membership errors, and stale sprint dates. Warnings are factual; v1 does not compute a synthetic red/amber/green score.

## Filtering and sorting

Filter by project, active/planned status, owner, sprint participation, and warning type. Archived projects are hidden by default and revealed by an explicit Include Archived filter. Default task sorting is actionable severity, priority if present, then title/path for stability. All filters run against one index revision.

## Actions

Cards open their canonical note. Context actions invoke application commands for status, owner, sprint, dependency navigation, or workbench opening. The dashboard itself never edits files.

## Empty/loading/error states

- During first index: show progress and keep write commands disabled.
- No projects: explain required `type: project` frontmatter and offer Create Project only when configured.
- No actionable work: show a concise healthy empty state, not a warning.
- Index error: retain the last complete snapshot with a stale banner and Retry Index.

## Mobile and accessibility

Sections collapse into a single column on narrow screens. Every card action is available without hover or drag. Status and warning meaning uses text/icon labels, not color alone. Keyboard focus order follows visual order, and updates announce concise summaries through an accessible live region.

## Acceptance criteria

- Every metric can be reproduced from the same index snapshot.
- Cross-project warnings never reduce same-project ready counts.
- Waiting, blocked, and unowned definitions are consistent with other views.
- No task due-date behavior exists until a due-date schema is explicitly approved.
- All navigation and mutations route through canonical notes/application commands.
- Dashboard works without hover, drag, or desktop-only APIs.
