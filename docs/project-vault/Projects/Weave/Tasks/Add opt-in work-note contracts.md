---
type: task
title: Add opt-in work-note contracts
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-project-structure-and-contracts]]'
status: backlog
priority: high
created: 2026-08-09
---

# Add opt-in work-note contracts

## Summary

Validate project-configured required fields and level-two headings for task,
Epic, milestone, and planning-period notes.

## Acceptance criteria

- Contract violations diagnose existing notes without changing them.
- Create and mutation proposals fail before writing when a contract is unmet.
- Heading matching is case-insensitive and whitespace-normalized.

## Validation

Cover required-field whitelists, duplicate headings, malformed contracts, and
per-kind structured templates.
