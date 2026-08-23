---
type: task
title: Reconcile two decision records whose frontmatter contradicts their bodies
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-documentation-authority]]'
status: backlog
category: chore
priority: normal
rank: 5950
milestone: '[[Milestones/v1 release]]'
created: 2026-08-23
---

# Reconcile two decision records whose frontmatter contradicts their bodies

## Summary

Two accepted records carry frontmatter that disagrees with what the log says
about them. Both were found while building the partial-supersession index in
[[Documents/Decisions/README|the decisions README]], and both were left alone
under immutability rather than quietly corrected.

**ADR 0013** is `status: proposed`. It is foundational, cited by number
throughout the log and by [[Documents/Decisions/0033-correct-which-creation-path-skipped-the-rung-ladder|ADR 0033]],
and its fail-closed rule is implemented and tested. Nothing in the project
treats it as a proposal.

**ADR 0015** carries `superseded_by: '0023'`, the marker the README reserves
for a decision replaced in whole. ADR 0023's own body says the rest of 0015
still stands, which is the definition of a partial supersession — for which the
README says the earlier record gains no `superseded_by` at all. Its
`affects: ['0016']` also names a decision record, where the documented meaning
of the field is the specifications a decision changed.

## The tension

The README lists the only permitted edits to an accepted record: typography,
broken links, and a one-time id collision fix. It also now states that
frontmatter is part of the record and not editable metadata — the rule settled
when [[Tasks/Revisit whether the agent grant secret is load-bearing]] closed
the `0017` `area` question.

A stale `status` is not the same as a missing subject tag. `area` is read by
nothing; `status` and `superseded_by` are the fields a reader uses to decide
whether a record still stands, and both are currently misleading. Whether
correcting a field that misdescribes the record's own standing is a permitted
repair or an immutability violation is the question to settle, and it should be
settled once for the class rather than per record.

## Acceptance criteria

- It is decided and written down whether `status` and `superseded_by` may be
  corrected on an accepted record when they misdescribe its standing.
- The rule lives in the decisions README, which owns the lifecycle, not in a
  record.
- ADR 0013 and ADR 0015 are brought into agreement with it, whether by
  correction or by an explicit statement that they stand as they are.
- If they stand, a reader of either record can discover the discrepancy without
  reading this note.
