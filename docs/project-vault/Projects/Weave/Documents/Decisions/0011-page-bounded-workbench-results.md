---
type: decision
id: "0011"
area: workbench
status: accepted
canonical: false
affects: ["project-workbench"]
---

# ADR 0011: Page within the bounded result window

- Status: accepted
- Date: 2026-08-05
- Owners: Project Weave

## Context

Ready Now and All Tasks each returned the first N results and offered a **Show
more** button that grew N in steps of 25, stopping at 200. The 200 is enforced
by the projection, not the view, so it holds regardless of what the UI asks
for — bounded results are a stated engineering constraint.

The consequence was a dead zone. In a project with 500 tasks the user could
reach the first 200 and no further; the remaining 300 were visible only by
narrowing filters until they happened to fall inside the window. For a long
game project 500 tasks is ordinary, not an edge case. Growing one accumulating
list also renders progressively more rows and loses the reading position on
every index publication.

The agent query API already solved the same problem: it returns a cursor
(`offset:N`) against the same 200-result bound.

## Decision

Keep 200 as the per-request bound and page within it. Both projections take an
offset alongside their existing limit and report `offset`, `pageSize`, and
`total`; the view renders a page-size chooser (10, 25, 50, 100, 200) and
Previous/Next controls with an absolute readout, such as "201–250 of 250
matching tasks".

The offset is a position, not a promise. The projection snaps a requested
offset down to a page boundary and clamps it inside the available results, so
an offset stranded by an edit, a deletion, or a filter change lands on the last
page rather than on an empty one.

Page size and page position are transient view state, like the task filters.
They reset when the project changes or the workspace restores, and they are
never persisted as project data. They deliberately survive an index
publication, so an edit elsewhere in the vault does not throw away the user's
place.

## Alternatives considered

- **Raise or remove the 200 bound, with virtualized rendering:** rejected. It
  abandons a stated constraint and adds rendering machinery to solve a problem
  paging already solves.
- **Keep Show more, continuing past 200 in further steps:** rejected. The list
  grows without limit in the DOM, and the reading position is lost on every
  refresh.
- **Leave the cap and rely on filters:** rejected. It makes reaching a task
  depend on guessing a filter that isolates it.

## Consequences

- Positive: every result is reachable, and the per-request bound is unchanged,
  so the constraint and the agent API keep one story.
- Positive: a page renders a fixed number of rows regardless of project size.
- Negative: reaching a task deep in a large project takes several clicks; a
  jump-to-page control is not implemented.
- Follow-up work: manual check 11f covered 200-result truncation and now needs
  to cover paging past it instead.
