---
type: epic
title: Dogfood vault migration
project: '[[Projects/Weave/Project]]'
status: planned
origin: '[[Documents/Design/Note structure and dogfood vault]]'
created: 2026-08-09
milestone: '[[Milestones/v1 release]]'
rank: 12000
depends_on:
  - '[[Epics/Epic-project-structure-and-contracts]]'
---

# Dogfood vault migration

## Summary

Apply the new structure to Project Weave's own vault in staged, reviewable
steps. Move canonical specifications, decision records, testing and release
references, and historical material into typed folders; migrate links; retain
short routing pointers until the old locations are no longer canonical. When
this lands, `docs/spec/` and `docs/decisions/` are no longer document
locations.

The dependency on [[Epics/Epic-typed-document-catalog]] was dropped by
[ADR 0029](../../../../decisions/0029-hold-every-project-document-in-the-vault.md).
That Epic decides whether the plugin recognizes a document's kind, not where
the document lives, and typed documents are warning-only.

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
