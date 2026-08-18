---
type: epic
title: Dogfood vault migration
project: '[[Projects/Weave/Project]]'
status: planned
origin: '[[Documents/Design/Note structure and dogfood vault]]'
created: 2026-08-09
milestone: '[[Milestones/v1 release]]'
rank: 3200
---

# Dogfood vault migration

## Summary

Apply the new structure to Project Weave's own vault in staged, reviewable
steps. Move canonical specifications, decision records, testing and release
references, and historical material into typed folders; migrate links; retain
short routing pointers until the old locations are no longer canonical. When
this lands, `docs/spec/` and `docs/decisions/` are no longer document
locations.

This Epic has no prerequisites, which is deliberate and recent. The dependency
on [[Epics/Epic-typed-document-catalog]] was dropped by
[ADR 0029](../../../../decisions/0029-hold-every-project-document-in-the-vault.md):
that Epic decides whether the plugin recognizes a document's kind, not where
the document lives, and typed documents are warning-only. The dependency on
[[Epics/Epic-project-structure-and-contracts]] went with
[[Tasks/Create the dogfood document tree]], which moved to that Epic — it
configures a project's folder map, which is that Epic's subject, and is the
only part of this work that needed the plugin to change.

What is left is relocation: moving files, migrating the links and tooling paths
that point at them, and proving the result. None of it waits on a build.

## Governing documents

- [Note structure and dogfood vault](../../../../spec/note-structure-and-dogfood-vault.md)
- [Quality and release](../../../../spec/quality-and-release.md)
- [ADR 0019](../../../../decisions/0019-note-structure-and-typed-documents.md)
- [ADR 0029](../../../../decisions/0029-hold-every-project-document-in-the-vault.md)

## Exit gate

No unexpected dogfood diagnostics, no duplicate canonical documents, all
compatibility pointers resolve, manual navigation and warning checks pass, and
the complete automated gate passes.

## Progress

> Derived from member tasks.

<!-- progress-placeholder -->
