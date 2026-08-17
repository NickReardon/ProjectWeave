---
type: project
title: Project Weave
status: active
---

# Project Weave

## Summary

Project Weave dogfoods itself here: this vault tracks the plugin's own
outstanding work, replacing the task-shaped content that used to live in
`docs/CURRENT_WORK.md`. See [ADR 0015](../../../decisions/0015-track-project-state-in-weave-itself.md)
for why, and [ADR 0016](../../../decisions/0016-dogfood-vault-location.md) for
why this vault lives at `docs/project-vault/`.

Automated validation evidence stays in `docs/CURRENT_WORK.md` — that section
is a statement about commits that already happened, and turning it into
mutable task state would destroy the property that makes it evidence.

## Operational state

- The filterable Project Workbench and the task creation chain — allocation,
  template resolution, proposal, preview, and commit — pass the complete
  automated gate.
- Version 0.5.0 was exported and installed into the configured disposable test
  vault, replacing the 0.4.0 build the earlier checks ran against. It is the
  first installed build carrying project creation, the vault template catalog
  and chooser, and task categories. See the Tasks in this project for which
  manual checks remain outstanding — the workbench as a whole is not yet
  manually accepted until those pass.
- **Project Weave now writes to the vault.** Confirming **Create task** in the
  preview modal creates one new note. That is the only write: indexing, plugin
  load, settings changes, navigation, and the dashboard still modify nothing,
  and the write path cannot modify, move, or delete an existing note. This is
  also why this project's own task-status changes are hand-edited for now —
  see ADR 0016.
- Task creation is manually accepted. Against a real vault it creates the
  folders it needs, suffixes a colliding name rather than overwriting, refuses
  a commit whose project note changed while the modal was open, and writes a
  note matching its preview byte for byte.
- Task target paths and backlog ranks are allocated by pure application code.
  ADR 0008 settles the folder convention, filename derivation, collision
  policy, and rank rule that `docs/spec/README.md` had left open.
- Local test-vault installation and the preview/stable release workflow are
  documented and automatically exercised. Nothing has been released.
- A disposable test vault can be seeded and reset from the committed fixture
  (`tests/fixtures/vault/`), so a manual check runs from a known state.

## Implementation roadmap (v1)

Project Weave v1 is planned across nine ordered Epic notes. This table and the
linked notes replace the former `docs/IMPLEMENTATION_ORDER.md` roadmap:

| Slice | Epic | Status |
|---|---|---|
| 1. Template catalog | [[Epics/Slice-1-template-catalog]] | In progress |
| 2. Shared reads + Agent A | [[Epics/Slice-2-shared-reads-agent]] | In progress |
| 3. Mutation kernel | [[Epics/Slice-3-mutation-kernel]] | In progress |
| 4. Task execution | [[Epics/Slice-4-task-execution]] | Not started |
| 5. Design-to-task | [[Epics/Slice-5-design-to-task]] | Not started |
| 6. Long-project org | [[Epics/Slice-6-long-project-org]] | Not started |
| 7. Planning periods + Agent C | [[Epics/Slice-7-planning-periods]] | Not started |
| 8. Controlled docs + Agent D | [[Epics/Slice-8-controlled-documents]] | Not started |
| 9. Stabilize & ship v1 | [[Epics/Slice-9-stabilize-and-shipping]] | Not started |

### Sequencing rules

1. Finish and accept an existing write boundary before adding another.
2. Put domain rules in shared application services before view-specific or
   agent-specific callers.
3. Deliver the read-only agent boundary before broad write automation; expose
   agent writes only after the equivalent human workflow is stable.
4. Keep optional process features progressively disclosed. A project remains
   useful without owners, estimates, epics, milestones, or planning periods.
5. Keep operational lists project-scoped, bounded, and deterministically
   ordered.
6. Introduce multi-file work only after complete preflight, deterministic write
   order, and truthful partial-success reporting exist.
7. Keep desktop transport conditional so the core plugin remains mobile-safe.

### Representation gaps exposed by this port

- Epic order is encoded by the numbered note names and the table above. Weave
  has no typed Epic rank or dependency relation, so the sequence is not yet
  queryable or validated.
- The Epic notes carry a `milestone` property for the intended v1 grouping,
  but the current Epic model does not interpret it. Milestone membership is
  derived from task links, so Project Weave cannot yet query that all nine
  Epics belong to the v1 milestone.
- A milestone requires `due_date`, while the retired roadmap intentionally had
  no release date. The v1 milestone currently carries `2026-08-14`; treat it as
  provisional until it is explicitly confirmed, not as a commitment inferred
  from the roadmap.

## Current focus

1. Finish Slice 1 acceptance: record the remaining workbench/template manual
   checks and resolve their findings.
2. Finish Slice 2 acceptance: run desktop gateway Check 17, then update the
   Epic outcome from its observed result.
3. Continue Slice 3: add source-preserving existing-note mutations, then
   implement reorder/Rebalance Backlog Ranks on that foundation.
4. Keep every edit path behind the accepted creation flow. Multi-file
   proposals need the preflight and partial-success reporting Design 10
   requires before any bulk operation ships.

## New planned work

The note-structure and dogfood-vault slice is tracked as three project Epics:

| Epic | Status | Depends on |
|---|---|---|
| [[Epics/Epic-10-project-structure-and-contracts]] | planned | Slice 1 |
| [[Epics/Epic-11-typed-document-catalog]] | planned | Epic 10 |
| [[Epics/Epic-12-dogfood-vault-migration]] | planned | Epics 10 and 11 |

The design brief is [[Documents/Design/Note structure and dogfood vault]].

## Design index

- [docs/spec/](../../../spec/README.md)
- [docs/decisions/](../../../decisions/)
- [docs/ARCHITECTURE.md](../../../ARCHITECTURE.md)
