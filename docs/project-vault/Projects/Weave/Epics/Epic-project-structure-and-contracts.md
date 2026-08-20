---
type: epic
title: Project structure and work-note contracts
project: '[[Projects/Weave/Project]]'
status: planned
origin: '[[Documents/Design/Note structure and dogfood vault]]'
created: 2026-08-09
milestone: '[[Milestones/v1 release]]'
rank: 3400
depends_on: '[[Epics/Epic-template-catalog]]'
---

# Project structure and work-note contracts

## Summary

Add safe per-project folder configuration, structured starter bodies, and
opt-in contracts for work-note fields and headings. Creation and future typed
moves must remain inside configured roots; existing notes outside them remain
usable with warnings.

## Governing documents

- [Note structure and dogfood vault](../../../../spec/note-structure-and-dogfood-vault.md)
- [Vault note templates](../../../../spec/vault-note-templates.md)
- [ADR 0019](../../../../decisions/0019-note-structure-and-typed-documents.md)

## Exit gate

Configured paths reject traversal and collisions, contracts validate existing
notes without rewriting them, proposals fail closed, and Epic roadmap fields
are parsed and deterministically ordered.

## Progress

> Derived from member tasks.

<!-- progress-placeholder -->
