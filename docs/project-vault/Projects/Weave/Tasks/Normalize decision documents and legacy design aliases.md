---
type: task
title: Normalize decision documents and legacy design aliases
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-11-typed-document-catalog]]'
status: backlog
priority: normal
created: 2026-08-09
---

# Normalize decision documents and legacy design aliases

## Summary

Support project-unique decision IDs, controlled decision status and required
sections, while recognizing legacy `type: design` as a deprecated alias.

## Acceptance criteria

- Decision failures remain warnings and never block editing or referencing.
- Duplicate IDs and invalid relationships are diagnosable.
- Legacy designs remain visible and receive a migration warning.

## Validation

Add decision, alias, relationship, and migration-fixture tests.
