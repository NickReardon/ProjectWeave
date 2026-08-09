---
type: task
title: Make document validation warning-only
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-11-typed-document-catalog]]'
status: backlog
priority: high
created: 2026-08-09
---

# Make document validation warning-only

## Summary

Validate document metadata, scope, project relations, folder expectations, and
sections as warnings while preserving reads, links, origins, and task creation.

## Acceptance criteria

- Every document schema/path issue is actionable but non-blocking.
- Ordinary Markdown receives no schema warning.
- Warning banners and catalog filters find the affected note.

## Validation

Add diagnostics and manual checks for malformed typed documents and origin navigation.
