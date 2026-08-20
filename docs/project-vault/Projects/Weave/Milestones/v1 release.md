---
type: milestone
title: Project Weave v1 Release Milestone
project: "[[Projects/Weave/Project]]"
status: planned
rank: 1000
owner: ""
origin: "[[Projects/Weave/Project]]"
created: 2026-08-07
---

# Project Weave v1 Release Milestone

## Outcome

All fourteen Epics pass their exit gates, manual checks are recorded, and the
plugin ships a stable v1.

This milestone is undated by choice. `due_date` is optional and informational,
and ordering comes from `rank`, so no release date is implied or required. See
[ADR 0024](../../../../decisions/0024-order-the-roadmap-by-milestone-and-rank.md).

## Success conditions

- [ ] [[Epics/Epic-template-catalog]] accepted: creation flow, template catalog, remaining desktop checks
- [ ] [[Epics/Epic-shared-reads-agent]]: shared reads + Agent Slice A (read-only bounded API)
- [ ] [[Epics/Epic-agent-grant-lifecycle]]: grant dialog, readable grant list, immutable lifecycle
- [ ] [[Epics/Epic-mutation-kernel]]: typed mutation kernel + multi-file preflight
- [ ] **Organization**, the next goal: [[Epics/Epic-dogfood-vault-migration]] relocates every document into the vault, [[Epics/Epic-project-structure-and-contracts]] lets a project describe its own folders and contracts, and [[Epics/Epic-typed-document-catalog]] makes the plugin recognize what is there
- [ ] [[Epics/Epic-task-execution]]: task editor, Board, Plan, My Work perspectives
- [ ] [[Epics/Epic-design-to-task]]: design-to-task planning + Agent Slice B
- [ ] [[Epics/Epic-creation-pipeline]]: one creation pipeline with a spec per note kind, and a testable workspace behind `main.ts`
- [ ] [[Epics/Epic-long-project-org]]: epic, milestone, planning period entities
- [ ] [[Epics/Epic-planning-periods]]: optional planning periods + Agent Slice C
- [ ] [[Epics/Epic-controlled-documents]]: controlled document patch engine + Agent Slice D
- [ ] [[Epics/Epic-stabilize-and-shipping]] accepted: schemas frozen, skill shipped, benchmarks recorded, desktop/mobile/manual checks passed

## Included work

Task membership is derived from task `milestone` links. All fourteen Epics declare
this milestone and carry a `rank` that orders them within it. The Epic model
does not yet interpret either property, so the grouping and its order are
authored but not queryable; [[Tasks/Add Epic roadmap graph fields]] closes that.

## Cross-cutting acceptance

- Full and incremental index behavior remain equivalent and project-isolated.
- Ordering and cursor bounds are deterministic; no view renders unbounded
  result sets.
- Preview bytes, stale fingerprints, collisions, dependency cycles, and
  partial failures have regression coverage.
- Supported edits preserve unknown fields, body content, and newline style.
- Gateway scope, path aliases, revocation, oversized proposals, untrusted note
  text, and approval replay fail closed.
- Plugin load, settings, indexing, navigation, and views remain non-writing
  except for explicitly configured derived diagnostics output.
- Automated and manual verification are reported separately before release.

## Progress

> Derived from member tasks with ``milestone`` property set to: [[Milestones/v1 release]]

<!-- progress-placeholder -->

## Review

<!-- review notes, retrospective content, outcome captured on achieve/cancel -->
