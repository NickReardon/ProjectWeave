---
type: archive
status: archived
canonical: false
---

# Project Weave Plan Addendum 003

> **Archived and non-authoritative.** This document is history. Current
> behavior is defined in [`docs/spec/`](../spec/README.md); see
> [the archive index](README.md).

## Status

Accepted clarification of dependency, planning-period, and estimation defaults. This addendum corrects any contrary default in earlier addenda/designs.

## Dependencies

Same-project dependencies are enforced by default. Adding `B depends_on A` explicitly opts into the rule that B cannot move to `in-progress` until A is `done`.

A project may explicitly choose advisory dependencies; in that mode Project Weave shows blockers and requires acknowledgement but permits the transition. Cross-project dependencies remain advisory in every v1 mode.

## Planning periods

Timeboxed planning remains supported but optional. The project may display the feature as **Sprint**, **Cycle**, or **Period** while retaining one stable Markdown schema.

- The board works with no planning period.
- A task may be assigned to at most one current planning period.
- Goals, dates, activation, commitment totals, guided closing, and task history are available when the project uses planning periods.
- Portfolio-scoped planning periods are outside the single-project v1 core.

## Estimates

Positive-integer points remain a supported optional task estimate.

- Estimates can be used with or without planning periods.
- A missing estimate never makes an ordinary task invalid.
- Totals always disclose estimated task count and unestimated task count.
- Missing-estimate warnings or requirements occur only when the project explicitly enables an estimation policy.
- Priority, due date, rank, and estimates never affect dependency readiness.
