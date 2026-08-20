---
type: document
document_kind: design
title: Documentation authority and document lifecycle
scope: project
project: '[[Projects/Weave/Project]]'
created: 2026-08-16
---

# Documentation authority and document lifecycle

## Outcome

A reader can answer "what is true?" from the specifications alone, and a writer
changing behavior has exactly one place to change it. The decision log becomes
a history that is added to rather than rewritten.

## Contract

- Specifications in `docs/spec/` are living. They are edited in place, they own
  current behavior, and `canonical: true` marks them.
- Decision records in `docs/decisions/` are point-in-time. Once accepted their
  bodies are not edited; a changed decision is superseded by a new record and
  the old one gains `superseded_by`.
- Decision records hold no authority over current behavior, by construction
  rather than by rank.
- Each fact has one owning specification. A topic may span documents; a fact
  may not.
- No specification asserts precedence over another specification.
- Design documents such as this one are proposals. They describe an intended
  outcome and a delivery sequence, and stop being consulted once the work lands.
- `docs/CURRENT_WORK.md` is the mid-flight record, rewritten rather than
  appended. Verification history and task-state history live in the commit log,
  which cannot drift from the commits it describes.

The rationale, and what was rejected, is recorded in
[[Documents/Decisions/0022-separate-living-specifications-from-point-in-time-decision-records|ADR 0022]].

## Why not the alternatives

Renaming `docs/spec/` to `docs/design/` was considered first and rejected: a
design document conventionally names a point-in-time proposal, so the rename
would have resolved the double name by keeping the misleading half. Ranking
decision records as "tertiary" was also rejected — rank is the wrong axis, and
a low-status but still-editable document remains an attractive home for live
rules, which is how the present inversion formed.

## Delivery sequence

1. [[Tasks/Adopt the living specification and immutable decision model]]
2. [[Tasks/Make current work a mid-flight record]]
3. [[Tasks/Give the work and task model one defining owner]]
4. [[Tasks/Lift normative behavior out of decision records]]
5. [[Tasks/Name specifications by subject]]

Steps 1 and 4 are mechanical. Step 2 resolves an ownership conflict and step 3
moves roughly 500 lines of behavior between documents; both are text relocation
and neither may change meaning silently.

## Effect on planned work

Epic 12 planned to move specifications into `Documents/Design`. Under this
contract specifications are living documents and design documents are
proposals, so that move needs revisiting before Epic 12 runs. The task
[[Tasks/Move canonical docs into typed folders]] carries the correction.
