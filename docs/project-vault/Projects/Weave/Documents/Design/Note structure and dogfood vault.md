---
type: document
document_kind: design
title: Note structure and dogfood vault
scope: project
project: '[[Projects/Weave/Project]]'
created: 2026-08-09
---

# Note structure and dogfood vault

## Goals

- Make project folders predictable without forcing a reorganization.
- Keep work entities strongly typed and contract-checkable when a project opts in.
- Make documents discoverable without turning ordinary Markdown into managed work.
- Use the Weave project vault to validate the model in small, reviewable moves.

## Non-goals

- Passive folder creation or automatic file movement.
- Requiring estimates, owners, milestones, or planning periods.
- Treating document checklists as mirrored tasks.

## Requirements

See the canonical contract in [Design 19](../../../../../spec/19-note-structure-and-dogfood-vault.md).
The implementation is split across [[../../Epics/Epic-10-project-structure-and-contracts]],
[[../../Epics/Epic-11-typed-document-catalog]], and
[[../../Epics/Epic-12-dogfood-vault-migration]].

## Open questions

- Which folder configuration controls should be exposed first in the workbench?
- Should the first migration use explicit move proposals or a repository-only
  scripted preparation followed by reviewed vault writes?
