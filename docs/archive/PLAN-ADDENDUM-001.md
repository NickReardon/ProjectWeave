---
type: archive
status: archived
canonical: false
---

# Project Weave Plan Addendum 001

> **Archived and non-authoritative.** This document is history. Current
> behavior is defined in [`docs/spec/`](../spec/README.md); see
> [the archive index](README.md).

## Status

Accepted on 2026-08-02. This addendum is part of the v1 implementation plan and supersedes earlier plan/design statements that leave these capabilities absent or undecided.

The normative behavior is defined in [Design 15](../spec/15-scheduling-and-milestones.md), with rationale in [ADR 0001](../decisions/0001-v1-scheduling-and-milestones.md).

## Approved v1 additions

1. **Project lifecycle:** optional `status` with `planned`, `active`, `paused`, `completed`, `cancelled`, and `archived`. Missing status displays as active for compatibility; passive indexing never writes it.
2. **Stable backlog rank:** optional positive integer `rank`, ordered ascending per project with spaced values and an explicit previewed rebalance when gaps are exhausted.
3. **Controlled priority:** optional `priority` with `critical`, `high`, `normal`, and `low`; missing priority displays as normal.
4. **Task due date:** optional local calendar `due_date` in `YYYY-MM-DD`; overdue is derived for non-terminal tasks.
5. **Completion time:** tasks transitioned to done receive `completed_at`; reopening preserves the prior timestamp in `completion_history` and clears the current completion.
6. **Milestones:** canonical `type: milestone` notes with one project, `planned`/`achieved`/`cancelled` status, required due date, optional owner/origin, and task membership derived from optional task `milestone` links.

## Plan-wide effects

- The in-memory index adds milestones, project lifecycle projections, ranked task ordering, due-state derivation, and completion/achievement history parsing.
- Project and portfolio dashboards add lifecycle filters plus upcoming/overdue milestones and due/overdue task sections.
- Project workbenches add ranked backlog reordering, milestone and due-soon perspectives, controlled priority filters, and trustworthy recently completed ordering.
- Task create/edit/navigation adds milestone, rank, priority, and due-date behavior.
- New commands manage project status, rank/rebalance, milestone lifecycle/membership, task priority, and task due date.
- Validation and safe-write proposals cover every new controlled value, relation, date, timestamp, rank, history record, and bulk rebalance.
- Fixture and automated tests cover missing-field compatibility, local-date boundaries, reopen history, milestone membership, terminal project warnings, and full-versus-incremental index equivalence.

## Preserved invariants

- Markdown remains canonical.
- Missing optional fields never cause passive normalization.
- Priority, rank, due date, and milestone never alter dependency readiness.
- Project and milestone terminal transitions never mutate child tasks.
- Membership is derived from task links; no mirrored task arrays are added.
- Every rank rebalance or other multi-file change is previewed and confirmed under the safe-write contract.
