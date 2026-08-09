---
type: task
title: Make milestone due dates optional
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-10-project-structure-and-contracts]]'
status: backlog
priority: normal
created: 2026-08-09
---

# Make milestone due dates optional

## Summary

Permit undated milestones and derive due or overdue state only for valid dates.

## Acceptance criteria

- Existing undated roadmap milestones are valid.
- Invalid dates still diagnose clearly.
- No provisional release date is inferred by the plugin.

## Validation

Update parser, query, fixture, and workbench tests for dated and undated milestones.
