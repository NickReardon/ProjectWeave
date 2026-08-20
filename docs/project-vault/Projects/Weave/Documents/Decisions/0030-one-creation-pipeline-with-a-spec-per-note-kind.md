---
type: decision
id: '0030'
area: architecture
status: accepted
canonical: false
affects: ['0009', '0013', '0019']
---

# ADR 0030: Build one creation pipeline with a spec per note kind

- Status: accepted
- Date: 2026-08-19
- Owners: core

Once this record is accepted, its body is not edited. A decision that changes
is superseded by a new record; see [`README.md`](README.md).

## Context

Note creation runs as two complete ladders side by side — allocate, propose,
preview, commit — one for tasks and one for projects. They are the same ladder.
`TaskCreationProposalService.propose` and `ProjectCreationProposalService.propose`
both validate the operation id with the same message, both refuse a snapshot
that is not `current`, both split frontmatter and emit the same
`proposal.output.frontmatter_invalid`, both re-read the target and emit the same
`proposal.target.exists`, and both then assemble the same proposal envelope
field for field.

Two things show the seam is in the wrong place. `project-creation-preview.ts`
imports `byteLength` and `lineCount` *from* `task-creation-preview.ts`: project
creation depends on the task module for two generic content measurements
because there is nowhere else for them to live.
[ADR 0013](0013-resolve-templates-from-a-vault-template-folder.md)'s rung ladder
is implemented twice — once in `TaskTemplateResolver`, and again privately in
`ProjectCreationProposalService.#selectTemplate`, whose own comment says it does
so "on the same grounds as a task variant".

The cost is scheduled rather than hypothetical.
[ADR 0019](0019-note-structure-and-typed-documents.md) commits to epics,
milestones, planning periods, and typed documents; the packaged starter set
ships six kinds; `CreatedNoteKind` is `'task' | 'project'`. The
`Add Long-Project Organization` Epic states its plan as adding "one kind at a
time, each with domain creation profile, catalog-backed renderer, allocator,
proposal, preview, safe commit" — which is a commitment to build this ladder
four more times, at roughly eight hundred lines each.

The destination is already proven one layer up. `CreationPreviewModal` is a deep
module with five small per-kind hooks, and its two subclasses are 192 and 136
lines. The application layer beneath it never received the same treatment.

## Decision

Note creation is one pipeline. A note kind is a small declarative record behind
it, not a parallel stack of services.

- **One `preview(kind, request)` / `commit(proposal)` interface** owns the steps
  that do not vary by kind: operation-id validation, freshness refusal, template
  resolution, rendering, frontmatter validation, target absence, and envelope
  assembly.
- **A creation kind spec declares only what makes a kind a kind** — its
  allocation, its render context, its read set, and its expected postcondition.
- **Template rung resolution has one owner.** `TaskTemplateResolver`'s ladder
  generalizes to a template kind, and the private reimplementation goes.
  ADR 0013's fail-closed behavior becomes uniform: today only the task path
  fully implements it.
- **The write boundary is unchanged.**
  [ADR 0009](0009-create-only-write-boundary.md) still holds: `NoteWriter`
  remains the sole write port, the pipeline cannot write, and the commit service
  remains its only caller. This decision moves no capability across that line.

## Alternatives considered

- **Add each new kind as its own ladder, as scheduled:** rejected. It is the
  status quo extended four times, and the duplication is a multiplier on work
  already on the roadmap rather than a tidiness complaint.
- **Extract only the shared helpers** — the envelope, the measurements, the rung
  ladder — and leave two services: rejected as half a seam. It removes the
  import leak but leaves two places where the safety sequence must agree, which
  is the property that actually matters.
- **Generalize the creation modal's fields in the same change:** rejected for
  now. The two existing forms are not uniform — the task form's template
  dropdown depends on an async variant list, the project form shows its root
  picker only when several indexed roots exist — so a generic field renderer
  would need an escape hatch immediately. Revisit once a third and fourth kind
  make the shared vocabulary observed rather than predicted.

## Consequences

- Positive: the next note kind costs one spec rather than another allocator,
  proposal service, preview service, and envelope. Four kinds are queued.
- Positive: the safety sequence — freshness, frontmatter validation, target
  absence — is read in one place instead of confirmed by diffing two.
- Positive: the pipeline is proven once against a fake spec, and each kind gets
  a small table test, replacing two test files that re-prove the same skeleton.
- Negative: a wide refactor of code that currently works, touching both creation
  paths and their tests at once. It buys nothing observable to a user.
- Negative: it lands in front of work that is more visible, and it is only worth
  the cost because of the kinds queued behind it. If those kinds were dropped,
  so should this be.
- Follow-up work: the `Add Long-Project Organization` Epic depends on this, and
  its per-kind plan is restated in terms of specs rather than ladders.
