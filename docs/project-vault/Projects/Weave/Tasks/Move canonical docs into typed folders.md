---
type: task
title: Move canonical docs into typed folders
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-12-dogfood-vault-migration]]'
status: backlog
priority: high
created: 2026-08-09
---

# Move canonical docs into typed folders

## Summary

Move specifications and ADRs into Documents/Design and Documents/Decisions,
preserving content while adding typed metadata and updating links.

## Acceptance criteria

- There is one canonical copy of each specification and ADR.
- Links and origin references resolve from the new locations.
- Old locations remain only as short non-authoritative compatibility pointers until retired.

## Validation

Check link resolution, duplicate canonical documents, and warning diagnostics after each category.
