---
type: spec
area: projects
status: current
canonical: true
related_decisions: ["0012"]
---

# Projects and Epics

## Goal

Use existing project notes as the top-level boundary and provide epics as substantial, project-scoped outcomes without duplicating task membership.

## Projects

Project Weave recognizes existing `type: project` notes and does not impose a new mandatory project schema in v1. A project owns tasks and epics that link to it, project sprints that name it, and portfolio sprints that include it.

The plugin MAY offer Create Project if folder and template settings make the target unambiguous. This command creates a minimal note with `type: project` and title. It creates the project's own folder as part of the confirmed creation, as [Plugin experience](plugin-experience.md) permits, and never creates views, sprints, or tasks as side effects.

Project health is derived from linked work and diagnostics. No aggregate task arrays, velocity values, or health status are persisted in the project note by default.

### Project placement

A created project note lands at `<root>/<Title>/Project.md`, where `<root>` is one of the indexed project folders. The folder is the project's identity, and the note that defines it has the fixed name `Project.md` rather than the title — the folder already carries the name, and a project rename then means renaming one thing rather than two.

The folder name derives from the title using the same sanitizer that derives task filenames in [Task management](task-management.md), so one title yields one predictable name across both kinds.

A project note must have its own folder because the task root is derived from the project note's parent. Two project notes sharing a folder would share one `Tasks` folder, and their tasks would mingle with no way to tell them apart by path.

### Project collisions

Collisions are folder-level. An occupied folder is a collision even when it holds no project note, because task creation would otherwise file the new project's tasks inside it. Suffixing follows the task rule — a deterministic ` 2`, ` 3`, … bounded at 100 attempts, compared case-insensitively — and suggesting a free folder is not reserving one; `proposal.target.exists` remains the authoritative block.

Occupied folders are derived from note paths. A folder containing no Markdown is invisible to allocation, so a suggestion can land inside an existing empty folder; the proposal check and the writer both still refuse to overwrite a note.

Root selection is the caller's. Allocation takes the root as an input and validates it; choosing among several configured roots is a UI concern.

A project folder derived from a title does not follow a later title edit. Nothing repairs the path: Markdown in the vault is canonical, and a rename is the user's to make.

## Epic lifecycle

Create Epic requires title, project, and status; owner and origin are optional. Status defaults to `planned`. Epic filename collisions block creation.

Allowed status transitions are user-directed:

- `planned` to `active` or `cancelled`;
- `active` to `completed`, `cancelled`, or `planned`;
- completed/cancelled epics may be reopened explicitly.

Completing or cancelling an epic never modifies member tasks. If unfinished member tasks remain, the UI warns and requires confirmation for the epic status change, but the tasks retain their state and epic link.

## Membership

Task membership is derived exclusively from each task's `epic` link. An epic does not store a task list. The linked epic must belong to the task's project. Cross-project epic membership is invalid and blocks related task mutations until explicitly repaired.

Changing an epic's project is a potentially disruptive operation:

1. Preview every current member task.
2. Require the user to either move compatible tasks with the epic or clear their epic relation.
3. Validate task sprint/dependency implications if tasks move projects.
4. Commit only as an explicit bulk operation.

V1 MAY omit epic project transfer; if omitted, the UI instructs the user to create a new epic and move tasks explicitly.

## Epic view

For one epic, show status, project, owner, origin, task counts by status, points when fully/partially estimated, current-sprint members, backlog members, blocked/waiting tasks, and recently completed tasks. Counts are derived live.

## Project selection and ambiguity

Context may preselect a project when invoked from a project workbench, project note, epic, or sprint. The form still displays the selected project. When multiple interpretations exist, the user must choose; filename similarity is never enough to infer ownership.

## Acceptance criteria

- Existing minimal project notes remain valid and unmodified.
- Epic create/edit preserves Markdown and unknown fields.
- Epic membership always matches task links after full and incremental indexing.
- Cross-project epic links are diagnosed and never silently accepted by commands.
- Completing/cancelling an epic leaves member tasks unchanged and warns about unfinished work.
- Project/epic dashboards derive totals rather than persisting mirrored summaries.
