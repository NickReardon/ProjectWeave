# Project Weave Specification Index

## Purpose

This directory — `Projects/Weave/Documents/Specifications/` in the dogfood
vault — is the single canonical statement of what Project Weave should do.
These are **living documents**: they are edited in place and always state what
is true now. There is no precedence chain — no document outside this
directory overrides anything inside it, and no document inside it overrides
another.

- The repository [`README.md`](../../../../../../README.md) records what is
  implemented.
- [`../Decisions/`](../Decisions/README.md) records why choices were made. Those
  records are point-in-time and immutable, so they never define current
  behavior.
- [`../../Archive/Legacy/`](../../Archive/Legacy/README.md) records how the
  project got here and is authoritative over nothing.

### One owner per fact

Every fact is defined in exactly one specification. Other documents link to the
owner rather than restating it, because a rule stated twice is a rule that will
disagree with itself.

This is not one document per topic. A topic may span several specifications —
the work and task model touches data model and index, task management, and
scheduling and milestones — as long as each individual fact within it has a
single defining owner.

A specification never asserts precedence over another specification. A
precedence claim means two documents believe they own the same fact, which is a
defect to resolve rather than a ranking to record.

A new product decision updates the owning specification here and ships with a
decision record in the same commit. It never adds another overriding
requirements document.

## Document metadata

Every specification, decision record, and archived document carries frontmatter
so tooling can select the right documents without interpreting prose:

```yaml
type: spec | decision | archive # what kind of document this is
area: tasks # subject, shared across specs and ADRs
status: current | deferred | accepted | proposed | superseded | archived
canonical: true # true only for current specifications
related_decisions: ['0003'] # spec -> ADRs
affects: ['dependencies-and-iterations', 'sprints'] # ADR -> specs
superseded_by: '0031' # superseded decision records only
```

`canonical: true` is the machine-checkable form of this directory's rule: it
appears on current specifications and nowhere else. Selecting current context
for a subject is `type: spec` plus `area:` plus `canonical: true` — no
precedence calculus, and no need to read a governance document first.

`related_decisions` points at history, not at authority. Following it explains
why a rule exists; it never adds a rule. The decision-record lifecycle is
documented in [`../Decisions/README.md`](../Decisions/README.md).

## Conventions

- **MUST**, **MUST NOT**, **SHOULD**, and **MAY** are normative.
- A "note" is a Markdown file in the current vault.
- An "entity" is a canonical project, epic, task, milestone, or sprint note.
- A "proposal" is a complete, validated description of intended file changes created before writing.
- All dates use `YYYY-MM-DD` calendar dates in the user's local timezone.
- Wiki links are persisted as authored where possible and resolved relative to the containing note.

## Product direction

[Product brief](product-brief.md) states the v1 promise: a streamlined,
Markdown-first Obsidian workspace for one substantial, long-lived project, held
by a solo developer or a small team. Everything below serves that brief.

## Feature coverage

| Feature area                                                        | Owning specification                                                      |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Installation, activation, reload, deactivation, upgrade             | [Lifecycle and persistence](lifecycle-and-persistence.md)         |
| Markdown parsing, schemas, link resolution, in-memory index         | [Data model and index](data-model-and-index.md)                   |
| Task creation, editing, status, owner, navigation                   | [Task management](task-management.md)                             |
| Project and epic behavior                                           | [Projects and epics](projects-and-epics.md)                       |
| Dependencies, dependency mode, readiness, cycles, next iteration    | [Dependencies and iterations](dependencies-and-iterations.md)     |
| Optional planning periods, activation, closing                      | [Sprints](sprints.md)                                             |
| Origin links and create-from-heading                                | [Document provenance](document-provenance.md)                     |
| Portfolio dashboard (deferred beyond core v1)                       | [Portfolio dashboard](portfolio-dashboard.md)                     |
| Project workbench and saved perspectives                            | [Project workbench](project-workbench.md)                         |
| Validation, proposals, confirmation, concurrency, failure reporting | [Validation and safe writes](validation-and-safe-writes.md)       |
| Legacy `pm-task` recognition and Tethered migration                 | [Legacy migration](legacy-migration.md)                           |
| Commands, settings, onboarding, accessibility                       | [Plugin experience](plugin-experience.md)                         |
| Automated testing, compatibility, packaging, release gates          | [Quality and release](quality-and-release.md)                     |
| Explicit exclusions and later candidates                            | [Non-goals and future features](non-goals-and-future-features.md) |
| Project lifecycle, rank, priority, due dates, milestones            | [Scheduling and milestones](scheduling-and-milestones.md) |
| Plan, Board, My Work, scale, progressive disclosure                 | [Streamlined long-project workflow](streamlined-long-project-workflow.md) |
| Shared application API, staged agent boundary, agent security       | [Agent access and MCP](agent-access-and-mcp.md)                   |
| Vault note templates shared by UI and agents                        | [Vault note templates](vault-note-templates.md)                 |
| Configurable project note structure, typed documents, and dogfood migration | [Note structure and dogfood vault](note-structure-and-dogfood-vault.md) |

Specifications are named, not numbered, and the table above is not a reading
order. A specification is found by the subject it owns, and nothing about one
document's name gives it standing over another's. Where two documents once
overlapped, the one that does not own the fact now cites the one that does. A
remaining overlap is a defect — see "One owner per fact" above — and is fixed by
assigning the fact to a single owner.

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

## Open questions

These are unresolved inputs, not evidence that implementation has not started.
They are stated here because no specification owns an answer yet; when one is
decided it is written into the owning specification, not left here.

- **Target folder and collision policy for epic, milestone, planning period,
  and document.** [Task management](task-management.md) specifies these
  for tasks and [Projects and epics](projects-and-epics.md) for
  projects. The remaining kinds have no creation path, and each needs a rule
  before it gets one. Template discovery for a kind does not imply the kind is
  creatable.
- **Whether task-edit commands use a modal form, a property editor handoff, or
  both.**

These change implementation mechanics, not the behavior specified here.
