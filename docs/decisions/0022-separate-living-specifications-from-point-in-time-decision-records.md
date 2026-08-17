---
type: decision
id: '0022'
area: documentation
status: accepted
canonical: false
affects: ['note-structure-and-dogfood-vault']
---

# ADR 0022: Separate living specifications from point-in-time decision records

- Status: accepted
- Date: 2026-08-16
- Owners: core

## Context

`docs/spec/` is described as the single canonical statement of intended
behavior and `docs/decisions/` as the record of why choices were made. Four
things contradict that description in practice.

**One thing carries two names.** Every reference to a specification outside the
directory calls it "Design NN" — `README.md`, the vault Epic notes, the ADRs,
`docs/archive/`, and roughly ten source comments in `src/domain/templates/` and
`src/application/`. Only the folder, the `type: spec` frontmatter, and the
routing tables say "specification". A reader holds two names for one artifact,
and the name they meet in the code is the one the governance documents avoid.

**Decision records carry normative behavior.** ADR 0013 runs to roughly 410
lines under headings such as "Detection and validation", "Straightforward
creation UI", "Failure behavior", and "Reader and lifecycle boundaries". ADRs
0008, 0012, and 0018 do smaller versions of the same thing. `docs/spec/README.md`
completes the inversion by deferring downward: it records that folder defaults
and the filename collision policy are settled by ADRs 0008 and 0012 and
proposed by 0013. The canonical index sends readers to a decision record to
learn what is true.

**Authority is split inside the canonical set.** The task model is defined in at
least three places: the Task schema in the Data model and index spec, status transitions and
planning fields in the Task management spec, and five further sections in the Scheduling and milestones spec covering
priority, backlog rank, due dates, completion timestamps, and milestone
membership. The scheduling and milestones spec opens with a "Status and precedence" section asserting
precedence over its peers, and carries "Portfolio dashboard" and "Project
workbench" subsections belonging to the Portfolio dashboard spec and the Project workbench spec. The task status
vocabulary appears in fourteen of the twenty documents.

**Decision records have no stated lifecycle.** Nothing says whether an accepted
ADR may be edited later. In the absence of a rule they have been treated as
mutable, which is what allowed them to accumulate behavior: an ADR that can be
updated becomes a convenient place to keep a rule current.

## Decision

Separate the two kinds of document by **lifecycle** rather than by rank, and let
the lifecycle carry the authority rule.

- **Specifications in `docs/spec/` are living.** They are edited in place and
  state what is true now. They are the only documents with authority over
  current behavior. `canonical: true` continues to mark them and appears
  nowhere else.
- **Decision records in `docs/decisions/` are point-in-time and immutable.**
  Once a decision record is accepted its body is not edited. A decision that
  changes is expressed by writing a new record that supersedes the old one, and
  the superseded record gains `superseded_by` in its frontmatter and keeps its
  text. Corrections are limited to typography and broken links.
- **Decision records therefore hold no authority over current behavior**, not
  because they rank below specifications but because they describe a moment
  that has passed. A rule a reader must obey belongs in the owning
  specification. An ADR states the change, the reasoning, and what was rejected.
- **One owner per fact.** Facts are owned by exactly one specification. This is
  not one document per topic: a topic may span several specifications as long
  as each fact within it has a single defining owner and the others link rather
  than restate. The work and task model in particular has one defining owner.
- **A specification does not assert precedence over another specification.**
  Precedence sections are the layered-addenda pattern that `CURRENT-DESIGN.md`
  exists to prevent, and their presence signals an ownership conflict to be
  resolved instead.
- **`docs/spec/` keeps its name, and citations become "Spec NN".** The
  documents are living specifications, which is what the directory already says.
- **Design documents are proposals, not contracts.** The vault's
  `Documents/Design/` notes are the input to a change: they describe an intended
  outcome and delivery sequence and point at the specifications that own the
  resulting behavior. They are not maintained as truth after the work lands.
- **A behavior change ships as** a decision record, the owning specification
  update, and one commit containing both.

## Alternatives considered

- **Rename `docs/spec/` to `docs/design/` and `type: spec` to `type: design`:**
  rejected. In common usage a design document is a point-in-time proposal
  reviewed before the work, which is the opposite lifecycle from these
  documents. Renaming would resolve the double name by adopting the misleading
  half, and it would collide with `document_kind: design` in the Note structure and dogfood vault spec.
- **Rank decision records as tertiary and keep them mutable:** rejected. Rank
  is the wrong axis. A low-status document that may still be edited remains an
  attractive home for live rules, which is how the current inversion formed.
  Immutability removes the incentive without needing a status hierarchy.
- **Treat decision records as an update log, one entry per change:** rejected.
  Entries describing diffs are unreadable once several accumulate, and the
  format's value comes from each record standing alone as a decision with its
  rejected alternatives intact.
- **Merge the specifications into fewer subsystem documents:** rejected, on the
  reasoning already recorded in the task "Consider merging spec files into
  fewer subsystem documents": the roadmap's governing-document lists average
  three to four specifications per slice and the most-cited documents pair with
  different neighbors each time, so a merge relocates the cost. One owner per
  fact addresses the ambiguity a merge was meant to fix.
- **Leave normative content in decision records and cross-reference it:**
  rejected. Cross-referencing produced the present precedence chain.

## Consequences

- Positive: "what is true" is answerable from the specifications alone, and no
  reader needs a decision record to learn a rule.
- Positive: the decision log becomes a genuine history, because records are no
  longer rewritten to stay current.
- Positive: an ownership conflict is now a detectable defect — a precedence
  section, or the same fact defined twice.
- Negative: superseding rather than editing produces more records over time,
  and a reader following an old link must follow `superseded_by` forward.
- Negative: lifting behavior out of ADRs 0008, 0012, 0013, and 0018 rewrites
  parts of four specifications, and those records will read as thin afterwards
  because their substance has moved.
- Negative: this record was itself revised before acceptance; the immutability
  rule applies from acceptance onward, not retroactively.
- Follow-up work: adopt the immutability and supersession convention in the
  routing documents and the ADR template; give the work and task model one
  owner; lift normative behavior out of the four records; align citations with
  the "Spec NN" name.
