---
type: spec
area: note-structure
status: current
canonical: true
related_decisions: ["0019"]
---

# Note Structure and Dogfood Vault

## Goal

Give each project a predictable, portable Markdown tree while keeping folder
layout optional, non-destructive, and useful to both the UI and future agents.
Use the Project Weave vault itself to validate the model before applying it to
other vaults.

## Default project tree

When a project creates its first note of a kind, the target folder is created
as part of that explicit confirmed creation. Activation, indexing, settings
changes, and migration discovery never create empty folders.

```text
Projects/<Project>/
├── Project.md
├── Tasks/  Epics/  Milestones/  Planning Periods/
├── Documents/{Design,Decisions,References,Research,Meetings}/
├── Templates/{task,epic,milestone,planning_period,document}/
└── Archive/
```

Projects may override these names through `weave.folders` in `Project.md`.
Overrides are project-relative, normalized, and confined to the project root.
Absolute paths, traversal, empty segments, and collisions with the project note
are invalid. Existing notes outside the configured roots remain indexed, but
receive actionable warnings; settings and configuration changes never move
them automatically.

## Work-note contracts

Projects may opt into `weave.contracts.<kind>` for `task`, `epic`, `milestone`,
and `planning_period`. A contract may whitelist required fields and require
unique level-two headings, matched case-insensitively after whitespace
normalization. Core entity schema, relation, lifecycle, and graph rules always
apply. Contract violations are diagnostics on existing notes and blocking
validation errors for creation or mutation proposals.

The default remains permissive. The packaged structured bodies are:

- task: Summary, Acceptance criteria, Implementation notes, Validation;
- epic: Summary, Governing documents, Exit gate, Progress;
- milestone: Outcome, Success conditions, Included work, Progress, Review;
- planning period: Goal, Dates, Commitment, Outcome.

## Epic roadmap semantics

Epics may carry a positive integer `rank`, same-project `depends_on` links, and
a same-project `milestone`. Only completed prerequisites satisfy an Epic
dependency. Cycles and cross-project targets are errors. `enforced` mode blocks
transition to `active`; `advisory` mode permits it only after acknowledgement.

Roadmap order is **milestone rank, then topological order within the milestone,
then Epic rank, then normalized path**. An Epic's milestone decides when its
work happens; its rank decides its position among that milestone's Epics, not
globally. Duplicate ranks warn and missing ranks sort after ranked peers. Epics
with no milestone sort after those that have one.

An Epic note name is an identifier and carries no sequence. Order is read from
`rank` and `milestone`, never from the filename, so renaming an Epic never
reorders the roadmap. Milestone ordering is specified in
[Scheduling and milestones](scheduling-and-milestones.md).

Epic milestone membership is derived from the Epic link; task milestone
membership remains independently authored and is never inherited.

## Typed documents

Documents remain ordinary Markdown and are never work entities. A typed
document may use:

```yaml
type: document
document_kind: design
title: Example
scope: project
project: "[[Projects/Example/Project]]"
created: 2026-08-09
```

Built-in kinds are `general`, `design`, `decision`, `reference`, `research`,
and `meeting`. Project-defined kinds must be safe lowercase keys with matching
folder and template configuration. Project scope requires one project link;
shared scope may have an optional unique `projects` list. Metadata, section,
and path issues are warnings only. Untyped Markdown receives no document-schema
warnings and remains linkable, searchable, and usable as an origin.

Decisions are project-scoped documents with a project-unique monotonic
`decision_id` such as `DEC-0001`, controlled status (`proposed`, `accepted`,
`superseded`, or `rejected`), and `Context`, `Decision`, and `Consequences`
headings. The legacy `type: design` form is recognized as a deprecated design
alias and receives a migration warning.

The index stores documents in a bounded `DocumentRecord` catalog separate from
`EntityRecord`. Documents have lookup/filtering and origin navigation, but no
readiness, lifecycle, membership, or blocking semantics.

## Migration and acceptance

The dogfood migration is staged: update the canonical contract, normalize the
roadmap, configure and repair work-note contracts, move specifications and ADRs
into typed document folders, move testing/release material into References,
archive obsolete history, and leave short routing pointers at repository entry
points until links are migrated. Each category is checked for links and
diagnostics before its old location is retired.

The slice is accepted when parser/path/graph/document/proposal tests pass,
untyped Markdown is unaffected, the dogfood vault has no unexpected
diagnostics or duplicate canonical documents, compatibility pointers resolve,
manual navigation and warning behavior pass, and `npm run check` passes.

No migration or configuration discovery step writes or moves content. All
content movement is an explicit reviewed operation with complete preflight.
