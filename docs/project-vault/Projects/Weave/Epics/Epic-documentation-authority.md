---
type: epic
title: Documentation authority
project: '[[Projects/Weave/Project]]'
status: active
origin: '[[Documents/Design/Documentation authority and document lifecycle]]'
created: 2026-08-19
milestone: '[[Milestones/v1 release]]'
rank: 3100
---

# Documentation authority

## Summary

Decide how Project Weave writes about itself, and make the rules enforceable.
Living specifications own current behavior and are edited in place; decision
records are point-in-time, immutable once accepted, and hold no authority over
what is true today; each fact has exactly one owner. The mid-flight record
carries what is in flight rather than accumulating history, specifications are
named by subject, and a documentation gate keeps links, naming, and decision
record identity from drifting.

This Epic owns the discipline, not the documents. What is true stays with the
specifications and the log stays history; the work of shaping them is what
lands here.

It exists because that work had no owner.
[ADR 0031](../Documents/Decisions/0031-give-the-documentation-system-an-owning-epic.md)
records why: six finished tasks carried the documentation model with no Epic
and no milestone, so a slice the project had actually completed appeared
nowhere on its own roadmap.

## Governing documents

- [[Documents/Specifications/quality-and-release|Quality and release]]
- [[Documents/Decisions/0022-separate-living-specifications-from-point-in-time-decision-records|ADR 0022]]
- [[Documents/Decisions/0023-make-current-work-a-mid-flight-record|ADR 0023]]
- [[Documents/Decisions/0025-name-specifications-by-subject|ADR 0025 (name specifications by subject)]]
- [[Documents/Decisions/0031-give-the-documentation-system-an-owning-epic|ADR 0031]]

## Relationship to the other document Epics

Three Epics touch documents and none of them overlap.

- This Epic decides how the project's own documents are written and owned.
- [[Epics/Epic-dogfood-vault-migration]] moved those documents into the vault.
  It applied this model; it did not decide it.
- [[Epics/Epic-typed-document-catalog]] makes the plugin recognize typed
  documents in a *user's* vault, which is product surface rather than project
  practice.

## Exit gate

One owner per fact, with no document asserting precedence over another.
Specifications state current behavior and are edited in place; accepted
records are never edited and never define behavior. The documentation gate
fails a broken link, a numbered specification filename, and a decision record
whose declared identity disagrees with its filename or heading. The complete
automated gate passes.

Every member but [[Tasks/Consider merging spec files into fewer subsystem documents]]
is done, and that one is deliberately deferred with a stated revisit
condition. The Epic completes when it is answered or dropped.

## Progress

> Derived from member tasks.

<!-- progress-placeholder -->
