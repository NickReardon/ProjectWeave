---
type: task
title: Make milestone due dates optional
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-project-structure-and-contracts]]'
status: done
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

## Outcome

Settled by [ADR 0024](../../../../decisions/0024-order-the-roadmap-by-milestone-and-rank.md).
Milestone `rank` carries roadmap ordering, so `due_date` is no longer
structurally required. Specs 02, 15, and 19 disagreed on this and now agree that
it is optional and informational.

`parseMilestone` reads the date through `readOptionalDate`, so an undated
milestone parses cleanly while a malformed date still raises
`milestone.due_date.invalid`. `readRequiredDate` had no other caller and was
removed. Parser coverage asserts the undated, empty, valid, and malformed cases.
The v1 milestone note is now undated.

Query and workbench coverage for dated and undated milestones travels with
[[Tasks/Add Epic roadmap graph fields]], which is where milestone `rank` is
parsed.
