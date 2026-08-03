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
- **Branch:** `main`
- **Commit:** `79c274b` — "fix(domain): enforce template creation contracts"
- **Version:** `0.2.0`
- **State:** the persistent Project Workbench and deterministic task-template
  rendering foundation are merged on `main`. The workbench still awaits the
  manual Obsidian checks below; the renderer is automatically verified and has
  no caller. Nothing has been released, and the working tree is clean.
- **Branch hygiene:** `feat/task-template-renderer` is fully merged into
  `main` and carries no unmerged work.

## Active slices

**Persistent Project Workbench** (`main`, `240da87`): a persistent Obsidian
workbench layered over the original Ready Now modal, carried by a
plugin-lifetime read publication, a pure snapshot-consistent projection, and
live non-writing diagnostic banners. ADR 0007 records the persistent `ItemView`
decision. Automatically verified, not yet manually accepted.

**Task-template rendering foundation** (`main`, `79c274b`): Plan
Addendum 005, Design 18, and ADR 0005 reduced to the smallest useful piece —
parsing, validating, and rendering one task note from a template plus an
injected creation context. Fully covered by automated tests; it has no caller,
so it changes no observable plugin behavior and needs no manual Obsidian check
of its own.

Read the branch history for what each slice contains and `README.md` for the
resulting behavior. Neither is restated here.

## Verification evidence

`npm run check` was rerun on 2026-08-03 against the merged `main` tree
containing `79c274b` on Node.js 24.11.1, and passed:

- version records synchronized at `0.2.0`;
- Prettier, ESLint, and `tsc --noEmit` passed;
- 13 Vitest files passed with 113 tests;
- 5 Node script tests passed;
- the production bundle built successfully;
- the release inventory contained exactly `main.js`, `manifest.json`, and
  `styles.css`, with only the expected `obsidian` runtime import.

The previous gate on `240da87` passed with 9 Vitest files and 49 tests. CI runs
the same gate on Node.js 22.x and 24.x.

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

The task-template renderer adds no manual check. It has no UI, no vault
access, and no caller, and its output is asserted byte-for-byte in tests. It
becomes manually checkable only once a creation flow calls it.

## Known loose ends

Verified against the committed tree; none blocks the manual checks:

- `ObsidianVaultReader.setProjectRoots` is unreachable. Scope changes build a
  replacement runtime in `src/main.ts` instead of mutating the reader.
- `src/domain/templates/` has no caller. It is tested but tree-shaken out of
  the production bundle; `dist/main.js` contains none of its strings, so the
  released plugin is unchanged by it.
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

The plugin remains read-only. Template rendering exists as a pure core
service, but task creation, project template-map resolution, template
fingerprinting, proposal commits, Plan/Board/My Work perspectives, portfolio
views, and agent/MCP transport are not implemented. Rendering covers the task
kind only; epics, milestones, planning periods, and documents are not
supported. Their contracts remain design inputs, not claims about current
code. Note-diagnostic jump-to-field behavior and inline field highlighting are
deferred beyond the first banner pass.

## Next decision point

Two open choices, in order.

1. Complete and record the manual Obsidian checks above. The workbench slice
   is committed but not manually accepted, so the choice is whether to revise
   it, release it, or move on with acceptance outstanding.
2. Decide what consumes the renderer. It is deliberately callerless, and the
   candidates differ in what they force next: resolving a project's template
   map (Design 18), allocating a safe target path and rank, or building the
   proposal and write-coordination contract (Design 10). Pick one before
   extending the renderer to further note kinds — more kinds add breadth to an
   interface nothing has exercised yet.

The repository does not designate one of the later slices as next; do not
infer that choice from document numbering.
