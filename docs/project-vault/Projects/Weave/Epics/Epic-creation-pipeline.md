---
type: epic
title: Make note creation one pipeline and the entry point testable
project: '[[Projects/Weave/Project]]'
status: planned
origin: '[[Projects/Weave/Project]]'
created: 2026-08-19
milestone: '[[Milestones/v1 release]]'
rank: 5500
depends_on: '[[Epics/Epic-template-catalog]]'
---

# Make note creation one pipeline and the entry point testable

## Summary

Two structural changes to the layers every future note kind passes through.

**One creation pipeline.** The task and project creation ladders are the same
ladder built twice. Collapse them into one pipeline with a small declarative
spec per kind, so the next kind costs a spec rather than another eight hundred
lines. Decided in
[ADR 0030](../../../../decisions/0030-one-creation-pipeline-with-a-spec-per-note-kind.md).

**A testable workspace.** `src/main.ts` is the highest-churn file in the
repository, has no test file, and has accumulated rules that are not wiring —
including the containment rule that keeps an agent grant scoped to one project.
Lift that into plain modules behind a settings port, leaving the entry point
with registration and adapter construction.

They are grouped because they meet in the same place: the pipeline replaces the
entry point's two creation openers, and doing that against a workspace rather
than against `Plugin` means the new wiring lands somewhere testable the first
time.

## Why now

This is not a tidiness Epic. The cost of leaving it is already scheduled:
[[Epics/Epic-long-project-org]] adds epics, milestones, and planning periods one
kind at a time, and until this Epic existed each kind carried "domain creation
profile, catalog-backed renderer, allocator, proposal, preview, safe commit" of
its own. On the current shape that meant building the duplicated ladder three
more times, with typed documents making four. That Epic now states its plan as
one spec per kind and names this one as its prerequisite.

## Governing documents

- [ADR 0030](../../../../decisions/0030-one-creation-pipeline-with-a-spec-per-note-kind.md)
- [ADR 0009](../../../../decisions/0009-create-only-write-boundary.md)
- [ADR 0013](../../../../decisions/0013-resolve-templates-from-a-vault-template-folder.md)
- [Architecture](../../../../ARCHITECTURE.md)

## Scope

Only the second change alters an architectural boundary, by introducing a
settings port and a workspace that is not an Obsidian `Plugin`. It carries no
decision record of its own because it decides nothing a reader must obey: no
behavior changes, no capability crosses the write boundary, and there is no
rejected alternative worth preserving. `ARCHITECTURE.md` is updated when it
lands.

Generalizing the creation modal's fields is deliberately **not** in scope; see
[[Tasks/Revisit declared creation fields after two more kinds]].

## Exit gate

Adding a note kind requires one spec and no new service; template rung
resolution has exactly one implementation; the grant containment rule has
adversarial tests that do not construct an Obsidian plugin; `src/main.ts`
carries registration and adapter construction only; no module imports another
kind's module for generic helpers.

## Progress

> Derived from member tasks.

<!-- progress-placeholder -->
