---
type: decision
id: "0002"
area: workflow
status: accepted
canonical: false
affects: ["16", "00", "14"]
---

# ADR 0002: Make v1 single-project-first with progressive workflow

- Status: accepted
- Date: 2026-08-02
- Owners: Project Weave

## Context

The earlier plan included portfolio dashboards and portfolio sprints while leaving the central design-to-task workflow comparatively thin. The intended user is a solo developer or small team building a substantial project such as a game. They need traceability and order without being forced into every available project-management practice.

## Decision

V1 centers on one selected project and the loop from Markdown design to task drafts, backlog, board, dependencies, Ready Now, and My Work.

Add `backlog` as the non-board task status. Make advanced fields and process policies optional with progressive disclosure. Preserve multi-project recognition and switching, but defer portfolio planning and hard cross-project behavior.

The design must scale to thousands of task notes through incremental indexing, focused queries, and bounded rendering.

## Alternatives considered

- **Portfolio-first v1:** rejected because it increases concepts and UI before the primary single-project loop is proven.
- **Mandatory Scrum workflow:** rejected because sprints, points, and ceremonies are not needed by every solo developer or team.
- **One giant Kanban containing all open work:** rejected because long projects need a backlog/board focus boundary.
- **Separate board-membership field:** rejected because `backlog -> todo` expresses the boundary with fewer concepts.
- **Automatic task synchronization from design prose:** rejected because design changes require human judgment and must not silently rewrite execution work.

## Consequences

- Positive: initial use requires almost no process configuration.
- Positive: the same model can grow from a solo prototype into a long-running small-team game project.
- Positive: dependencies plus rank provide understandable order of operations.
- Negative: earlier portfolio designs become deferred references rather than v1 implementation contracts.
- Negative: adding `backlog` requires every status parser, view, command, migration mapping, and test to distinguish planned work from board work.
- Follow-up: implement Plan, Board, and My Work as the first vertical slice before sprints or portfolio UI.
