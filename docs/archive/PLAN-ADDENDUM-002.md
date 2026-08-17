---
type: archive
status: archived
canonical: false
---

# Project Weave Plan Addendum 002

> **Archived and non-authoritative.** This document is history. Current
> behavior is defined in [`docs/spec/`](../spec/README.md); see
> [the archive index](README.md).

## Status

Accepted product-direction clarification. This addendum and [the v1 product brief](../spec/product-brief.md) take precedence over earlier portfolio-first or ceremony-heavy interpretations in `PLAN.md` and feature designs.

## Revised v1 center

Project Weave is single-project-first but suitable for a large, long-running project such as a game. The primary workflow is:

```text
Markdown design
  -> linked task drafts
  -> ranked/dependency-aware backlog
  -> selected work on a simple board
  -> Ready Now / My Work
  -> completion, revision, and preserved history
```

## Minimum enforced schema

A canonical task requires only:

```yaml
type: task
project: "[[Project]]"
status: backlog
```

Title may fall back to the filename. All other supported task fields are optional unless an enabled project policy explicitly requires them.

Task status adds `backlog` to the previously designed values. Backlog tasks are planned but not on the active board. The default creation-from-design flow produces backlog tasks; Add to Board changes them to `todo`.

## Optional capability rule

- Epics, milestones, sprints, estimates, owners, priorities, due dates, iterations, and provenance are available without becoming mandatory.
- Empty/unused capabilities do not create warnings, empty navigation, required setup, or dashboard noise.
- Advanced controls live under progressive disclosure and become prominent when the current project already uses them.
- Project-level enforcement policies are absent/off by default and stored in the project note when explicitly enabled so a small team shares the same rules.

## Always-on integrity rules

Optional process does not make data integrity optional. Project Weave always enforces safe-write concurrency, target type/project consistency for relations, valid values when a field is present, self-dependency rejection, and rejection of newly created same-project cycles.

Dependency start behavior is advisory by default and may be changed to enforced per project. Cross-project dependencies remain advisory in all v1 modes.

## Core views

1. **Plan:** design context, related existing tasks, editable multi-task drafting, ranked backlog, and dependency order.
2. **Board:** only committed board work by default, with minimal columns and optional states shown when used.
3. **My Work:** locally configured owner filter showing ready, active, waiting/review, and blocked tasks.
4. **Milestones/Epics:** optional focus views for organizing long projects.
5. **History/Search:** terminal tasks remain searchable but do not flood operational views.

## Multi-project reduction

V1 retains multiple project notes, project switching, isolated indexes/views, and visible advisory cross-project links. The following move beyond core v1:

- portfolio sprints;
- portfolio dashboard health calculations;
- combined cross-project boards or backlogs;
- cross-project capacity/workload planning;
- hard cross-project dependency gating;
- cross-project critical path or automatic sequencing.

A lightweight project switcher/home may show project status and counts, but all planning and execution happens inside one selected project.

## Long-project requirements

- Incremental indexing and targeted graph recomputation after a single-note edit.
- Virtualized or paged rendering for large task collections.
- Filters by epic, milestone, owner, status, priority, due state, and text.
- Default exclusion of old terminal work with explicit history/search access.
- Stable ranking and preserved dependency/iteration history.
- No automatic content normalization or archival moves.

## Normative interaction design

Detailed behavior and acceptance criteria are in [Streamlined long-project workflow](../spec/streamlined-long-project-workflow.md).
