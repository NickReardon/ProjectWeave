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

## Current focus

1. Run the outstanding desktop checks against the installed build in one
   session: the remaining Check 11 states, the category-vocabulary part of
   Check 05, Check 15, and Check 16. Record what was observed — including any
   defect — before treating the affected workbench, project-creation, or
   template flows as accepted.
2. Finish ADR 0013 with the previewed **Add Template** flow, vault-backed
   `project/default`, and the normative update to
   `docs/spec/18-project-note-templates.md`.
3. Follow the dependency-ordered remaining roadmap in
   `docs/IMPLEMENTATION_ORDER.md`, beginning with the shared read/action
   services and read-only agent boundary once the creation/template flow is
   accepted.
4. Keep every edit path behind the accepted creation flow. Multi-file
   proposals need the preflight and partial-success reporting Design 10
   requires before any bulk operation ships.

## Design index

- [docs/spec/](../../../spec/README.md)
- [docs/decisions/](../../../decisions/)
- [docs/ARCHITECTURE.md](../../../ARCHITECTURE.md)
