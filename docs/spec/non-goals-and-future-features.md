---
type: spec
area: non-goals
status: current
canonical: true
related_decisions: ["0002"]
---

# Non-goals and Future Features

## Purpose

Protect v1 from accidental scope expansion while retaining explicit entry criteria for later work. Items here are not partially implemented or implied by current schemas.

## Explicit v1 non-goals

- Complete Scrum compliance or prescriptive ceremonies.
- Multi-user synchronization, permissions, assignments to identity records, or conflict-free collaborative editing.
- Multiple owners per task.
- Hard readiness gates across projects.
- Automatic note repair, migration, cleanup, deletion, or folder restructuring.
- Mirrored task arrays in project, epic, sprint, or source notes.
- Design-document manifests, continuous assembled reading, compilation, or export.
- Recurring tasks, calendar integration, Gantt charts, time tracking, or synthetic velocity forecasting.
- Cloud service, external database, telemetry, account system, or server component.
- Automatic due dates inferred from sprint dates.

## Candidate: multiple owners and team workload

Trigger: repeated real cases where a single owner loses necessary accountability information. Design work must define identity normalization, `owner` to `owners` migration, Any/All filters, backward compatibility, and workload semantics. Migration must be explicit and previewed.

## Candidate: hard cross-project blockers

Trigger: users consistently need portfolio dependencies to prevent task starts. Design must define permissions/ownership of upstream changes, cycle semantics across projects, degraded behavior when a project is absent, and opt-in migration from advisory edges.

## Candidate: design-document manifests and compilation

Trigger: source-document organization with folders/headings/wiki links no longer supports reliable assembled reading. Design must define manifest ownership, ordering, heading extraction, incremental render invalidation, link rewriting, export format, and non-destructive coexistence with ordinary notes.

## Candidate: recurring tasks and calendars

Trigger: demonstrated recurring planning use cases that cannot be handled by templates. Design must define recurrence source of truth, generated-instance identity, timezone/date semantics, edit-series behavior, and duplication prevention before adding calendar UI.

## Candidate: Gantt and time tracking

Trigger: validated scheduling or actual-time decisions that current sprint/status/points data cannot answer. These require explicit start/due/duration/time-entry schemas; UI must not infer them from modification timestamps.

## Candidate: community publication

Trigger: v1 is stable in the originating vault. Work includes generalized paths/templates, onboarding, localization readiness, privacy/security review, public documentation, supported-version policy, and upgrade compatibility. Tethered-specific migration remains an optional/private migration module rather than default product behavior.

## Feature admission checklist

A future feature enters active design only when it has:

- a named user problem and observed examples;
- interaction and Markdown source-of-truth design;
- lifecycle and migration impact assessment;
- mobile/accessibility behavior;
- validation, concurrency, and failure semantics;
- measurable acceptance criteria;
- an explicit v1 compatibility decision.

Until then, the current plugin must preserve unknown fields and ordinary Markdown so users can extend their vault manually without Project Weave claiming ownership.
