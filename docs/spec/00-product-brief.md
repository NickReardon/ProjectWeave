---
type: spec
area: product
status: current
canonical: true
related_decisions: ["0002"]
---

# Project Weave v1 Product Brief

## Product promise

Project Weave is a streamlined, Markdown-first Obsidian project workspace for a single developer or small team working on one substantial, long-lived project—such as a game.

It connects design thinking to execution: develop or revise a design, break it into linked tasks, order work with rank and dependencies, move selected tasks from backlog onto a simple board, and let each person see what they can do next.

## Primary users

- A solo developer designing and building a long project over months or years.
- A small multidisciplinary team sharing an Obsidian vault and needing clear ownership, relationships, and next actions without project-administration overhead.

## Core user loop

1. Write or revise a design in ordinary Markdown.
2. Open Project Weave's Plan view from the design or project.
3. Create one or several task drafts linked to the relevant design headings.
4. Edit, rank, group, and connect those tasks with dependencies.
5. Confirm them into the project backlog.
6. Move chosen backlog tasks to the board.
7. Work from Ready Now or My Work, with blockers and downstream work visible.
8. Complete, reopen, revise, or add tasks as the design evolves.

## Product principles

### One project at a time

Every work view has one explicit project context. The vault may contain multiple projects and the user can switch between them, but v1 does not require portfolio planning or cross-project coordination.

### Progressive disclosure

The minimum task needs only type, project, and status. Epics, milestones, sprints, points, owners, priorities, due dates, iterations, and dependency enforcement appear only when the project uses or enables them.

### Separate integrity from process

Project Weave always protects data integrity: safe writes, valid relation targets, no self-dependencies, no same-project cycles created through the UI, and no silent overwrite. It does not require estimation, assignment, sprints, ceremonies, WIP limits, or due dates unless the project opts into those policies.

### Design remains design

Source documents are ordinary Markdown. Task creation records origin links but never inserts task lists into or automatically rewrites the design. Changing a design exposes its related tasks for review; it does not silently regenerate them.

### Scale by focus, not ceremony

Long projects stay usable through backlog-versus-board separation, epics and milestones, filters, search, incremental indexing, virtualized lists, and hidden-by-default terminal history—not mandatory sprints or portfolio layers.

## Minimum workflow

The default task statuses are:

```text
backlog -> todo -> in-progress -> done
```

`waiting`, `review`, and `cancelled` remain supported and appear when used. A task created from design defaults to `backlog`; a task created directly on the board defaults to `todo`. “Add to Board” changes backlog to todo.

Dependencies communicate order. Manual rank orders tasks that could otherwise be done in parallel. Ready Now consists of board tasks whose same-project dependencies are satisfied, sorted by rank and then priority/path.

## Long-project organization

- **Design notes:** intent, requirements, decisions, and evolving specifications.
- **Epics:** substantial systems or outcomes such as combat, traversal, or save/load.
- **Milestones:** dated outcomes such as prototype, vertical slice, demo, alpha, or release.
- **Tasks:** concrete units of execution.
- **Optional sprints:** short planning windows when useful, never required for board use.
- **Terminal history:** completed/cancelled notes remain searchable Markdown and are excluded from ordinary focus views by default.

## Multi-project boundary

V1 supports project recognition, switching, isolated project views, and advisory cross-project links. It defers portfolio sprints, combined workload planning, portfolio health scoring, cross-project critical paths, and hard cross-project blockers.

## Success criteria

A new user can, without configuring an agile process:

- create a project and design note;
- turn headings into editable linked tasks;
- establish an order with rank and dependencies;
- move chosen work onto the board;
- identify ready, active, blocked, and downstream work;
- filter My Work using a local owner identity;
- revise designs and related tasks without losing Markdown history;
- operate a fixture containing thousands of tasks without loading every card into the DOM or rescanning the entire vault for one changed note.

## Explicit non-goals for v1

- Full Scrum enforcement.
- Portfolio management as a primary workflow.
- Live collaboration, accounts, permissions, or a server database.
- Automatic AI task generation or automatic synchronization from design prose.
- Required owners, points, due dates, milestones, or sprints.
- Gantt, budget, procurement, time tracking, or enterprise reporting.
