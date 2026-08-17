---
type: decision
id: '0024'
area: scheduling
status: accepted
canonical: false
affects: ['data-model-and-index', 'projects-and-epics', 'scheduling-and-milestones', 'note-structure-and-dogfood-vault']
---

# ADR 0024: Order the roadmap by milestone and explicit rank, not by Epic filename

- Status: accepted
- Date: 2026-08-16
- Owners: core

## Context

Twelve Epic notes describe the v1 roadmap. Nine are named `Slice-1-…` through
`Slice-9-…` and **carry no `rank` at all**, so their filename is the only thing
that orders them. The other three carry `rank: 10`, `20`, `30`, which does not
compose with the nine in any defined way.

An order encoded in a filename cannot be validated, cannot be queried, and
cannot be changed without renaming a note and breaking every link into it. It
also reads as a commitment the model does not make: "Slice 4" implies a fixed
position in a sequence that nothing enforces.

All twelve Epics declare the same milestone. The v1 milestone note records the
consequence itself — the Epic grouping "is documented rather than queryable"
— because the Epic model does not interpret the property.

Milestones are the natural carrier for order of operations: they are the dated,
named outcomes a project actually sequences toward. But the specifications
disagree about whether a milestone is dated at all. `docs/spec/02` and
`docs/spec/15` both make `due_date` **required**; `docs/spec/19` says it is
**optional**. Both the v1 milestone note and the project note record its date as
provisional and explicitly not a release commitment, so ordering by date would
force a commitment this project has twice declined to make.

## Decision

Order the roadmap by milestone, then by Epic rank within that milestone.

- **Milestones carry an optional positive integer `rank`,** using the same
  spaced-gap convention as task rank. Rank is what orders milestones.
- **Milestone `due_date` is optional and informational.** It never orders
  anything. This settles the disagreement between specs 02, 15, and 19 in favour
  of optional, because rank now carries the ordering that `due_date` was being
  asked to imply.
- **Epic `rank` orders Epics within a milestone,** not globally. An Epic's
  milestone decides when its work happens; its rank decides its position among
  that milestone's Epics.
- **Epic `depends_on` continues to express genuine prerequisites** and still
  blocks. It is independent of rank, which is preference rather than necessity.
- **Epic note names are identifiers and carry no sequence.** The nine `Slice-N-`
  names are renamed accordingly.

Milestones do **not** gain `depends_on`. Milestone sequences are chains rather
than graphs, and a chain is exactly what rank expresses.

## Alternatives considered

- **Order milestones by `due_date`:** rejected. It is the natural reading of
  "milestone", but it forces a date onto every ordered milestone, and this
  project has recorded twice that its v1 date is provisional. It would also
  entrench the `due_date`-is-required position that specs 02 and 15 hold and
  spec 19 contradicts.
- **Give milestones `depends_on`:** rejected. The machinery is possible — it is
  the shape task dependencies already use — but it buys cycle detection and
  partial-order linearization for a case that almost never branches. Milestone
  dependencies are also usually implied by their contents, since a later
  milestone needs an earlier one because of the Epics inside it, so declaring
  them duplicates something derivable.
- **Keep order in the filename:** rejected. It cannot be validated or queried,
  and reordering means renaming notes and rewriting every inbound link.
- **Drop Epic rank and rely on milestone membership alone:** rejected. This
  project currently has one milestone, so every Epic would be unordered. Rank
  within a milestone is what makes the model work before a project has several.
- **Rank Epics globally, ignoring milestones:** rejected. It is the current
  model in spec 19, and it makes milestone membership decorative — which is the
  state this record exists to change.

## Consequences

- Positive: roadmap order becomes data. It can be validated, queried, and
  reordered by editing one property instead of renaming a note.
- Positive: renaming or retitling an Epic no longer implies re-sequencing the
  roadmap.
- Positive: the three-way disagreement about milestone `due_date` is resolved,
  and an undated milestone becomes a first-class thing rather than a violation.
- Negative: the nine `Slice-N-` Epic notes are renamed, which rewrites wiki
  links in the Epics, the tasks that name them, the project note, and the design
  notes.
- Negative: two ordering keys exist — milestone rank and Epic rank — and a
  reader must know which applies at which level.
- Negative: a project with one milestone gets no benefit from milestone
  ordering, and this project is that project today.
- Follow-up work: specs 02, 04, 15, and 19 change here. The task
  "Make milestone due dates optional" is settled by this record. The task
  "Add Epic roadmap graph fields" is respecified: roadmap order is milestone
  rank, then Epic rank, then normalized path.
