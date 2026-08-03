# Project Weave Feature Design Index

## Purpose

This directory contains the detailed implementation contracts for Project
Weave v1. [`../../CURRENT-DESIGN.md`](../../CURRENT-DESIGN.md) defines the
authoritative reading order and precedence among the original plan, later
addenda, and these designs. These documents define behavior, boundaries, edge
cases, and acceptance criteria only to the extent that later contracts have
not superseded or deferred them.

## Conventions

- **MUST**, **MUST NOT**, **SHOULD**, and **MAY** are normative.
- A "note" is a Markdown file in the current vault.
- An "entity" is a canonical project, epic, task, or sprint note.
- A "proposal" is a complete, validated description of intended file changes created before writing.
- All dates use `YYYY-MM-DD` calendar dates in the user's local timezone.
- Wiki links are persisted as authored where possible and resolved relative to the containing note.

## Feature coverage

| Feature area                                                        | Owning design                                                             |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Installation, activation, reload, deactivation, upgrade             | [01 — Lifecycle and persistence](01-lifecycle-and-persistence.md)         |
| Markdown parsing, schemas, link resolution, in-memory index         | [02 — Data model and index](02-data-model-and-index.md)                   |
| Task creation, editing, status, owner, navigation                   | [03 — Task management](03-task-management.md)                             |
| Project and epic behavior                                           | [04 — Projects and epics](04-projects-and-epics.md)                       |
| Dependencies, readiness, cycles, next iteration                     | [05 — Dependencies and iterations](05-dependencies-and-iterations.md)     |
| Project and portfolio sprint planning, activation, closing          | [06 — Sprints](06-sprints.md)                                             |
| Origin links and create-from-heading                                | [07 — Document provenance](07-document-provenance.md)                     |
| Portfolio dashboard                                                 | [08 — Portfolio dashboard](08-portfolio-dashboard.md)                     |
| Project workbench and saved perspectives                            | [09 — Project workbench](09-project-workbench.md)                         |
| Validation, proposals, confirmation, concurrency, failure reporting | [10 — Validation and safe writes](10-validation-and-safe-writes.md)       |
| Legacy `pm-task` recognition and Tethered migration                 | [11 — Legacy migration](11-legacy-migration.md)                           |
| Commands, settings, onboarding, accessibility                       | [12 — Plugin experience](12-plugin-experience.md)                         |
| Automated testing, compatibility, packaging, release gates          | [13 — Quality and release](13-quality-and-release.md)                     |
| Explicit exclusions and later candidates                            | [14 — Non-goals and future features](14-non-goals-and-future-features.md) |

## Global invariants

1. Markdown is canonical; settings and indexes cannot contain unrecoverable project state.
2. Passive lifecycle operations never change content.
3. One entity note represents one entity; relationships are not mirrored into arrays when they can be derived.
4. A task belongs to exactly one project.
5. Hard dependency blocking applies only within the same project in v1.
6. A project cannot be in overlapping active project and portfolio sprints.
7. Every multi-file write is preflighted in full and reports exact outcomes.
8. Invalid notes remain visible in diagnostics and are never silently repaired.

## Remaining design decisions

These are unresolved design inputs, not evidence that implementation has not
started. Recheck the current work handoff and nearby ADRs before resolving
them.

- Exact folder defaults and filename collision policy.
- Whether task-edit commands use a modal form, property editor handoff, or both.

These decisions change implementation mechanics, not the behavior specified here.
