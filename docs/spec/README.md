# Project Weave Specification Index

## Purpose

This directory is the single canonical statement of what Project Weave should
do. There is no precedence chain: no document outside this directory overrides
anything inside it. When a specification and an older planning document
disagree, the specification wins and the planning document is history.

- [`../../README.md`](../../README.md) records what is implemented.
- [`../decisions/`](../decisions) records why choices were made.
- [`../archive/`](../archive/README.md) records how the project got here and is
  authoritative over nothing.

A new product decision updates the owning specification here. If the rationale
is worth preserving, it also gets an ADR. It never adds another overriding
requirements document.

## Conventions

- **MUST**, **MUST NOT**, **SHOULD**, and **MAY** are normative.
- A "note" is a Markdown file in the current vault.
- An "entity" is a canonical project, epic, task, milestone, or sprint note.
- A "proposal" is a complete, validated description of intended file changes created before writing.
- All dates use `YYYY-MM-DD` calendar dates in the user's local timezone.
- Wiki links are persisted as authored where possible and resolved relative to the containing note.

## Product direction

[00 — Product brief](00-product-brief.md) states the v1 promise: a streamlined,
Markdown-first Obsidian workspace for one substantial, long-lived project, held
by a solo developer or a small team. Everything below serves that brief.

## Feature coverage

| Feature area                                                        | Owning specification                                                      |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Installation, activation, reload, deactivation, upgrade             | [01 — Lifecycle and persistence](01-lifecycle-and-persistence.md)         |
| Markdown parsing, schemas, link resolution, in-memory index         | [02 — Data model and index](02-data-model-and-index.md)                   |
| Task creation, editing, status, owner, navigation                   | [03 — Task management](03-task-management.md)                             |
| Project and epic behavior                                           | [04 — Projects and epics](04-projects-and-epics.md)                       |
| Dependencies, dependency mode, readiness, cycles, next iteration    | [05 — Dependencies and iterations](05-dependencies-and-iterations.md)     |
| Optional planning periods, activation, closing                      | [06 — Sprints](06-sprints.md)                                             |
| Origin links and create-from-heading                                | [07 — Document provenance](07-document-provenance.md)                     |
| Portfolio dashboard (deferred beyond core v1)                       | [08 — Portfolio dashboard](08-portfolio-dashboard.md)                     |
| Project workbench and saved perspectives                            | [09 — Project workbench](09-project-workbench.md)                         |
| Validation, proposals, confirmation, concurrency, failure reporting | [10 — Validation and safe writes](10-validation-and-safe-writes.md)       |
| Legacy `pm-task` recognition and Tethered migration                 | [11 — Legacy migration](11-legacy-migration.md)                           |
| Commands, settings, onboarding, accessibility                       | [12 — Plugin experience](12-plugin-experience.md)                         |
| Automated testing, compatibility, packaging, release gates          | [13 — Quality and release](13-quality-and-release.md)                     |
| Explicit exclusions and later candidates                            | [14 — Non-goals and future features](14-non-goals-and-future-features.md) |
| Project lifecycle, rank, priority, due dates, milestones            | [15 — Scheduling and milestones](15-scheduling-and-milestones.md)         |
| Plan, Board, My Work, scale, progressive disclosure                 | [16 — Streamlined long-project workflow](16-streamlined-long-project-workflow.md) |
| Shared application API and the staged agent boundary                | [17 — Agent access and MCP](17-agent-access-and-mcp.md)                   |
| Agent security profile                                              | [17a — Agent access security profile](17a-agent-access-security-profile.md) |
| Project-owned note templates shared by UI and agents                | [18 — Project note templates](18-project-note-templates.md)               |

Specifications 15 through 18 postdate 01 through 14 and refine them. Where they
overlap, the higher-numbered document is the one that was written against the
current product direction; the earlier documents have been updated to agree
rather than left to be reconciled by the reader.

## Core v1 slice

```text
write or revise a Markdown design
  -> create/edit linked task drafts
  -> rank tasks and declare prerequisites
  -> keep future work in backlog
  -> add selected tasks to the board
  -> use Ready Now / My Work
  -> complete, reopen, and preserve history
```

Epics, milestones/releases, planning periods (Sprint/Cycle/Period), point
estimates, owners, priorities, and due dates are optional. Same-project
dependencies are optional but enforced by default once declared. Multi-project
recognition and switching are supported; portfolio planning is deferred.

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

- Exact folder defaults and filename collision policy for the kinds that have
  no creation path yet — epic, milestone, planning period, and document. ADR
  0008 settles them for tasks and ADR 0012 for projects; ADR 0013 proposes
  where templates themselves live.
- Whether task-edit commands use a modal form, property editor handoff, or both.

These decisions change implementation mechanics, not the behavior specified here.
