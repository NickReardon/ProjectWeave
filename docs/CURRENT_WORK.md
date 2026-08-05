# Project Weave Current Work

## Purpose

This file records only what commit history cannot: validation evidence,
outstanding manual checks, known loose ends, and the next decision point. For
what changed and why, read the commit history. This is operational context, not
a product contract; `CURRENT-DESIGN.md` owns product precedence.

Write every branch's update as the proposed post-merge handoff: it must be
truthful for the resulting `main` state. Do not record the current branch,
current HEAD, branch hygiene, or the act of merging the branch. Those details
belong in the pull request or task conversation. An exact commit belongs here
only when it identifies immutable evidence, such as the source commit against
which validation ran.

Update this file when verification state, outstanding checks, known loose
ends, or the next decision changes — not for every code change.

## Operational state

- The filterable Project Workbench and the task creation chain — allocation,
  template resolution, proposal, preview, and commit — pass the complete
  automated gate.
- Version 0.3.0 was exported and installed into the configured disposable test
  vault. Some of the focused manual Obsidian checks below have passed against
  that build; each records its own status, and the ones still outstanding mean
  the workbench as a whole is not yet manually accepted.
- **Project Weave now writes to the vault.** Confirming **Create task** in the
  preview modal creates one new note. That is the only write: indexing, plugin
  load, settings changes, navigation, and the dashboard still modify nothing,
  and the write path cannot modify, move, or delete an existing note.
- Task creation is manually accepted. Against a real vault it creates the
  folders it needs, suffixes a colliding name rather than overwriting, refuses
  a commit whose project note changed while the modal was open, and writes a
  note matching its preview byte for byte.
- Task target paths and backlog ranks are now allocated by pure application
  code. ADR 0008 settles the folder convention, filename derivation, collision
  policy, and rank rule that `docs/design/README.md` had left open.
- Local test-vault installation and the preview/stable release workflow are
  documented and automatically exercised. Nothing has been released.
- A disposable test vault can be seeded and reset from the committed fixture,
  so a manual check runs from a known state rather than from whatever the
  previous check left behind. It refuses any directory it did not seed.

## Automated verification

`npm run check` passed on 2026-08-03 against source commit `45f3efd` using
Node.js 24.11.1:

- version records were synchronized at 0.3.0;
- Prettier, ESLint, and `tsc --noEmit` passed;
- 15 Vitest files passed with 135 tests;
- 9 Node script tests passed;
- the production bundle built successfully;
- the release inventory contained exactly `main.js`, `manifest.json`, and
  `styles.css`, with only the expected Obsidian runtime import.

`npm run export` then produced `export/project-weave` and the 52,574-byte
`export/project-weave-0.3.0.zip`. The configured export hook copied the three
runtime files into the disposable test vault. SHA-256 comparison confirmed
that every installed file matched the export, the installed manifest reported
0.3.0, and the vault's existing `data.json` remained present.

The subsequent release-workflow slice exercised `npm run test-vault:update`,
including its failure path. The task files passed a focused Prettier check, and
ESLint, `tsc --noEmit`, all 135 Vitest tests, all 10 Node script tests, the
production build, and release-inventory verification passed independently.
The aggregate check reached the format gate but was stopped by the unrelated
untracked `CLAUDE.md`; this is not recorded as a complete-gate pass.

On 2026-08-03, the merge-stable handoff workflow was verified against source
commit `018012b`. The current-work guard and focused Prettier check passed, as
did ESLint, `tsc --noEmit`, all 135 Vitest tests, all 13 Node script tests, the
production build, and release-inventory verification. The aggregate
`npm run check` passed its version and current-work gates, then stopped at the
same unrelated untracked `CLAUDE.md` formatting issue.

On 2026-08-03, `npm run check` passed in full against source commit `cd886ba`,
which adds task path and rank allocation: version and current-work gates,
Prettier, ESLint, `tsc --noEmit`, 17 Vitest files with 179 tests, 13 Node
script tests, the production build, and a release inventory of exactly
`main.js`, `manifest.json`, and `styles.css`. This is the first complete-gate
pass recorded here; the earlier runs stopped at the untracked `CLAUDE.md`,
which is now tracked and formatted.

Allocation is confirmed absent from `dist/main.js`, so it is tree-shaken out
and the running plugin is unchanged. The proposal service and its seven tests
were not modified by that slice.

On 2026-08-05, `npm run check` passed in full with UI rendering coverage and
the test-vault seeder in place, using Node.js 24.11.1: 23 Vitest files with 244
tests, 26 Node script tests, the production build, and the same three-file
release inventory. The `obsidian` package ships types only, so the suite
aliases it to a test double and installs Obsidian's `HTMLElement` helpers into
a `happy-dom` environment; `happy-dom` is a development dependency and the
shipped bundle is unchanged. Vitest, ESLint, and Prettier all skip `.claude`
and `test-vault`, so another branch's worktree or an installed build cannot be
counted as this tree's result.

Automated validation does not replace the manual Obsidian checks below. The
workbench view now has DOM coverage for the states ordinary use does not reach
— an empty scope, an unavailable restored selection and its recovery, no tasks
versus no filter matches, the 200-result cap in both task sections, and the
stale-last-good banner. The create-task modal has coverage for what it shows
before anything is written — the allocated path and rank, subfolder nesting,
the collision notice, a diagnostic instead of a filename — and for closing on a
successful commit against staying open and explaining a refusal. Those tests
drive the real preview service, so an allocation that is correct but never
reaches the user still fails; the commit runner is a double, so nothing writes.

That covers what the UI draws, not how Obsidian behaves: tab reuse, workspace
restoration, live vault events, layout at width, and mobile remain manual by
nature. The settings tab and the note diagnostic banner still have no DOM
coverage. The pure projection covers project isolation, default and terminal
statuses, blocked-task
discoverability, case-insensitive title/path search, all planning-metadata
filters, injected-date due states, deterministic ordering, and the 200-result
cap.

## Manual checks still required

Use a disposable Obsidian vault populated from `tests/fixtures/vault/` and
verify the checks below. `docs/MANUAL_CHECKS.md` holds the step-by-step
procedure, fixture baseline, and pass criteria for each one, under the same
numbering; this file remains authoritative for whether a check has passed.

1. The ribbon, command palette, and settings button open one reusable Project
   Workbench tab.
2. Obsidian restores the workbench and selected project after workspace reload;
   transient task filters reset rather than becoming project data.
3. With the fixture project selected, **Implement request** is the only Ready
   task and opens in another tab without replacing the dashboard.
4. All Tasks initially shows both todo tasks and **External prerequisite**
   (`in-progress`), while **Define request** (`done`) appears after selecting
   done.
5. Title/path search and combined status, priority, epic, milestone, owner, and
   due-state filters isolate the expected tasks; **Reset filters** restores the
   non-terminal default. Verify **Due today** against the local calendar date.
6. Editing task status, metadata, or dependencies refreshes Ready Now, All
   Tasks, counts, and available filter options after one index publication.
7. An invalid status such as `complete` produces `task.status.invalid` with
   recovery guidance and exact-note navigation; changing it to `done` removes
   the diagnostic.
8. A malformed entity or task without a usable project relationship appears in
   the prominent **Unassigned diagnostics** section with its source-note link
   and error type.
9. Opening an affected note shows its diagnostic banner in editing and reading
   modes; correcting the note removes the banner after index publication.
10. Changing indexed project roots replaces the runtime, shows a rebuilding
    state, and does not publish callbacks from the retired runtime.
11. Multiple-project selection, unavailable restored selection, empty scope,
    stale-last-good state, zero filter matches, 200-result truncation, narrow
    layouts, and a mobile-compatible Obsidian environment remain usable.
12. **Create task** previews a target path under the project's task
    folder, a rank one gap past the largest existing rank, and rendered bytes
    matching both. A subfolder nests, a colliding title yields a numbered
    suggestion with an explicit notice, and an unusable title yields a
    diagnostic. Closing the modal creates nothing.
13. In a disposable vault, creating from both the workbench **New task**
    button and the command palette writes exactly the previewed path
    with the previewed bytes, creates a missing `Tasks` folder, and the new
    task appears in the dashboard after the index refreshes. Editing the
    project note while the modal is open makes the commit refuse with a
    changed-note message and create nothing. No existing note is modified at
    any point.

**Check 13 passed** against a real vault: creating from the workbench works,
the task folder and requested subfolders are created, a duplicate title yields
a suffixed name rather than an overwrite, editing the project note while the
modal is open makes the commit refuse, and the written note matches its
preview byte for byte. Creating from the command palette was fixed during this
check, having previously refused whenever the workbench itself had focus.

Check 12 was exercised only incidentally while running 13, which covered
subfolder nesting and the collision suffix. Its rank derivation and the
diagnostic for an unusable title were not confirmed separately.

**Status as of 2026-08-03: partially complete.** Checks 2, 8, 9, and 10 were
run against the installed 0.3.0 build and passed, with no defects observed:
workspace restoration kept the workbench and selected project while resetting
transient filters, a task with no usable project relationship appeared under
**Unassigned diagnostics**, the note banner rendered in both editing and
reading modes and cleared after correction, and a project-root change rebuilt
without publishing from the retired runtime.

Check 7 was exercised only incidentally, while making a note invalid to set up
check 9: the diagnostic appeared and cleared as expected, but the workbench
listing's recovery guidance and exact-note navigation were not confirmed
separately. Treat it as outstanding.

Checks 1, 3, 4, 5, 6, 11, and 12 remain outstanding. Record their results here
before treating the workbench as manually accepted. Check 11 is the one nobody
has run in Obsidian, and it covers the degenerate states — stale-last-good, an
unavailable restored selection, zero filter matches, 200-result truncation,
narrow layouts, and a mobile-compatible environment. Its rendering is now
automated apart from narrow layouts and mobile, which no harness here reaches;
a disagreement between the automated result and the app is a defect in the test
double and should be recorded as one.

Check 12 is now automated apart from its appearance and feel in Obsidian: the
modal tests assert the previewed path, rank, subfolder nesting, collision
notice, and diagnostic. Run it once to confirm the app agrees.

Ordinary use of the installed 0.3.0 build has surfaced no dashboard problems,
which bears on checks 1 and 3 through 6 in particular. That is supporting
evidence, not a substitute for the list above: the states still unreached by
either ordinary use or the checks run so far are stale-last-good, an
unavailable restored selection, zero filter matches, 200-result truncation,
narrow layouts, and a mobile-compatible environment.

## Known loose ends

Verified against the committed tree; none blocks the manual checks:

- `ObsidianVaultReader.setProjectRoots` is unreachable. Scope changes build a
  replacement runtime in `src/main.ts` instead of mutating the reader.
- The template resolver, proposal service, allocator, renderer, and commit
  coordinator all have a runtime caller through the preview command.
- Only task creation is writable. Editing an existing note, rank rebalancing,
  and further note kinds have no write path, by design.
- The commit coordinator handles exactly one created file. Multi-file
  proposals, and the partial-success reporting design 10 requires for them,
  are not implemented.
- The whitespace-token and subsequence task-search strategies are implemented
  and tested but have no runtime caller; the workbench always uses the
  substring default. Reaching them needs either a changed default or a
  persisted user setting, and the latter is a compatibility surface.
- Search match scores are used only to decide whether a task matches, never to
  order results. Subsequence matching is therefore filter-only until the
  projection sorts by score.
- Allocation covers creation only. Midpoint insertion for reordering and
  Rebalance Backlog Ranks are specified by design 15 but unimplemented; both
  belong to a reorder slice, and rebalance is a previewed bulk write.
- The `Tasks` folder convention from ADR 0008 is fixed. The per-project
  override and the vault-wide setting considered there were deferred until a
  caller needs them.
- The create-task modal is cramped in a narrow pane. Obsidian's `Setting`
  rows keep the label and control side by side at every width, so the
  descriptions compress into tall thin columns rather than the control moving
  below its label. Reconsider the modal's layout or wrapping; it is awkward,
  not broken, and no behavior depends on it.
- The Obsidian test double implements only the surface the workbench view uses,
  and its DOM helpers throw on an unimplemented `createEl` option rather than
  guessing. Extending it is expected as more UI gains coverage; it models
  Obsidian's API, never Obsidian's behavior.
- `templateClockFromLocalDate` exists for a future caller. Nothing calls it
  yet.
- Only `templates/default/task.md` has a consumer. The other packaged starter
  templates remain inputs for later kinds.
- The renderer normalizes CRLF template bodies to LF so identical requests
  render identical bytes.
- A static frontmatter property whose template value is explicitly empty
  renders as `key: null`. Omission is reserved for unset optional placeholders.

## Next decision point

1. Complete and record the manual Obsidian checks above. Record any defects
   before treating the workbench as accepted.
2. Run the outstanding manual Obsidian checks, including the new preview check,
   in one session against a rebuilt test-vault install.
3. Keep further note kinds and any edit path behind a manually accepted task
   creation flow. Multi-file proposals need the partial-success reporting
   design 10 requires before any bulk operation ships.
