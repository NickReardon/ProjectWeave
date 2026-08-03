# Project Weave Current Work

## Purpose

This is the handoff for the active working tree. It records implementation
state, validation evidence, remaining checks, and the next decision point. It
is operational context, not a product contract; `CURRENT-DESIGN.md` owns
product precedence.

Update this file whenever the active slice or its verification state changes.

## Snapshot

- **Date:** 2026-08-02
- **Branch:** `codex/project-workbench`
- **Version:** `0.2.0`
- **State:** the second read-only walking slice is implemented in an
  uncommitted working tree. Preserve these changes and do not assume they are
  approved for commit or release.

## Active slice: persistent Project Workbench

The working tree extends the original Ready Now modal with a persistent,
read-only Obsidian workbench:

- a plugin-lifetime read-publication layer that survives indexing-runtime
  replacement;
- a pure, snapshot-consistent workbench projection;
- a persistent project workbench view with explicit project selection;
- project summary counts, bounded Ready Now results, and bounded project and
  unassigned diagnostics;
- live, non-writing diagnostic banners above affected Markdown notes;
- exact-note navigation that leaves the dashboard open;
- ribbon, command-palette, and settings entry points;
- workspace-restored selected-project state;
- updated styling, documentation, version metadata, parser validation, and
  focused application/unit tests;
- ADR 0007 documenting the persistent `ItemView` decision.

The main active files are `src/application/project-weave-read-source.ts`,
`src/application/project-workbench-model.ts`,
`src/ui/project-workbench-view.ts`, `src/main.ts`, `styles.css`, their focused
tests, and the associated documentation and version files.

## Verification evidence

The latest `npm run check` passed on 2026-08-02:

- version records synchronized at `0.2.0`;
- Prettier, ESLint, and `tsc --noEmit` passed;
- 9 Vitest files passed with 49 tests;
- 5 Node script tests passed;
- the production bundle built successfully;
- the release inventory contained exactly `main.js`, `manifest.json`, and
  `styles.css`, with only the expected `obsidian` runtime import.

Automated validation does not replace the manual Obsidian checks below.

## Manual checks still required

Use a disposable Obsidian vault populated from `tests/fixtures/vault/` and
verify:

1. The ribbon, command palette, and settings button open one reusable Project
   Workbench tab.
2. Obsidian restores the workbench and its selected project after workspace
   reload.
3. With the fixture project selected, **Implement request** is the only Ready
   task and opens in another tab without replacing the dashboard.
4. Editing task status or dependencies refreshes Ready Now after index
   publication.
5. An invalid status such as `complete` produces `task.status.invalid` with
   recovery guidance and exact-note navigation; changing it to `done` removes
   the diagnostic.
6. A malformed entity or task without a usable project relationship appears in
   the prominent **Unassigned diagnostics** section with its source-note link
   and error type.
7. Opening an affected note shows its diagnostic banner in editing and reading
   modes; correcting the note removes the banner after index publication.
8. Changing indexed project roots replaces the runtime, shows a rebuilding
   state, and does not publish callbacks from the retired runtime.
9. Multiple-project selection, unavailable restored selection, empty scope,
   stale-last-good state, narrow layouts, and a mobile-compatible Obsidian
   environment remain usable.

Record results here before treating the slice as manually accepted.

## Current product boundary

The plugin remains read-only. Task creation, template rendering, proposal
commits, Plan/Board/My Work perspectives, portfolio views, and agent/MCP
transport are not implemented. Their contracts remain design inputs, not
claims about current code. Note-diagnostic jump-to-field behavior and inline
field highlighting are deferred beyond the first banner pass.

## Next decision point

First review and complete the manual checks for the Project Workbench slice.
Then decide whether to revise it, commit/release it, or select the next
implementation slice. The repository does not currently designate one of the
later slices as next; do not infer that choice from document numbering.
