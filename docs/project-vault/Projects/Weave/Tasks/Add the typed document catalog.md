---
type: task
title: Add the typed document catalog
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-typed-document-catalog]]'
status: backlog
priority: high
created: 2026-08-09
---

# Add the typed document catalog

## Summary

Introduce `DocumentRecord` parsing and bounded project-scoped lookup without
mixing documents into entity readiness, lifecycle, or membership projections.

## Acceptance criteria

- Built-in document kinds and safe custom kinds are recognized.
- Untyped Markdown remains unaffected.
- Full and incremental indexing produce equivalent document catalogs.

## Validation

Add parser, catalog, bounded query, and incremental-equivalence tests.
