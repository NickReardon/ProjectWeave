---
type: decision
id: '0025'
area: documentation
status: accepted
canonical: false
affects: ['0022']
---

# ADR 0025: Name specifications by subject rather than by number

- Status: accepted
- Date: 2026-08-16
- Owners: core

## Context

[ADR 0022](0022-separate-living-specifications-from-point-in-time-decision-records.md)
settled that `docs/spec/` keeps its name and that citations read "Spec NN". That
resolved the double-naming problem — the same documents had been called both
"Design NN" and "specifications" — but it kept the number, and the number was
the part carrying no information.

ADR 0022 also removed the last thing the numbering meant. The specification
index used to say that specifications 15 through 19 postdate 01 through 14 and
refine them, which made the number a weak precedence signal. That paragraph is
gone, and the index now states that numbering "records that order and nothing
else". A number that encodes nothing still costs a lookup: "Spec 15" names no
subject, so a reader resolves it against the index before knowing what was
cited.

[ADR 0024](0024-order-the-roadmap-by-milestone-and-rank.md) reached the same
conclusion one level down, for Epic notes: an identifier that encodes sequence
cannot be validated, and reordering means renaming and rewriting every inbound
link. Specifications have the same shape, minus even the sequence.

One filename had also drifted from the document it held.
`18-project-note-templates.md` has been titled "Vault Note Templates" since
[ADR 0013](0013-resolve-templates-from-a-vault-template-folder.md) moved
templates to a vault library, and nothing forced the two to agree.

## Decision

Name specifications by the subject they own.

- **Filenames are the subject slug:** `task-management.md`,
  `scheduling-and-milestones.md`, `agent-access-and-mcp.md`. No numeric prefix.
- **Citations are the subject:** "the task management spec", or a plain link
  carrying the document's name. "Spec NN" is retired.
- **Headings drop the number:** `# Task Management`, not `# 03 — Task
  Management`.
- **`affects:` in decision records lists slugs**, so
  `affects: ['data-model-and-index', 'scheduling-and-milestones']` reads as
  subjects rather than as a lookup table.
- **The index is not a reading order.** A specification is found by the subject
  it owns.

`related_decisions` and decision-record ids stay numeric. Decision records are an
append-only log where creation order is real and the number is a stable
identifier for a document whose title may be long.

This supersedes the naming bullet in ADR 0022's decision — the one that kept
`docs/spec/` numbered and made citations "Spec NN". Every other part of ADR 0022
stands: specifications are living, decision records are immutable, and each fact
has one owning specification.

## Alternatives considered

- **Keep the number as a stable id, cite by name:** rejected. It is the Epic
  argument from ADR 0024 in a weaker form — nothing references a specification
  by number mechanically, so the id has no consumer and only the lookup cost
  remains.
- **Keep a numeric prefix for directory sort order:** rejected. The sort order
  it produced was the historical writing order, which is exactly the meaning
  ADR 0022 removed. Alphabetical order by subject is more useful for finding a
  document by what it owns.
- **Leave the naming as ADR 0022 set it:** rejected. It resolved the double name
  but kept the uninformative half, and the index now openly says the number
  means nothing.

## Consequences

- Positive: a citation states its subject, so a reader never resolves a number
  against an index to learn what was referenced.
- Positive: `affects:` entries in decision records became readable as subjects.
- Positive: the templates specification's filename and title agree for the first
  time since ADR 0013.
- Negative: 20 files were renamed and roughly 190 references rewritten — 66 link
  paths, 102 prose citations, and 24 `affects:` entries — landing in nearly every
  document in the repository.
- Negative: prose citations became longer, and a mechanical rewrite of that size
  leaves grammatical artifacts that no formatter or linter detects. They were
  swept for by hand.
- Negative: the specification set now has no defined reading order for someone
  meeting it for the first time; the index table is the only entry point.
- Follow-up work: nothing enforces that links resolve or that numeric names stay
  retired, which is tracked as its own task.
