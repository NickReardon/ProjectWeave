---
type: task
title: Lift normative behavior out of decision records
project: '[[Projects/Weave/Project]]'
status: done
category: chore
priority: critical
rank: 300
origin: '[[Documents/Design/Documentation authority and document lifecycle]]'
created: 2026-08-16
---

# Lift normative behavior out of decision records

## Summary

ADR 0013 carries roughly 410 lines of behavior under headings such as
"Detection and validation" and "Failure behavior". ADRs 0008, 0012, and 0018
carry smaller amounts. Move that behavior into the specifications that own it
and leave each record as a decision with its rationale and rejected
alternatives.

## Acceptance criteria

- ADR 0013's normative content lives in the Vault note templates spec; 0008's in the Task management spec and
  the Scheduling and milestones spec; 0012's in the Projects and epics spec; 0018's in the Agent access and MCP spec.
- Each of the four records retains Context, Decision, Alternatives considered,
  and Consequences, and states no rule a reader must obey.
- `docs/spec/README.md` no longer defers to decision records under "Remaining
  design decisions"; unresolved questions are stated as open or moved to tasks.
- The four records are edited in place this once, under the transition
  recorded in ADR 0022; immutability applies to records accepted afterwards.

## Validation

Confirm every rule removed from a record appears in exactly one specification,
then run `npm run check`.
