---
type: epic
title: Add Long-Project Organization
project: '[[Projects/Weave/Project]]'
status: planned
owner: ''
origin: '[[Projects/Weave/Project]]'
created: 2026-08-07
rank: 6000
milestone: '[[Milestones/v1 release]]'
depends_on: '[[Epics/Epic-creation-pipeline]]'
---

# Add Long-Project Organization

## Summary

Add one kind at a time: epic (lifecycle, task membership, progress), milestone (due date, lifecycle, progress, overdue), task iteration. Optional perspectives only when used or requested. Relationships derived from links, not mirrored arrays.

Each kind costs a creation kind spec — its allocation, render context, read set, and postcondition — plus its typed edit operations, commands, and focused acceptance. It does not cost another allocator, proposal service, and preview service: [ADR 0030](../../../../decisions/0030-one-creation-pipeline-with-a-spec-per-note-kind.md) collapsed those into one pipeline, and [[Epics/Epic-creation-pipeline]] is this Epic's prerequisite for that reason.

### Governing documents

- [Projects and epics](../../../../spec/projects-and-epics.md)
- [Dependencies and iterations](../../../../spec/dependencies-and-iterations.md)
- [Scheduling and milestones](../../../../spec/scheduling-and-milestones.md)
- [Vault note templates](../../../../spec/vault-note-templates.md)

### Exit gate

Every new kind produces a valid note from a body-focused template; project consistency through edits; invisible as process ceremony in projects that do not use it.

## Progress

> Derived from member tasks.

<!-- progress-placeholder -->
