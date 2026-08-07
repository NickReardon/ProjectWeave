---
type: spec
area: projects
status: current
canonical: true
related_decisions: ["0012"]
---

# 04 — Projects and Epics

## Goal

Use existing project notes as the top-level boundary and provide epics as substantial, project-scoped outcomes without duplicating task membership.

## Projects

Project Weave recognizes existing `type: project` notes and does not impose a new mandatory project schema in v1. A project owns tasks and epics that link to it, project sprints that name it, and portfolio sprints that include it.

The plugin MAY offer Create Project if folder and template settings make the target unambiguous. This command creates a minimal note with `type: project` and title; it never creates folders, views, sprints, or tasks as side effects.

Project health is derived from linked work and diagnostics. No aggregate task arrays, velocity values, or health status are persisted in the project note by default.

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
