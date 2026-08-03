# 05 — Dependencies and Iterations

## Goal

Represent prerequisite work as links, derive readiness consistently, prevent invalid hard-dependency graphs, and create traceable follow-up iterations.

## Dependency model

`depends_on` is a list of wiki links on the dependent task. Reverse dependents are always derived. A task with no dependencies has no `depends_on` key or an empty list; commands SHOULD remove an empty key.

### Hard same-project dependency

For tasks in the same project:

- `done` satisfies the dependency.
- `todo`, `in-progress`, `waiting`, and `review` leave it unsatisfied.
- `cancelled` does not satisfy it and produces a specific cancelled-prerequisite blocker.
- unresolved, ambiguous, or non-task targets are invalid blockers.

An unfinished task is **ready** when it is not `waiting`, all hard dependencies are satisfied, and it has no structural validation error that prevents starting. `in-progress` and `review` tasks are shown as active rather than ready. Terminal tasks are neither ready nor blocked.

### Cross-project dependency

A resolved task in another project is advisory in v1. Its state never gates readiness. It is shown as a warning until done, including when cancelled or unresolved. Cross-project cycles are warning-only because their edges are not hard readiness constraints.

## Add/remove dependency

The UI identifies each candidate's project and status. Adding an edge runs validation against the complete proposed graph.

The command rejects:

- self-dependency;
- duplicate edges;
- a same-project edge that creates a directed cycle;
- a non-task target;
- an unresolved or ambiguous target selected through free-form entry.

Removing an edge affects only the selected task's `depends_on` list. No reverse field is written.

## Cycle detection

Cycle detection runs independently for each project's same-project subgraph using depth-first search or an equivalent linear-time algorithm. Diagnostics include a concrete cycle path. Existing manually authored cycles remain visible but disable start/add-dependency commands for affected tasks until repaired.

## Blocker presentation

For every blocked task, show the direct unsatisfied dependencies first. The UI MAY also show transitive blockers, but labels them as indirect and deduplicates them. A dependency link opens the note. A cancelled prerequisite is visually distinct and offers explicit actions: replace/remove the edge, reopen the prerequisite, or leave the task blocked.

## Create next iteration

The command is available from any canonical task. It creates one new task and never changes the previous task.

Defaults:

- title: previous title with a visible, editable iteration suffix;
- project and epic: carried forward;
- status: `todo`;
- `iteration_of`: existing root when present, otherwise the previous task;
- `iteration`: previous valid iteration plus one, or `2` when the previous task is the root;
- `depends_on`: includes the previous task, plus any additional dependencies the user selects;
- owner and sprint: intentionally blank until selected;
- origin, points, and priority: visible opt-in carry-forward choices, off by default.

The new task body starts empty or from the configured task template; the previous body is not cloned by default.

## Iteration integrity

An iteration root is the first task in a chain. A root MAY omit `iteration_of` and `iteration`, or use `iteration: 1`; parsers normalize both representations in memory. Non-root iterations require a resolvable same-project root and positive integer greater than one. Duplicate iteration numbers, multiple children claiming the same next number, or loops are errors. Previous/next relationships are derived from root and number, never stored as reciprocal fields.

## Acceptance criteria

- Same-project readiness exactly follows dependency states, including cancelled and broken targets.
- Cross-project edges never block starting work in v1 and always expose unresolved work as warnings.
- Self-edges and newly introduced same-project cycles cannot be saved through the UI.
- Existing cycles produce a path-specific diagnostic without changing notes.
- Create Next Iteration produces one valid note, links the root, increments the number, and depends on the immediate previous task.
- Owner and sprint are not silently inherited.
