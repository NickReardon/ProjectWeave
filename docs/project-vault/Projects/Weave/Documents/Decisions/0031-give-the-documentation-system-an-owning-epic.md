---
type: decision
id: '0031'
area: documentation
status: accepted
canonical: false
affects: ['0022', '0024']
---

# ADR 0031: Give the documentation system an owning Epic

- Status: accepted
- Date: 2026-08-19
- Owners: core

Once this record is accepted, its body is not edited. A decision that changes
is superseded by a new record; see [`README.md`](README.md).

## Context

Project Weave has rebuilt how it writes about itself. It separated living
specifications from point-in-time records under
[ADR 0022](0022-separate-living-specifications-from-point-in-time-decision-records.md),
named specifications by subject, lifted normative rules out of the decision
log, made the mid-flight record a mid-flight record, gated documentation links
and naming in CI, and gave the work and task model one defining owner.

Six task notes carry that work, and every one of them is `done` with no `epic`
and no `milestone`. The work is finished and attributed nowhere.

That is not a bookkeeping slip. No Epic owns it, and the two that look like
they might do not. [[Epics/Epic-typed-document-catalog]] is about the plugin
recognizing typed documents in a *user's* vault, and
[[Epics/Epic-controlled-documents]] is a document patch engine — both are
product surface. [[Epics/Epic-dogfood-vault-migration]] is scoped to moving
this project's own files and says so.

The project's own rule is that a slice's Epic note is where its progress is
read. A slice with no Epic cannot be read at all: it does not appear on the
roadmap, contributes no progress, and its finished work is invisible to every
view that derives from Epic membership. Project Weave is failing to represent
one of its own slices, which is exactly the dogfooding signal the vault exists
to produce.

## Decision

The documentation system is a slice like any other, and gets an Epic:
[[Epics/Epic-documentation-authority]], at rank 3100 in the v1 milestone.

- **It owns the documentation discipline, not the documents.** Authority over
  what is true stays with the specifications, and the decision log stays
  history. The Epic owns the *work of shaping them*, which is what a task
  note records.
- **The six finished tasks join it.** Attribution for completed work is worth
  correcting, because the Epic is how the slice is read, and a slice that
  reads as empty misreports the project.
- **It ranks at 3100**, immediately before [[Epics/Epic-dogfood-vault-migration]]
  at 3200. Ordering the roadmap by rank within a milestone is
  [ADR 0024](0024-order-the-roadmap-by-milestone-and-rank.md); this places the
  discipline in front of the relocation that applied it, which is the order the
  work actually happened in.
- **It takes the one open loose end** — whether specifications should merge into
  fewer subsystem documents — from the migration Epic. That question is about
  how the documentation is shaped, not about where files live.
- **Its status is `active`, not `completed`.** Every member but that loose end
  is done. Completing an Epic with an unfinished member is a deliberate,
  confirmed act under [Projects and epics](../Specifications/projects-and-epics.md),
  and the loose end is a real open question rather than a formality.

## Alternatives considered

- **Fold the six into [[Epics/Epic-dogfood-vault-migration]]:** rejected. That
  Epic's summary scopes it to relocation, and widening a nearly finished Epic
  to absorb unrelated finished work would make its exit gate mean less, not
  more. Relocation applied the documentation model; it did not decide it.
- **Leave the finished tasks unattributed:** rejected. It treats the Epic as
  bookkeeping over work already in `git log`, but the Epic is the unit the
  roadmap and progress views read. Leaving it empty is a false report, and the
  next documentation task would land with nowhere to go.
- **Fold them into [[Epics/Epic-typed-document-catalog]]:** rejected as a
  category error. That Epic decides what the plugin recognizes in a user's
  vault; these tasks decided how this project writes about itself.
- **Retire the loose end rather than move it:** rejected. It is deliberately
  deferred with a stated revisit condition, which is a decision worth keeping
  visible rather than a task worth deleting.

## Consequences

- Positive: the roadmap gains the slice it was missing, and finished
  documentation work is readable as progress rather than as commit archaeology.
- Positive: the next documentation task has an owner, so the orphaning does not
  recur.
- Negative: an Epic that is created already almost finished, which reads oddly
  on a roadmap and carries no future work beyond one deferred question.
- Negative: the hand-maintained Epic listing on
  [[Projects/Weave/Project]] grows to fifteen rows, and stays hand-maintained
  until [[Tasks/Add Epic roadmap graph fields]] lands.
