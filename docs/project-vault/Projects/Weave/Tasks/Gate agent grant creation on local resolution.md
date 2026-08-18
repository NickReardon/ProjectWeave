---
type: task
title: Gate agent grant creation on local resolution
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-agent-grant-lifecycle]]'
status: done
category: enhancement
priority: high
rank: 6600
milestone: '[[Milestones/v1 release]]'
created: 2026-08-17
---

# Gate agent grant creation on local resolution

## Summary

Inside the dialog introduced by [[Tasks/Move agent grant creation into a
dialog]], the create action must stay unavailable until the chosen project
and every chosen content root resolve locally against the vault. The order of
operations, what counts as resolvable, why validation must be local rather
than a gateway round trip, and why creation stays atomic are already fully
specified by [[Tasks/Restructure agent grant creation into validate-then-create]]
and are not repeated here; that note is the design record for this task and
should be read in full before implementing it.

What this task adds beyond that note: the validate-then-create ordering was
designed against the settings-row layout and now needs to be built inside the
dialog surface instead, and it needs to account for the explicit
metadata-only/content-readable choice from [[Tasks/Move agent grant creation
into a dialog]], which is settled: scope is an explicit choice. Metadata-only
is unconditionally resolvable and carries no content roots, and an empty folder
list in the content-readable state does not resolve. The special case for an
empty list disappears with the inference that required it.

## Acceptance criteria

All acceptance criteria already stated in [[Tasks/Restructure agent grant
creation into validate-then-create]] apply unchanged, evaluated against the
dialog rather than the settings row. In addition:

- The dialog's create action reflects resolution state the same way
  regardless of whether content scope is chosen through an inferred empty
  list or an explicit metadata-only toggle.
- Resolution state is re-evaluated as the user changes any field in the
  dialog, not only on an explicit submit attempt.

## Validation

Automated tests for the resolution predicate (indexed project path, existing
folder paths, empty/metadata-only case) carried over from the prerequisite
task, re-pointed at the dialog's component. Manual check: with the agent
gateway disabled, open the dialog, enter an unindexed project path, and
confirm the create action stays disabled with a message naming the project
field as the problem; repeat for a content root that does not exist.
