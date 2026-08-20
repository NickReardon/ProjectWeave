---
type: decision
id: "0007"
area: workbench
status: accepted
canonical: false
affects: ["project-workbench"]
---

# ADR 0007: Use a persistent Obsidian workbench view

- Status: accepted
- Date: 2026-08-02
- Owners: Project Weave

## Context

Ready Now proved the indexing and dependency rules through a modal, but the
primary product needs a dashboard that stays open while task notes are viewed.
The view must survive Obsidian workspace restoration, preserve an explicit
project choice, remain consistent to one index revision, and keep updating when
project-folder settings replace the indexing runtime.

## Decision

- Implement the first Project Workbench as a custom, mobile-safe Obsidian
  `ItemView` with the stable type `project-weave-workbench`.
- Register the view before layout readiness, but do not open it automatically.
  A ribbon action, command, or settings button opens one reusable workspace tab;
  Obsidian may restore that tab afterward.
- Persist only a version and selected canonical project path in workspace view
  state. Never persist task data, counts, readiness, or index revisions.
- Project the complete visible dashboard synchronously from one immutable read
  publication. Use a plugin-lifetime read source to bridge coordinator
  replacements and bind every publication's query API to that exact snapshot.
- Preserve an unavailable explicit project selection after scope changes and
  ask the user to choose; never silently guess another project when several
  exist.
- Open task cards only when the exact vault file exists, in a separate tab, so
  navigation neither replaces the dashboard nor creates a missing note.

## Alternatives considered

- **Keep the Ready Now modal as the primary UI:** rejected because it does not
  support an always-available planning surface or project switching.
- **Generate a dashboard Markdown note:** rejected because derived task
  membership would become duplicated persisted state and require content
  writes.
- **Bind each view directly to an IndexCoordinator:** rejected because changing
  indexed roots disposes that coordinator and would strand restored views on an
  obsolete snapshot.
- **Open the workbench on every plugin load:** rejected because enabling a
  plugin should not unexpectedly replace or add to the user's workspace.

## Consequences

- Positive: users can keep Ready Now visible, switch projects, and open task
  notes without rerunning a command.
- Positive: view refreshes and runtime replacement cannot mix data from
  different index revisions.
- Negative: a custom view needs explicit rendering, responsive styling, state
  parsing, and manual Obsidian baseline testing.
- Follow-up: add Plan, Board, Blocked, and My Work perspectives through the same
  projection/read-publication boundary rather than introducing view-owned task
  state.
