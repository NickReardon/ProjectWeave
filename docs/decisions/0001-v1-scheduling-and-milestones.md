---
type: decision
id: "0001"
area: scheduling
status: accepted
canonical: false
affects: ["15"]
---

# ADR 0001: Add basic scheduling and milestone features to v1

- Status: accepted
- Date: 2026-08-02
- Owners: Project Weave

## Context

The initial design covered agile execution but could not reliably represent project lifecycle, manual backlog order, controlled priority, task deadlines, actual completion time, or dated cross-sprint outcomes. Those gaps made several planned dashboard/workbench behaviors ambiguous.

## Decision

V1 will include:

- optional project status with `planned`, `active`, `paused`, `completed`, `cancelled`, and `archived` values;
- optional positive-integer task rank with gap-based ordering and explicit rebalance;
- optional controlled task priority values `critical`, `high`, `normal`, and `low`;
- optional task `due_date` as a local `YYYY-MM-DD` date;
- `completed_at` plus reopen history for tasks transitioned to done;
- a canonical project-scoped `milestone` note and optional task-to-milestone link.

The complete behavioral contract is `docs/spec/15-scheduling-and-milestones.md`.

## Alternatives considered

- **Use dependencies as ordering:** rejected because sequencing preference is not always a prerequisite.
- **Use file modification time for completion:** rejected because unrelated edits make it unreliable.
- **Represent milestones only as tasks:** rejected because dated outcomes may span epics/sprints and need their own lifecycle.
- **Store overdue as a status:** rejected because overdue is derived from date and terminal state.
- **Automatically normalize ranks:** rejected because passive/bulk content rewrites violate the lifecycle contract.

## Consequences

- Positive: core planning and reporting have explicit, testable source data.
- Positive: existing notes without the optional fields remain readable without migration.
- Negative: the entity/index/view surface and test matrix grow before the first runtime slice.
- Negative: rank rebalancing and reopen history require safe multi-field/bulk write handling.
- Follow-up: update the original plan and existing feature designs to reference Design 15 wherever these fields affect behavior.
