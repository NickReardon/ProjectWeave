---
type: task
title: Revisit declared creation fields after two more kinds
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-long-project-org]]'
status: backlog
category: enhancement
priority: low
rank: 7000
milestone: '[[Milestones/v1 release]]'
created: 2026-08-19
---

# Revisit declared creation fields after two more kinds

## Summary

[ADR 0030](../../../../decisions/0030-one-creation-pipeline-with-a-spec-per-note-kind.md)
collapses the creation ladders below the modal but deliberately leaves the two
creation forms alone. Declaring their fields was rejected for now, not rejected:
the two existing forms are not uniform, so a generic field renderer would need
an escape hatch on its first day.

The concrete obstacles: the task form's template dropdown depends on an async
variant list, and the project form shows its root picker only when several
indexed roots exist.

## Trigger

Two more kinds have working creation forms — epic and milestone, from this
Epic. At that point the shared vocabulary is observed rather than predicted, and
this task decides whether fields join the creation kind spec or stay in the
subclass.

## Solution

Undecided by design. Compare the four forms, and either extend the creation kind
spec with a field declaration or record that per-kind subclasses are the right
shape and close this. `CreationPreviewModal` already keeps its subclasses small
— 192 and 136 lines — so the burden of proof is on generalizing further.

## Acceptance criteria

- A written comparison of what the four creation forms share and where they
  diverge.
- Either a field declaration in the creation kind spec with every existing form
  expressed in it, or a decision record explaining why per-kind forms stay.
- No form loses behavior it has today, in particular the async template variant
  list and the conditional root picker.

## Notes

Held out of [[Epics/Epic-creation-pipeline]] on purpose; it belongs to the Epic
that produces the kinds that would settle it.
