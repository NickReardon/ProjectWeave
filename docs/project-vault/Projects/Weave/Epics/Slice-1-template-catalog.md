---
type: epic
title: Add Template Catalog and Creation Acceptance
project: '[[Projects/Weave/Project]]'
status: active
owner: ''
origin: '[[Projects/Weave/Project]]'
created: 2026-08-07
milestone: '[[Milestones/v1 release]]'
---

# Add Template Catalog and Creation Acceptance

## Summary

Accept the creation flow end-to-end and complete the template catalog. New-project and new-task flows use vault-backed templates via a catalog resolver; chooser presents options; validation preflight catches violations before commit; proposal preview shows exact resulting note; safe commit refuses collisions, overwrites, and invalid states. Template variants for project creation alongside existing default path.

### Governing documents

- [Design 18 — Project-Owned Templates](../../../../spec/18-project-note-templates.md)
- [ADR 0013 — Layered Note-Template Catalog](../../../../decisions/0013-resolve-templates-from-a-vault-template-folder.md)
- [Manual Checks](../../../../development/testing.md)

### Exit gate

The complete automated gate passes; checks 5, 11, 15, 16 and the focus checks
have recorded outcomes; ADR 0013 is accepted; and task/project catalog behavior
is accepted in Obsidian.

## Progress

> Derived from member tasks.

<!-- progress-placeholder -->
