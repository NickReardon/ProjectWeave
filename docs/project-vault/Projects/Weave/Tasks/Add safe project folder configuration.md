---
type: task
title: Add safe project folder configuration
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-10-project-structure-and-contracts]]'
status: backlog
priority: high
created: 2026-08-09
---

# Add safe project folder configuration

## Summary

Parse `weave.folders` with defaults for entity, document, template, and archive
roots. Reject absolute, traversing, empty, or project-note-colliding paths.

## Acceptance criteria

- Valid project-relative overrides round-trip through parsing and diagnostics.
- Invalid configuration fails creation rather than silently falling back.
- Existing notes outside configured roots remain indexed with warnings.

## Validation

Add parser and path tests for traversal, absolute paths, collisions, and case
variants.
