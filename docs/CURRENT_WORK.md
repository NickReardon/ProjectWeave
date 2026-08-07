---
type: status
status: current
canonical: false
---

# Project Weave Current Work

## Purpose

This file records only what commit history cannot: validation evidence,
outstanding manual checks, known loose ends, and the next decision point. For
what changed and why, read the commit history. This is operational context, not
a product contract; `docs/spec/` is the canonical statement of intended
behavior.

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
- Version 0.5.0 was exported and installed into the configured disposable test
  vault, replacing the 0.4.0 build the earlier checks ran against. It is the
  first installed build carrying project creation, the vault template catalog
  and chooser, and task categories. Each check below records its own status,
  and the ones still outstanding mean the workbench as a whole is not yet
  manually accepted.
- 0.5.0 takes the minor position because three feature slices landed since the
  version was last set: project creation through the UI, the layered template
  catalog with its chooser, and task categories — the last of which adds both a
  frontmatter field and a diagnostic code. Any one of those is a minor by the
  sizing rule in `docs/development/release.md`. Nothing has been released; the
  major position stays reserved for the first stable release against the full
  specification.
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
  policy, and rank rule that `docs/spec/README.md` had left open.
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

On 2026-08-05, `npm run check` passed in full against source commit `b8eb7bc`
using Node.js 24.11.1: version records synchronized at 0.4.0, the current-work
gate, Prettier, ESLint, `tsc --noEmit`, 23 Vitest files with 249 tests, 28 Node
script tests, the production bundle, and a release inventory of exactly
`main.js`, `manifest.json`, and `styles.css`.

`npm run export` then produced `export/project-weave` and the 67,571-byte
`export/project-weave-0.4.0.zip`, and the configured export hook installed the
three runtime files into the disposable test vault. SHA-256 comparison
confirmed each installed file matched the export, and the installed manifest
reported 0.4.0. Reseeding that vault dated the fixture tasks correctly for the
day it ran; it reported, and left in place, several notes an earlier manual
session created.

On 2026-08-06, `npm run check` passed in full against source commit `8dcfcb0`
using Node.js 24.19.0 — the first complete-gate pass covering project creation,
the vault template catalog and chooser, and task categories: version records
synchronized at 0.4.1, the current-work gate, Prettier, ESLint, `tsc --noEmit`,
28 Vitest files with 324 tests, 28 Node script tests, the production bundle,
and a release inventory of exactly `main.js`, `manifest.json`, and
`styles.css`, with only the expected Obsidian runtime import.

`npm run export` then produced `export/project-weave` and the 71,902-byte
`export/project-weave-0.4.1.zip`, and `npm run test-vault:setup` seeded a fresh
`test-vault/` and installed the three runtime files. SHA-256 comparison
confirmed each installed file matched the export, and the installed manifest
reported 0.4.1. That vault was seeded clean, so unlike the previous one it
carries no notes left behind by an earlier manual session.

A review of the task-category slice against that build produced three findings,
all since addressed: the index-level category diagnostic was folded into an
entity record that the final assembly discards, so the code named a mechanism
that does not carry it; adding or removing a task category was the only
settings control that failed silently, because both handlers omitted the
try/catch every sibling has; and ADR 0014 never stated that the creation path
does not check the vocabulary. The first two were fixed, the third recorded in
the ADR. A further complete `npm run check` passed over all three.

The version then took the minor position for the three feature slices it had
been trailing. `npm run export` produced the 71,895-byte
`export/project-weave-0.5.0.zip`, and `npm run test-vault:update` installed it
into the same seeded vault: SHA-256 comparison confirmed each installed file
matched the export, and the installed manifest reported 0.5.0. That is the
build the outstanding manual checks run against.

Automated validation does not replace the manual Obsidian checks below. The
workbench view now has DOM coverage for the states ordinary use does not reach
— an empty scope, an unavailable restored selection and its recovery, no tasks
versus no filter matches, the 200-result cap in both task sections, paging past
it by page number, and the stale-last-good banner. The create-task modal has coverage for what it shows
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

`docs/development/testing.md` holds the step-by-step procedure, fixture baseline, and
pass criteria for each numbered check; this file remains authoritative for
whether one has passed. Run them against a disposable vault seeded from
`tests/fixtures/vault/`.

**Checks 1, 2, 3, 4, 6, 7, 8, 9, 10, 12, and 13 have passed.** The first nine
are not restated here — entry points and tab reuse, workspace restoration,
Ready Now, the default status scope, live refresh, the invalid-status
diagnostic, unassigned diagnostics, the note banner, and changing indexed
project roots. Checks 2, 8,
9, and 10 ran against 0.3.0; the rest in a session on 2026-08-05. Nothing in
0.4.0 through 0.5.0 changes what any of them exercises. The two cosmetic defects
that came out of that session were fixed and have since been confirmed in the
app. Reopen any of these only if a later change touches what it covers.

**Checks 12 and 13 — create task — passed in two parts.** Every branch — preview
path and rank, subfolder nesting, the collision suggestion, an unusable title,
the changed-note refusal, a missing `Tasks` folder, both entry points, and
written bytes matching the preview — passed against 0.3.0, which found and
fixed a defect worth not losing: creating from the command palette used to
refuse whenever the workbench itself had focus. ADR 0010 then changed the
frontmatter of every created task, and ordinary creation was confirmed working
against the 0.4.0 build that carries it. The branches were not re-walked after
ADR 0010; the modal tests drive the real preview service through all of them,
and ADR 0010 changes rendered bytes rather than which branch is taken, so this
is accepted on that basis rather than re-run.

**Check 5 — search and the advanced filters — has passed**, in a session on
2026-08-06 against the installed 0.4.1 build. The due states were the part
still outstanding, and all four matched exactly one task against the local
calendar date: past due, due today, future, and undated. The category filter
isolated the fixture's `bug` task.

One part of it did not run: the **category vocabulary**. Configuring `bug` and
`chore` under **Settings → Task categories**, setting the task to `feature`,
confirming `task.category.invalid` names the allowed values while the note is
left unchanged, confirming the selector still offers both a declared-but-unused
value and an undeclared one in use, then clearing the list and watching the
diagnostic go — none of that has run against any build. `updateTaskCategories`
persists unconditionally, so a vault that has ever configured a vocabulary has
a `data.json`; the test vault has none, which is how this was identified as
unrun rather than passed. It is the only runtime path of ADR 0014 with no
manual confirmation, and it now also covers the settings error handling added
after the review.

**Both cosmetic focus defects have passed.** A status checkbox and the **New
task** button no longer stay lit after a mouse click, and the keyboard focus
ring is intact.

Outstanding, all runnable against the installed 0.5.0 build:

- **Check 11 — degenerate states.** 11a (multiple projects) passed. 11d (stale
  last good) needs an index rebuild that throws, which ordinary use does not
  produce, and was not reached. 11b, 11c, 11e, 11f, and 11g are unrecorded, and
  11f now covers paging and the **Page** field rather than truncation, so it is
  outstanding on its new terms regardless. Everything here except narrow
  layouts is automated; a disagreement between the automated result and the app
  is a defect in the test double and should be recorded as one.
- **The category vocabulary part of check 5**, described above.

Those two, and checks 15 and 16 below, are what desktop acceptance is
waiting on. Task creation is
manually accepted, so the write path is no longer gated behind it.

**Check 16 — task templates — is new and unrun.** Put a
`task/bug.md` under the template library folder, confirm it appears in the
create-task modal's **Template** chooser, that selecting it changes the
previewed bytes, that a project mapping for the same variant wins over it, that
a deliberately broken one shows its diagnostic and refuses rather than falling
back, and that **Packaged minimal** always renders the packaged template. With
only one variant, no chooser should appear at all.

**Check 15 — create project — is new and unrun.** Project creation reaches the
vault through the same commit path task creation does, and its preview and
modal have automated coverage, but nothing has exercised it in Obsidian. Run
it in a disposable vault: the target path under an indexed folder, a title
matching an existing folder yielding a numbered folder with a notice, an
unusable title yielding a diagnostic, the created project appearing in the
workbench picker after the index refreshes, a task created in it landing under
its own `Tasks` folder, and the **New project** button on an empty vault's
workbench.

**Check 14 — mobile** is deferred until a mobile device or emulator is
available, and is not required for desktop acceptance. Nothing in the workbench
is known to be desktop-only; the check is unrun, not waived. Run it before any
release that claims mobile support.

The disposable vault was reseeded from scratch on 2026-08-06 and holds only the
committed fixture plus the seeder's injected due dates. Notes a manual session
creates are reported by the seeder rather than deleted, so clear them before
running check 11 or they will appear in every task list.

## Known loose ends

Verified against the committed tree; none blocks the manual checks:

- The documentation now has one authority. `docs/spec/` states intended
  behavior with no precedence chain; `docs/archive/` is history and overrides
  nothing. Folding the addenda in exposed three places where the owning design
  had drifted from the implementation — the `backlog` task status, the
  enforced-by-default dependency mode, and portfolio sprints presented as core
  v1 — all resolved in favor of the code, which was correct in each case. No
  spec statement was dropped in the move.
- Every spec, ADR, and archived document carries `type`, `status`, and
  `canonical` frontmatter, with `area` and cross-links between specs and their
  decisions. A future context builder can select current specs by area without
  reading prose, and no archived document is marked canonical. The
  frontmatter is documentation metadata only; no code reads it yet.
- Merging the specs into fewer subsystem documents remains deliberately
  undone, and is not blocking. The roadmap's own governing-document lists show
  a median of three to four specs per slice, and the two most-cited specs —
  dependencies and agent access — pair with different neighbors in each slice,
  so a subsystem merge would relocate the cost rather than remove it. Revisit
  only if `area` selection proves insufficient in practice.
- ADR 0015 proposes replacing this file's task-shaped content with Project
  Weave's own notes, and records why the automated-verification evidence stays
  in Markdown regardless. It is blocked on the typed mutation kernel and typed
  task editing, and it leaves where a dogfood vault lives to its own decision.
  Until those land, this file remains authoritative.
- `ObsidianVaultReader.setProjectRoots` is unreachable. Scope changes build a
  replacement runtime in `src/main.ts` instead of mutating the reader.
- The template resolver, proposal service, allocator, renderer, and commit
  coordinator all have a runtime caller through the preview command.
- Only creation is writable, and only of tasks and projects. Editing an
  existing note, rank rebalancing, and the remaining note kinds have no write
  path, by design.
- Project creation is complete through the UI: a **Create project** command,
  and a **New project** button on the workbench's empty state. It uses the one
  write path, which now takes its expected kind from the proposal rather than
  assuming a task. ADR 0012 settles where a created project note lands and why
  its collision unit is the folder rather than the note. Unlike task creation,
  it is unverified in Obsidian itself — see check 15 below.
- ADR 0013's creation profiles are implemented and have a runtime caller: both
  renderers apply them, so a template that declares no frontmatter still
  produces a valid note. This changes the bytes of a note created from a
  template that omitted the planning properties, and leaves the packaged
  templates' bytes untouched.
- ADR 0013's vault template library and composite reader now have a runtime
  caller through task creation: a `task/<variant>.md` under the template
  library folder is selectable in the create-task modal, and precedence runs
  project mapping, vault, then packaged per variant. The merged-catalog model
  in `src/application/template-catalog.ts` is still unused — the resolver
  merges the two configured sources directly, and the catalog type earns its
  place when a second kind reads the library. The ADR stays proposed until the
  normative template contract in Plan Addendum 005 and Design 18 matches it.
- Project creation reads `project/default.md` from the library when it exists.
  There is no project template chooser: a second project variant has nowhere to
  be selected from, since the project note is what creation produces.
- Nothing verifies the template chooser in Obsidian itself; see check 16.
- Tasks carry an optional `category`, validated against a vault-wide vocabulary
  from settings when one is configured (ADR 0014). Created tasks now carry a
  `category: null` line, so the bytes of a created task changed again — checks
  12 and 13 already needed re-running after ADR 0010, and this folds into the
  same re-run. The per-project vocabulary considered in ADR 0014 is deferred.
- The creation path does not read the category vocabulary, so a template
  declaring a category outside it previews cleanly, commits, and is diagnosed
  only once the index rebuilds. ADR 0014 now states this as a decision and a
  cost rather than leaving it to be inferred. It is the one creation outcome
  that is reported after the write rather than refused before it; no test or
  manual check covers it.
- The settings tab still has no DOM coverage, so the failure notice that task
  category add/remove now surfaces is unverified by any automated check. It is
  reachable only when persisting settings rejects, which the manual checks do
  not provoke either.
- Project creation offers no status field. The packaged template ships
  `status: planned`, and the renderer accepts a status the caller chooses, but
  no caller chooses one.
- The commit coordinator handles exactly one created file. Multi-file
  proposals, and the partial-success reporting design 10 requires for them,
  are not implemented.
- Ready Now and All Tasks page within the 200-result bound per ADR 0011; the
  diagnostics sections still grow through **Show more** and stop at 200. Paging
  them was not needed by any caller. Both task sections now offer a **Page**
  field alongside Previous and Next, so a task deep in a large project is one
  jump away; it appears only when there is more than one page.
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
- Obsidian keeps property types in `.obsidian/types.json`, keyed by property
  name for the whole vault and independent of any note's value. The configured
  test vault already registers `due_date` as `date` and `points` as `number`,
  so the nulls ADR 0010 writes render with the right editor there and a null
  cannot downgrade an existing registration. Project Weave must not write that
  file, and Obsidian's public API exposes no way to: the 1.13.1 typings have no
  property-type registration at all. Setting a type stays a one-time user
  action per vault. Unconfirmed: what a vault that meets `due_date` as null
  before any real date registers it as. Reseeding does not reach it — the
  fixture dates three tasks, so Obsidian always meets a real date first.
  Answering it needs a vault seeded without the dated tasks.
- The fixture now carries an epic, a milestone, and one task that references
  them with an owner and a priority, so every workbench filter has values
  without a hand edit. Due dates are still injected at seed time, since a
  committed date cannot be today. Generated `--scale` tasks carry the full
  planning shape, which also teaches Obsidian every property in one seeding.
- The seeded vault is the committed fixture plus due dates, so it is no longer
  byte-identical to `tests/fixtures/vault/`. A committed date cannot be
  today, and **Due today** has to be checkable. The automated tests read the
  fixture directly and are unaffected; the seeder refuses to run if a note it
  expects to date is no longer in the fixture.
- `templateClockFromLocalDate` exists for a future caller. Nothing calls it
  yet.
- `templates/default/task.md` and `templates/default/project.md` both have
  runtime consumers. The other five packaged starter templates remain inputs
  for later kinds.
- The renderer normalizes CRLF template bodies to LF so identical requests
  render identical bytes.
- A static frontmatter property whose template value is explicitly empty
  renders as `key: null`. Omission is reserved for unset optional placeholders.
  ADR 0010 uses this deliberately: the packaged task template declares its
  seven planning properties as empty statics, so a created task carries
  `epic`, `milestone`, `sprint`, `owner`, `priority`, `points`, and `due_date`
  even when unset. `rank`, `depends_on`, and `origin` remain placeholders and
  are still omitted when unset.

## Next decision point

1. Run the outstanding desktop items against the installed build in one
   session: the remaining check 11 states, the category vocabulary part of
   check 5, check 15, and check 16. The vault is seeded and the build is
   installed, so this needs Obsidian rather than another export. Record what
   was observed — including any defect — before treating the affected
   workbench, project-creation, or template flows as accepted.
2. Finish ADR 0013 with the previewed **Add Template** flow, vault-backed
   `project/default`, and the normative update to
   `docs/spec/18-project-note-templates.md`. Accept the ADR only after its
   catalog contract and manual acceptance are truthful.
3. Follow the dependency-ordered remaining roadmap in
   `docs/IMPLEMENTATION_ORDER.md`, beginning with the shared read/action
   services and read-only agent boundary after the creation/template flow is
   accepted.
4. Keep every edit path behind the accepted creation flow. Multi-file proposals
   need the preflight and partial-success reporting Design 10 requires before
   any bulk operation ships.
