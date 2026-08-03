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

- **Date:** 2026-08-02
- **Branch:** `main`
- **Commit:** `240da87` — "feat: add project workbench and note diagnostics"
- **Version:** `0.2.0`
- **State:** the second read-only walking slice is committed on `main` with a
  clean working tree. It is automatically verified but not yet manually
  accepted; the Obsidian checks below have not been performed or recorded.
  Nothing has been released.
- **Branch hygiene:** `codex/project-workbench` resolves to the same commit as
  `main` and carries no unmerged work.

## Active slice: persistent Project Workbench

The second read-only walking slice: a persistent Obsidian workbench layered
over the original Ready Now modal, carried by a plugin-lifetime read
publication, a pure snapshot-consistent projection, and live non-writing
diagnostic banners. ADR 0007 records the persistent `ItemView` decision.

Read `git show 240da87` for the contents of the slice and `README.md` for the
resulting user-visible behavior. Neither is restated here.

## Verification evidence

`npm run check` was last run on 2026-08-02 against the committed `240da87`
tree on Node.js 24.11.1, and passed:

- version records synchronized at `0.2.0`;
- Prettier, ESLint, and `tsc --noEmit` passed;
- 9 Vitest files passed with 49 tests;
- 5 Node script tests passed;
- the production bundle built successfully;
- the release inventory contained exactly `main.js`, `manifest.json`, and
  `styles.css`, with only the expected `obsidian` runtime import.

CI runs the same gate on Node.js 22.x and 24.x.

Automated validation does not replace the manual Obsidian checks below. The
Obsidian-facing modules — `src/ui/project-workbench-view.ts`, `src/main.ts`,
`src/ui/settings-tab.ts`, and `src/ui/note-diagnostic-banner.ts` — have no
automated coverage; only the pure projections behind them are tested. Until
the checks below are recorded, no part of this slice has been verified in a
running Obsidian instance.

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

**Status as of 2026-08-02: not started.** None of the checks above has been
performed or recorded. Record results here before treating the slice as
manually accepted.

## Known loose ends

Verified against the committed tree; neither blocks the manual checks:

- `ObsidianVaultReader.setProjectRoots` is unreachable. Scope changes build a
  replacement runtime in `src/main.ts` instead of mutating the reader.
- `templates/default/` has no consumer in `src/`. The files are inputs for the
  future template slice, not current behavior.

## Current product boundary

The plugin remains read-only. Task creation, template rendering, proposal
commits, Plan/Board/My Work perspectives, portfolio views, and agent/MCP
transport are not implemented. Their contracts remain design inputs, not
claims about current code. Note-diagnostic jump-to-field behavior and inline
field highlighting are deferred beyond the first banner pass.

## Next decision point

Complete and record the manual checks above. The slice is committed but not
manually accepted, so the open choice is whether to revise it, release it, or
move on with acceptance still outstanding.

Only after that, select the next implementation slice. The repository does not
designate one of the later slices as next; do not infer that choice from
document numbering.
