# Project Weave Implementation Plan

## 1. Product direction

Build Project Weave as a standalone, Markdown-first Obsidian plugin for
managing multiple projects while connecting execution work to its originating
documentation.

The first release targets one person's vault while preserving a path toward
small-team use and eventual publication as a community plugin. It provides
lightweight agile planning rather than claiming complete Scrum compliance.

## 2. Repository and installation architecture

Project Weave lives in this dedicated repository. It will contain the
TypeScript source, automated tests, fixture vault, build configuration,
documentation, and release artifacts.

The user's Obsidian vault remains a separate repository containing project
data, vault schemas, views, and migration history. Only built release files
will be installed into `.obsidian/plugins/project-weave/`:

```text
main.js
manifest.json
styles.css
```

Development and automated testing must use a fixture vault. Installation into
the real vault happens only after the fixture suite passes. Vault schema and
Tethered migration work remains isolated on the vault's
`convert/project-manager-to-vault-agile` branch.

## 3. Non-destructive lifecycle contract

Lifecycle safety is a hard product requirement.

Installation may add only Project Weave's release files. First activation may
create plugin-owned settings or disposable cache data, but must not create,
rewrite, move, rename, migrate, repair, or delete content notes or generated
views. Activation builds an in-memory index and may display optional
onboarding.

Deactivation only unregisters commands, views, processors, events, and timers
and releases in-memory state. It must never modify content, reverse a
migration, remove manifests or views, change task state, or clean up data.
Uninstalling the plugin leaves all project information as readable Markdown.

Every content write must be triggered by a named command or direct UI action.
Bulk changes and migrations must preview the exact files affected, validate
the complete proposal before writing, require confirmation, and report partial
failures precisely. Destructive cleanup commands are excluded from v1.

Automated lifecycle tests will hash fixture-vault content before and after
install, activation, reload, deactivation, reactivation, and upgrade. These
operations pass only when content remains byte-for-byte unchanged unless the
test explicitly invokes a write command.

## 4. Markdown data model

Each entity is one canonical Markdown note. Plugin settings and caches are
never the canonical task database. All frontmatter keys use `snake_case` and
relations use Obsidian wiki links.

### Project

Retain the vault's existing `type: project` model. A project owns its epics,
project sprints, tasks, and project views.

### Epic

An epic is a substantial outcome that may span multiple sprints. It belongs to
exactly one project and has `planned`, `active`, `completed`, or `cancelled`
status. Task membership is derived from task notes rather than stored as a
mirrored task list.

```yaml
type: epic
title: Travel System
project: "[[Tethered]]"
status: active
owner: Alice
origin: "[[Level Transition and Travel]]"
created: 2026-08-02
```

### Task

Each task is a separate Markdown note and belongs to exactly one project.

```yaml
type: task
title: Implement travel request
project: "[[Tethered]]"
status: todo
epic: "[[Travel System]]"
sprint: "[[Vertical Slice Sprint 1]]"
points: 3
owner: Alice
depends_on:
  - "[[Define travel request]]"
iteration_of: "[[Travel Request Iteration 1]]"
iteration: 2
origin: "[[Level Transition and Travel#Requirements]]"
priority: high
created: 2026-08-02
```

Task statuses are `todo`, `in-progress`, `waiting`, `review`, `done`, and
`cancelled`. `waiting` represents an external person, answer, or event.
Dependency blocking is derived and never stored as a competing status.

A task may have one optional epic from the same project, one current sprint,
one optional owner name, optional positive integer points, and an `origin`
link to a source note or exact heading. A backlog task has no current sprint.

### Sprint

Support both project and portfolio sprints.

A project sprint names exactly one project. A portfolio sprint names a list of
participating projects. Sprint statuses are `planned`, `active`, `completed`,
and `cancelled`.

```yaml
type: sprint
title: Vertical Slice Sprint 1
scope: project
project: "[[Tethered]]"
status: active
goal: Complete the first playable travel loop
start_date: 2026-08-03
end_date: 2026-08-16
```

```yaml
type: sprint
title: August Portfolio Sprint
scope: portfolio
projects:
  - "[[Tethered]]"
  - "[[Project Weave]]"
status: planned
goal: Produce usable increments for both projects
start_date: 2026-08-03
end_date: 2026-08-16
```

A project cannot participate in overlapping active project and portfolio
sprints. Activating a sprint records aggregate task and point commitments.
Closing a sprint requires every unfinished task to be returned to backlog,
carried into another sprint, or cancelled. Previous assignments and outcomes
are retained in `sprint_history`.

## 5. Dependencies and iteration

An unfinished same-project `depends_on` relation blocks readiness. `done`
satisfies a dependency; `cancelled` does not automatically satisfy it.
Project Weave rejects self-dependencies and same-project cycles, prevents
starting blocked work through its UI, and derives downstream dependents.

Cross-project dependencies are permitted but warning-only. They do not gate
readiness, appear prominently in project and portfolio health views, and
produce warnings rather than hard rejection when they form cross-project
cycles.

The `Create next iteration` command creates a new task, retains the iteration
root, increments the iteration number, and adds the previous iteration as a
dependency. It carries the project and epic by default while leaving sprint
and owner selection explicit. Previous and next relationships are derived
rather than stored twice.

## 6. Document provenance

Tasks and epics may link to an originating note or heading through `origin`.
The `Create task from current heading` command prepopulates this relationship.
Reverse relationships are derived in the UI; Project Weave never inserts or
maintains duplicated task lists inside the source document.

Design-document manifests, continuous document rendering, folder/tag
compilation, heading extraction, assembled document ordering, and document
export are deferred beyond v1. Existing Obsidian folders, headings, tags, and
wiki links remain the design-organization mechanism in the initial release.

## 7. Views and workflows

### Portfolio dashboard

Show active and planned projects, current sprint goals, ready and overdue
work, waiting tasks, same-project blockers, cross-project dependency warnings,
unowned work, and project health warnings.

### Project workbench

Provide backlog, current sprint, Kanban, epic, ready, blocked, waiting, owner,
dependency, and recently completed views. Views query notes directly and never
maintain task ID arrays.

### Sprint planning

Support backlog selection, optional point totals, sprint goals and dates,
dependency warnings, explicit activation, and guided closing. Review and
retrospective content remains ordinary Markdown in the sprint note.

### Task commands

Provide commands to create and edit tasks, create a task from a note or
heading, manage dependencies, create a next iteration, change sprint or
status, set or clear the owner, and navigate to related project, epic, sprint,
origin, dependencies, and dependents.

## 8. Validation and failure handling

Validation covers unknown or missing fields, controlled values, paths,
project/epic/sprint relationships, broken dependencies and origins, invalid
points or dates, duplicate identity, same-project dependency cycles, sprint
overlap, and invalid cross-project membership.

Validation reports actionable errors and never silently repairs source notes.
Bulk operations stop before writing when preflight fails. If a runtime failure
interrupts a multi-file operation, Project Weave reports exactly which files
were written and which were not.

## 9. Tethered migration

Migration proceeds incrementally in the vault repository. During transition,
Project Weave may recognize legacy `pm-task` notes as read-only records; only
migrated `type: task` notes are mutable through the new plugin.

For each batch:

1. Select a small, related set of Tethered tasks.
2. Preview all field mappings and ID-to-wikilink dependency resolution.
3. Require every referenced legacy ID to resolve.
4. Convert selected notes in place without creating duplicates.
5. Preserve bodies, acceptance criteria, URLs, dates, priority, and meaningful
   metadata.
6. Validate counts, statuses, links, and dependency edges.
7. Test the batch in Obsidian.
8. Commit the accepted batch before selecting the next.

Legacy `blocked` tasks require an explicit decision: convert to `waiting` for
an external condition, convert to `todo` with dependency-derived readiness, or
leave unresolved and fail the preview.

After all 126 tasks reconcile, compare counts and status distribution, verify
all dependency edges and note bodies, retire the legacy board representation,
and disable Project Manager. Do not delete the old plugin or migration evidence
until the new workflow has been accepted.

## 10. Test strategy

Unit tests cover schemas, parsing, dependency readiness, cycle handling,
iteration generation, owner filtering, sprint membership and overlap, sprint
closing, and rollover history.

The fixture vault contains multiple projects, independent project sprints, a
portfolio sprint, cross-project dependencies, epics spanning sprints,
iteration chains, broken links, and manually edited inconsistent states.

Integration and manual testing covers desktop and mobile rendering, themes,
pop-out windows, external changes, Obsidian link renames, different task notes
edited concurrently, and explicit same-note conflict behavior.

## 11. Later iterations

After v1 proves the workflow:

- Migrate `owner` to an `owners` list.
- Add Any/All member filters and team workload views.
- Optionally support hard cross-project blockers.
- Add design-document manifests and continuous assembled reading.
- Add folder/tag-assisted document compilation and export.
- Consider recurring tasks, calendars, Gantt views, and time tracking only in
  response to demonstrated needs.
- Generalize schemas, paths, onboarding, and documentation for community
  publication.
