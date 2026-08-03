# Project Weave Current Work

## Purpose

This file records only what commit history cannot: validation evidence,
outstanding manual checks, known loose ends, and the next decision point. For
what changed and why, read the branch history — `AGENTS.md` defines the
small-commit workflow that keeps it readable. This is operational context, not
a product contract; `CURRENT-DESIGN.md` owns product precedence.

Update it when verification state, outstanding checks, or the next decision
point changes — not for every change to the code.

## Snapshot

- **Date:** 2026-08-03
- **Branch:** `feat/project-template-map`
- **Commit:** `dad45f0` — "feat(application): propose rendered task creation"
- **Version:** `0.2.0`
- **State:** project task-template resolution and exact non-writing task
  proposals are committed on the feature branch. The workbench still awaits
  the manual Obsidian checks below; the running plugin remains read-only and
  has no creation caller. A read-only, project-scoped All Tasks perspective is
  selected as the next implementation slice. Nothing has been released.
- **Branch hygiene:** `feat/project-template-map` is based on current `main`;
  the committed implementation has no uncommitted code changes. This
  current-work update is the only planned working-tree change.

## Active slices

**Persistent Project Workbench** (`main`, `240da87`): a persistent Obsidian
workbench layered over the original Ready Now modal, carried by a
plugin-lifetime read publication, a pure snapshot-consistent projection, and
live non-writing diagnostic banners. ADR 0007 records the persistent `ItemView`
decision. Automatically verified, not yet manually accepted.

**Task-template rendering foundation** (`main`, `79c274b`): Plan
Addendum 005, Design 18, and ADR 0005 reduced to the smallest useful piece -
parsing, validating, and rendering one task note from a template plus an
injected creation context. Fully covered by automated tests and now consumed
by the application proposal service; it still changes no observable plugin
behavior and needs no manual Obsidian check of its own.

**Task creation proposal foundation** (`feat/project-template-map`,
`dad45f0`): resolves packaged or project-owned task templates, fingerprints
the project and template read set, renders exact frontmatter/content, rejects
target collisions, and returns typed preconditions and expected postconditions.
It exposes no write-capable port and has no runtime UI or agent caller.

Read the branch history for what each slice contains and `README.md` for the
resulting behavior. Neither is restated here.

## Verification evidence

`npm run check` was rerun on 2026-08-03 against `dad45f0` on
`feat/project-template-map` using Node.js 24.11.1, and passed:

- version records synchronized at `0.2.0`;
- Prettier, ESLint, and `tsc --noEmit` passed;
- 15 Vitest files passed with 130 tests;
- 5 Node script tests passed;
- the production bundle built successfully;
- the release inventory contained exactly `main.js`, `manifest.json`, and
  `styles.css`, with only the expected `obsidian` runtime import.

The prior merged-main gate on `79c274b` passed with 13 Vitest files and 113
tests. CI runs the same complete gate on Node.js 22.x and 24.x.

Automated validation does not replace the manual Obsidian checks below. The
Obsidian-facing modules — `src/ui/project-workbench-view.ts`, `src/main.ts`,
`src/ui/settings-tab.ts`, and `src/ui/note-diagnostic-banner.ts` — have no
automated coverage; only the pure projections behind them are tested. Until
the checks below are recorded, no part of the workbench slice has been verified
in a running Obsidian instance.

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

**Status as of 2026-08-03: not started.** None of the checks above has been
performed or recorded. Record results here before treating the slice as
manually accepted.

The renderer, resolver, and proposal service add no manual check. They have no
runtime UI or write access, and their exact outputs and failure modes are
covered by automated tests. They become manually checkable once a creation UI
calls the proposal service.

## Known loose ends

Verified against the committed tree; none blocks the manual checks:

- `ObsidianVaultReader.setProjectRoots` is unreachable. Scope changes build a
  replacement runtime in `src/main.ts` instead of mutating the reader.
- The template resolver and proposal service have no runtime caller. They and
  the renderer are tree-shaken out of `dist/main.js`, so the running plugin
  remains unchanged and read-only even though the application services are
  directly exercised by tests.
- `templateClockFromLocalDate` exists so a future caller has one tested place
  to convert an instant into the renderer's civil clock. Nothing calls it yet.
- Only `templates/default/task.md` has a consumer. The other packaged starter
  templates remain inputs for later kinds, and only the task template's
  embedded copy is checked against its file.
- The renderer normalizes CRLF template bodies to LF so identical requests
  render identical bytes. This is deliberate and asserted, but it means a
  CRLF-authored template does not round-trip its line endings.
- A static frontmatter property whose template value is explicitly empty
  renders as `key: null` rather than being dropped. Omission is reserved for
  unset optional placeholders, so an author's explicit empty value is not
  silently discarded.

## Current product boundary

The plugin remains read-only. Project task-template resolution, template
fingerprinting, and exact one-file task proposals are implemented, but no
runtime caller, path/rank allocator, preview/confirmation UI, or write
coordinator exists. Rendering and proposal construction cover the task kind
only; epics, milestones, planning periods, and documents are not supported.
Their contracts remain design inputs, not claims about current code.
Note-diagnostic jump-to-field behavior and inline field highlighting are
deferred beyond the first banner pass.

## Next decision point

The next implementation sequence was selected on 2026-08-03:

1. Complete and record the manual Obsidian checks above. The workbench slice
   is committed but not manually accepted. Record any defects before extending
   the view.
2. Add a read-only, project-scoped **All Tasks** perspective to the persistent
   workbench before adding creation UI or write support. Every valid task must
   be discoverable regardless of status or readiness. The default view shows
   non-terminal work (`backlog`, `todo`, `in-progress`, `waiting`, and
   `review`); `done` and `cancelled` remain available through explicit status
   filtering in keeping with Design 16's hidden-by-default terminal history.
3. The first usable slice provides status filtering and text search,
   deterministic bounded results, exact-note navigation that preserves the
   workbench, and live refresh from one immutable publication. Follow-on
   filters add priority, epic, milestone, owner, and due state without mixing
   projects or storing derived task-list state.
4. Resume the task-creation vertical after basic task discoverability exists.
   The current proposal still needs typed path/rank allocation, a preview and
   confirmation caller, and a write coordinator with commit-time stale-read
   checks. Keep further note kinds behind a complete task flow.
