# Project Weave Manual Checks

## Purpose

`npm run check` covers everything that can be verified without Obsidian. This
file is the procedure for everything that cannot: the Obsidian views, workspace
restoration, responsive behavior, live vault events, and the one write path.

This file owns **how** to run each check. `docs/CURRENT_WORK.md` owns **whether**
each one has passed, and is authoritative when the two disagree. When you finish
a check, record the result there.

The numbering matches `docs/CURRENT_WORK.md`. Do not renumber; add new checks at
the end.

## Setup

### 1. Create the vault and install the plugin

```shell
npm run test-vault:setup
```

That does the whole thing: seeds `test-vault/` at the repository root, points
`.project-weave-test-vault` at it, builds, and installs `main.js`,
`manifest.json`, and `styles.css` into `.obsidian/plugins/project-weave`. The
seeded `community-plugins.json` already enables the plugin, so it loads rather
than waiting to be switched on.

**It will refuse if the pointer already names a different vault**, leaving the
existing one alone — the pointer decides where the next build installs, and
silently redirecting it would send your build somewhere you were not expecting.
Repointing is deliberate and takes two steps, because `setup` forwards extra
arguments to its last command rather than to the seeder:

```shell
npm run test-vault:create -- --point --force
npm run test-vault:update
```

The seeded vault holds the fixture notes, a minimal `.obsidian/`, and a
`.project-weave-seed.json` manifest of everything the seeder wrote. It is
Git-ignored, so nothing the checks do to it shows up in `git status`.

The steps are also available separately — `npm run test-vault:create` seeds
without touching the pointer and prints the path; `npm run test-vault:update`
builds and installs into whatever the pointer names.

Only `test-vault/` is ever seeded or reset. A vault the seeder did not create
has no manifest, so it is refused; a real vault is only ever an install target,
through `test-vault:update`.

**Two vaults are useful, for different questions.** `test-vault/` gives a known
state, so a check that passes is repeatable. A copy of a real vault answers
whether the plugin survives reality — volume, other plugins, mobile — which is
what checks 11f through 11h are really about. Point at whichever one the
session needs.

### 2. Confirm what you are testing

```shell
npm run check
```

```shell
npm run version:show
```

In Obsidian, **Settings → Community plugins**, disable and re-enable Project
Weave so the new bundle loads. Obsidian does not hot-reload a replaced plugin.

### 3. Know the baseline

**Never point any of this at a vault you would miss.** Check 13 writes, and
several checks require corrupting notes on purpose.

The seeded vault contains:

| Note | Type | Status | Rank | Depends on | Due |
| --- | --- | --- | --- | --- | --- |
| `Projects/Game/Project.md` | project | — | — | — | — |
| `Projects/Game/Tasks/Define request.md` | task | `done` | 1000 | — | none |
| `Projects/Game/Tasks/Implement request.md` | task | `todo` | 2000 | Define request | today |
| `Projects/Game/Tasks/External prerequisite.md` | task | `in-progress` | 3000 | — | 3 days ago |
| `Projects/Game/Tasks/Blocked request.md` | task | `todo` | 4000 | External prerequisite | in 7 days |

The due dates are written by the seeder relative to the day you seed, not
committed with the fixture: a fixed date cannot be **today**. Reset before
checking due states if the vault was seeded on an earlier day.

Also present: `Projects/Game/Design/Travel.md` and `Templates/Task.md`.

So the expected baseline is: **Implement request** is the only Ready task
(its one dependency is `done`); **Blocked request** is todo but blocked by an
`in-progress` prerequisite; **Define request** is hidden until you select the
`done` status.

In **Settings → Community plugins → Project Weave**, confirm **Indexed project
folders** is `Projects`.

### 4. Working rules

Between checks, return to the baseline:

```shell
npm run test-vault:reset
```

Reset restores every seeded note, drops the ones the seeder added, and
preserves `.obsidian/` — so the installed plugin and its settings survive and
you do not reinstall after every check. Notes you created yourself are reported
and left alone rather than deleted.

- Reset between checks rather than reverting edits by hand. A check that passes
  against leftover state from the previous one has proved nothing.
- Vault edits take effect on the next index publication, which is automatic.
  If a view looks stale for more than a second or two, that is a defect —
  record it rather than reloading past it.
- Record what you actually observed, not what you expected. Partial or
  incidental coverage counts as outstanding.

---

## The checks

### 1. Three entry points, one reusable tab ✅ passed

**Why:** the view must be a singleton, not a new tab per invocation.

1. Click the Project Weave ribbon icon in the left sidebar.
2. Note the tab that opens. Click the ribbon icon again.
3. Open the command palette and run **Project Weave: Open project workbench**.
4. Open **Settings → Community plugins → Project Weave** and press **Open
   dashboard**.

**Pass:** exactly one Project Workbench tab exists throughout, and steps 2–4
focus the existing tab rather than adding another.

---

### 2. Workspace restoration ✅ passed

**Why:** the selected project is persisted workspace state; task filters are
transient and must not become project data.

1. Open the workbench, select a project, and set some task filters (a search
   term and a non-default status selection).
2. Close and reopen the vault, or run **Reload app without saving** from the
   command palette.

**Pass:** the workbench tab returns with the same project selected, and the
filters are back at their defaults rather than restored.

---

### 3. Ready Now, and opening in another tab ✅ passed

1. With the fixture project selected, read the **Ready Now** section.
2. Click **Implement request**.

**Pass:** **Implement request** is the only Ready task. It opens in a separate
tab; the workbench tab stays open and is not replaced.

**Note:** **Blocked request** must not be Ready — its prerequisite is
`in-progress`, not `done`.

---

### 4. Default status scope in All Tasks ✅ passed

1. Read the **All Tasks** list with default filters.
2. Select the `done` status.

**Pass:** by default the list shows **Implement request**, **Blocked request**
(both `todo`), and **External prerequisite** (`in-progress`), and does not show
**Define request**. After selecting `done`, **Define request** appears.

The default scope is `backlog`, `todo`, `in-progress`, `waiting`, and `review`.
`done` and `cancelled` are opt-in.

---

### 5. Search and the advanced filters — partially passed

**Setup:** the seeded vault already carries due dates. Add the other four
fields to **one** fixture task, for example `Blocked request.md`:

```yaml
priority: high
owner: Robin
epic: '[[Engine]]'
milestone: '[[Alpha]]'
```

1. Search `external` — confirm case-insensitive title matching. Search a
   fragment of the vault path, such as `Game/Tasks`, and confirm path matching.
   Try mixed case (`ExTeRnAl`).
2. Open the priority, epic, milestone, and owner selectors and confirm each
   offers the value you just added.
3. Combine those four filters and confirm they isolate the one edited task.
4. Press **Reset filters**.
5. Filter by each due state in turn, with the default status set plus `done`
   so every task is in scope. Expect **Past due date** to give **External
   prerequisite**, **Due today** to give **Implement request**, **Future due
   date** to give **Blocked request**, and **No due date** to give **Define
   request**.
   Confirm **Due today** against your machine's local calendar date — if the
   vault was seeded on an earlier day, reset it first.

**Pass:** each filter narrows as expected; combining the four isolates the
single edited task; each due state matches exactly the task above; **Reset
filters** returns to the non-terminal default status set and clears the search
and selectors; **Due today** matches against your local calendar date, not UTC.

**Then:** `npm run test-vault:reset`.

---

### 6. Live refresh after an edit ✅ passed

1. With the workbench visible, open a task note in another tab.
2. Change `status: todo` to `status: done` on **External prerequisite**.

**Pass:** after one index publication, and with no manual refresh:
**Blocked request** becomes Ready, the All Tasks list and the task counts
update, and the filter selectors offer the currently available values.

**Then:** revert to `in-progress` and confirm the reverse happens.

---

### 7. Invalid status diagnostic ✅ passed

**Note:** this was previously exercised only incidentally while setting up
check 9. Its recovery guidance and exact-note navigation are unconfirmed.

1. Set a task to `status: complete` — a plausible but invalid value.
2. In the workbench diagnostics section, find the entry for that note.
3. Read the message and confirm it names the code `task.status.invalid` and
   lists the allowed values as recovery guidance.
4. Click the diagnostic's link.
5. Change the status to `done`.

**Pass:** the diagnostic appears with the code, field, and allowed values; its
link opens **that exact note**; follow-on validation errors that depend on the
unparsed status are suppressed rather than piled on; the diagnostic disappears
after the next index publication once corrected.

**Then:** `npm run test-vault:reset`.

---

### 8. Unassigned diagnostics ✅ passed

1. Create a note under `Projects/Game/` with `type: task` and a `project` link
   that points nowhere, for example `project: '[[Nonexistent]]'`.
2. Separately, create a note with malformed frontmatter.

**Pass:** both appear in the prominent **Unassigned diagnostics** section, each
with a link to its source note and its error type — Project Weave cannot infer
ownership, and must not silently drop them.

**Then:** delete the notes you created, or `npm run test-vault:reset` — reset
reports them rather than removing them, since it only deletes what it seeded.

---

### 9. Note diagnostic banner ✅ passed

1. Make a task note invalid (reuse check 7's `status: complete`).
2. Open that note.
3. Switch between editing and reading modes.
4. Correct the status.

**Pass:** a banner appears above the note showing the same severity, code,
field, message, and recovery guidance as the workbench; it renders in both
modes; it disappears after the index publishes the correction.

Jump-to-field and inline field highlighting are deliberately not implemented —
their absence is not a defect.

---

### 10. Changing indexed project roots ✅ passed

1. In settings, change **Indexed project folders** from `Projects` to
   `Projects/Game`.
2. Watch the workbench during the change.
3. Change it to a folder containing no projects, then back to `Projects`.

**Pass:** a rebuilding state is shown, the index rebuilds against the new
scope, out-of-scope notes are gone rather than retained, and no results from
the retired runtime appear after the switch.

---

### 11. Degenerate states — partially passed

Ordinary use never reaches these states. Run each sub-case and record it
separately.

`tests/ui/project-workbench-view.test.ts` now renders 11b, 11c, 11e, 11f, and
the 11d banner against a test DOM, so the *drawing* of those states is
automated and regressions will be caught by `npm run check`. What remains
manual is whether Obsidian's own behavior — real vault events, real layout,
real devices — reaches them the same way. Run them anyway; treat a
contradiction between the test and the app as a defect in the test double.

**11a — multiple projects.** Add a second project note, for example
`Projects/Tooling/Project.md` with `type: project`. Confirm the project
selector lists both and switching between them changes the task lists. Then
delete it — reset will report it, not remove it.

**11b — unavailable restored selection.** Select a project, then delete or
rename its project note while the workbench is open. Expect the
**Selected project is unavailable** state, with the selector showing
`Unavailable: <path>` for the requested path rather than silently falling back
to another project. Restore the note and confirm recovery.

**11c — empty scope.** Remove every indexed project folder in settings. Expect
the settings page to say the index is empty, and the workbench to show a
no-projects state rather than an error or a stuck loading state.

**11d — stale last good.** This state appears when an index rebuild throws: the
previous snapshot is republished as `stale_last_good` with a banner saying the
results may be out of date, marked as an alert. It is hard to provoke
deliberately. Attempt it by making the vault hostile during a rebuild — for
example toggling roots while bulk-editing notes — and if you cannot reach it,
record it as unreached rather than passed.

**11e — zero filter matches.** Search for a string no task contains. Expect
**No tasks match these filters** — distinct from the empty-project message
**No tasks in this project**. Confirm you get the second message by selecting a
project with no tasks at all.

**11f — paging a large project.** Seed more than 200 tasks in one project:

```shell
npm run test-vault:reset -- --scale 250
```

All Tasks opens on **1–25 of 250 matching tasks** and Ready Now on its first
ten. Confirm that **Previous** is disabled on the first page, that **Next**
reaches the end, and that the last page is short rather than padded. Set
**Per page** to 200 and confirm the tail past 200 is reachable — that is the
range ADR 0011 exists for. Then use the **Page** field: type a page in the
middle, press Enter, and confirm the list moves there in one step; type a page
past the end and confirm it lands on the last page rather than refusing.
Diagnostics still truncate at 200 and do not page. A plain
`npm run test-vault:reset` removes the bulk tasks again.

**11g — narrow layouts.** Drag the workbench pane as narrow as it goes, and
also try it in a right sidebar. The filter controls should stack rather than
overflow or clip. The status checkboxes should wrap into aligned columns.
Known and accepted: the create-task modal is cramped at narrow widths.

---

### 12. Create-task preview — re-run required

**Note:** `tests/ui/task-creation-preview-modal.test.ts` now drives the real
preview service through the modal and asserts what it shows: the allocated
path, the rank one gap past the largest, subfolder nesting, the collision
notice, a diagnostic instead of a filename, and the refusal path. Everything in
the pass list below is therefore automated **except** how it looks and behaves
in Obsidian itself. Run it once to confirm the app agrees; a disagreement is a
defect in the test double.

Nothing in this check writes — closing the modal must leave the vault
untouched.

1. Press **New task** in the workbench. Type a title.
2. Read the previewed target path, rank, and rendered note body.
3. Add a subfolder such as `Combat`.
4. Enter a title matching an existing task, such as `Implement request`.
5. Enter an unusable title such as `///`.
6. Close the modal without confirming.
7. Open a task note and run **Project Weave: Create task** from the command
   palette.

**Pass:**

- the target path resolves under `Projects/Game/Tasks/`;
- the rank is **1000 past the largest existing rank** — with the fixture vault
  untouched, the largest is 4000, so expect **5000**;
- the rendered note shown in the preview matches that path and rank;
- the subfolder nests the target path under `Tasks/Combat/`;
- the colliding title yields a numbered suggestion **with an explicit notice**,
  never a silent overwrite;
- `///` yields a diagnostic instead of a filename;
- closing creates nothing;
- the command palette infers the project from the active note, while the
  workbench button uses the project selected there.

---

### 13. Create-task commit — re-run required

**This check writes to the vault.**

Recorded as passed: creating from the workbench works, the task folder and
requested subfolders are created, a duplicate title yields a suffixed name
rather than an overwrite, editing the project note while the modal is open
makes the commit refuse, and the written note matches its preview byte for
byte. Creating from the command palette was fixed during this check, having
previously refused whenever the workbench itself had focus.

To re-run it:

1. Delete the `Tasks` folder so creation has to make it.
2. Create a task from the **New task** button. Confirm.
3. Compare the created file to the preview, byte for byte.
4. Create another from the command palette with a task note active.
5. Open the modal again; before confirming, edit `Projects/Game/Project.md` in
   another tab and save.
6. Confirm the commit.

**Pass:** exactly the previewed path is written with the previewed bytes; the
missing `Tasks` folder is created; the new task appears in the dashboard after
the index refreshes; step 6 **refuses** with a message about the project note
having changed and creates nothing; no pre-existing note is modified at any
point.

---

### 14. Mobile compatibility — deferred

Tracked separately from check 11 because it needs a device or emulator the
desktop checks do not. Desktop acceptance does not wait on it; a release
claiming mobile support does.

Open the vault in Obsidian mobile, or in the desktop app's mobile emulation.
The plugin declares `isDesktopOnly: false`, so it must load and the workbench
must be usable. Run 11a through 11g there. Any crash or missing view here is a
release blocker.

---

## Recording results

After a session, update `docs/CURRENT_WORK.md`:

- move passed checks out of the outstanding list, naming what you observed;
- record defects rather than deferring them;
- treat incidental coverage as outstanding, and say which parts were not
  reached.

The workbench is not manually accepted until every check above has an explicit
recorded result.
