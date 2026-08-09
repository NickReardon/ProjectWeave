---
type: epic
title: Dogfood vault migration
project: '[[Projects/Weave/Project]]'
status: planned
origin: '[[Documents/Design/Note structure and dogfood vault]]'
created: 2026-08-09
milestone: '[[Milestones/v1 release]]'
rank: 30
depends_on:
  - '[[Epics/Epic-10-project-structure-and-contracts]]'
  - '[[Epics/Epic-11-typed-document-catalog]]'
---

# Dogfood vault migration

## Summary

Apply the new structure to Project Weave's own vault in staged, reviewable
steps. Move canonical specs, ADRs, testing/release references, and historical
material into typed folders; migrate links; retain short routing pointers until
the old locations are no longer canonical.

## Governing documents

- [Design 19](../../../../spec/19-note-structure-and-dogfood-vault.md)
- [Design 13](../../../../spec/13-quality-and-release.md)
- [ADR 0019](../../../../decisions/0019-note-structure-and-typed-documents.md)

## Exit gate

No unexpected dogfood diagnostics, no duplicate canonical documents, all
compatibility pointers resolve, manual navigation and warning checks pass, and
the complete automated gate passes.

## Progress

> Derived from member tasks.

<!-- progress-placeholder -->
