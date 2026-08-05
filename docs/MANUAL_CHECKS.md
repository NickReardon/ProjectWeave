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

### 1. Build and install

From a clean tree:

```shell
npm run check
```

```shell
npm run test-vault:update
```

The second command builds, verifies the release inventory, and copies exactly
`main.js`, `manifest.json`, and `styles.css` into
`.obsidian/plugins/project-weave` in the vault named by the Git-ignored
`.project-weave-test-vault` file or the `PROJECT_WEAVE_TEST_VAULT` environment
variable. It fails loudly if no vault is configured.

Confirm the installed version matches what you think you are testing:

```shell
npm run version:show
```

In Obsidian, **Settings → Community plugins**, disable and re-enable Project
Weave so the new bundle loads. Obsidian does not hot-reload a replaced plugin.

### 2. Prepare the vault

**Use a disposable vault.** Check 13 writes to it, and several checks require
you to corrupt notes on purpose.

Copy the contents of `tests/fixtures/vault/` into the vault root. That gives:

| Note | Type | Status | Rank | Depends on |
| --- | --- | --- | --- | --- |
| `Projects/Game/Project.md` | project | — | — | — |
| `Projects/Game/Tasks/Define request.md` | task | `done` | 1000 | — |
| `Projects/Game/Tasks/Implement request.md` | task | `todo` | 2000 | Define request |
| `Projects/Game/Tasks/External prerequisite.md` | task | `in-progress` | 3000 | — |
| `Projects/Game/Tasks/Blocked request.md` | task | `todo` | 4000 | External prerequisite |

Also present: `Projects/Game/Design/Travel.md` and `Templates/Task.md`.

So the expected baseline is: **Implement request** is the only Ready task
(its one dependency is `done`); **Blocked request** is todo but blocked by an
`in-progress` prerequisite; **Define request** is hidden until you select the
`done` status.

In **Settings → Community plugins → Project Weave**, confirm **Indexed project
folders** is `Projects`.

### 3. Working rules

- Restore any note you edit before starting the next check. Several checks
  depend on the baseline table above.
- A snapshot copy of the vault folder before you start makes reverting trivial.
- Vault edits take effect on the next index publication, which is automatic.
  If a view looks stale for more than a second or two, that is a defect —
  record it rather than reloading past it.
- Record what you actually observed, not what you expected. Partial or
  incidental coverage counts as outstanding.

---

## The checks

### 1. Three entry points, one reusable tab

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

### 3. Ready Now, and opening in another tab

1. With the fixture project selected, read the **Ready Now** section.
2. Click **Implement request**.

**Pass:** **Implement request** is the only Ready task. It opens in a separate
tab; the workbench tab stays open and is not replaced.

**Note:** **Blocked request** must not be Ready — its prerequisite is
`in-progress`, not `done`.

---

### 4. Default status scope in All Tasks

1. Read the **All Tasks** list with default filters.
2. Select the `done` status.

**Pass:** by default the list shows **Implement request**, **Blocked request**
(both `todo`), and **External prerequisite** (`in-progress`), and does not show
**Define request**. After selecting `done`, **Define request** appears.

The default scope is `backlog`, `todo`, `in-progress`, `waiting`, and `review`.
`done` and `cancelled` are opt-in.

---

### 5. Search and the advanced filters

**Setup:** temporarily add all five fields to **one** fixture task, for example
`Blocked request.md`:

```yaml
priority: high
owner: Robin
epic: '[[Engine]]'
milestone: '[[Alpha]]'
due_date: 2026-12-31
```

1. Search `external` — confirm case-insensitive title matching. Search a
   fragment of the vault path, such as `Game/Tasks`, and confirm path matching.
   Try mixed case (`ExTeRnAl`).
2. Open the priority, epic, milestone, and owner selectors and confirm each
   offers the value you just added.
3. Combine all five filters and confirm they isolate the one edited task.
4. Press **Reset filters**.
5. Change `due_date` to **today's local calendar date**, then filter by **Due
   today**.

**Pass:** each filter narrows as expected; combining them isolates the single
task; **Reset filters** returns to the non-terminal default status set and
clears the search and selectors; **Due today** matches against your local
calendar date, not UTC.

**Then:** revert the task note.

---

### 6. Live refresh after an edit

1. With the workbench visible, open a task note in another tab.
2. Change `status: todo` to `status: done` on **External prerequisite**.

**Pass:** after one index publication, and with no manual refresh:
**Blocked request** becomes Ready, the All Tasks list and the task counts
update, and the filter selectors offer the currently available values.

**Then:** revert to `in-progress` and confirm the reverse happens.

---

### 7. Invalid status diagnostic

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

**Then:** revert the task note.

---

### 8. Unassigned diagnostics ✅ passed

1. Create a note under `Projects/Game/` with `type: task` and a `project` link
   that points nowhere, for example `project: '[[Nonexistent]]'`.
2. Separately, create a note with malformed frontmatter.

**Pass:** both appear in the prominent **Unassigned diagnostics** section, each
with a link to its source note and its error type — Project Weave cannot infer
ownership, and must not silently drop them.

**Then:** delete the notes you created.

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

### 11. Degenerate states

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
delete it.

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

**11f — 200-result truncation.** Generate more than 200 tasks in one project.
From the repository root, with the vault path substituted:

```powershell
1..250 | ForEach-Object { Set-Content -Path "C:\path\to\vault\Projects\Game\Tasks\Bulk $_.md" -Value "---`ntype: task`nproject: '[[Projects/Game/Project]]'`nstatus: todo`nrank: $($_ * 1000 + 10000)`n---`n`n# Bulk $_" }
```

Expect **Showing the first 200 of &lt;total&gt;** in All Tasks, and
**Showing the first 200 ready tasks** in Ready Now. Diagnostics truncate the
same way at 200. Delete the `Bulk *.md` notes afterward.

**11g — narrow layouts.** Drag the workbench pane as narrow as it goes, and
also try it in a right sidebar. The filter controls should stack rather than
overflow or clip. The status checkboxes should wrap into aligned columns.
Known and accepted: the create-task modal is cramped at narrow widths.

**11h — mobile compatibility.** Open the vault in Obsidian mobile, or in the
desktop app's mobile emulation. The plugin declares `isDesktopOnly: false`, so
it must load and the workbench must be usable. Any crash or missing view here
is a release blocker.

---

### 12. Create-task preview

**Note:** subfolder nesting and the collision suffix were covered incidentally
by check 13. The rank rule and the unusable-title outcome are covered by
`tests/application/task-creation-allocator.test.ts`, so what is unconfirmed is
narrower than it looks: whether the **modal surfaces** them — the previewed
rank, and a diagnostic rather than a filename.

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

### 13. Create-task commit ✅ passed

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

## Recording results

After a session, update `docs/CURRENT_WORK.md`:

- move passed checks out of the outstanding list, naming what you observed;
- record defects rather than deferring them;
- treat incidental coverage as outstanding, and say which parts were not
  reached.

The workbench is not manually accepted until every check above has an explicit
recorded result.
