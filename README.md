# Project Weave

Project Weave is a Markdown-first Obsidian project workbench for a solo
developer or small team building one substantial, long-lived project. It
connects design notes to a ranked backlog, dependency-aware board work, and a
clear Ready Now sequence without requiring sprints, estimates, owners, or
other process features a project does not use.

The current product direction and normative reading order are in
[CURRENT-DESIGN.md](CURRENT-DESIGN.md).

Contributors and coding agents should begin with [AGENTS.md](AGENTS.md), which
defines the branch and small-commit workflow. Validation evidence, remaining
manual checks, and the next decision point are in
[docs/CURRENT_WORK.md](docs/CURRENT_WORK.md); commit history is the record of
what changed. The dependency-ordered remaining roadmap is in
[docs/IMPLEMENTATION_ORDER.md](docs/IMPLEMENTATION_ORDER.md).

## Current status

The implemented slices are:

- strict TypeScript Obsidian plugin and production bundle;
- asynchronous, non-writing Markdown indexing behind read-only ports;
- project, epic, task, milestone, planning-period, relation, and diagnostic
  parsing;
- dependency readiness, reverse edges, provenance, and deterministic ordering;
- bounded project context, task context, and Ready Now application queries;
- a persistent Obsidian Project Workbench with a project picker, project
  summary, live index state, bounded Ready Now list, and a project-scoped All
  Tasks list with status, priority, epic, milestone, owner, due-state, and
  title/path filters;
- visible project and unassigned diagnostic sections grouped by affected note,
  with severity, error code, field, recovery guidance, related-note links, and
  exact-note navigation;
- compact, live diagnostic banners above affected Markdown notes in editing
  and reading modes without modifying note content;
- ribbon, command-palette, and settings entry points for the workbench;
- workspace-restored project selection and task navigation that preserves the
  dashboard tab;
- an Obsidian **Open Ready Now** command and modal for the compact flow;
- a persisted Obsidian settings tab for project-folder discovery and the
  template library location;
- a plugin-lifetime read publication layer that keeps open views current when
  indexed project folders replace the indexing runtime;
- a deterministic task-template renderer in the domain, covering template
  parsing, typed variable substitution, optional-field omission, conditional
  body blocks, and entity-type/project invariants;
- a read-only application resolver for project task-template defaults and named
  variants, with explicit packaged fallback and fail-closed broken references;
- an exact one-file task-creation proposal service carrying project/template
  fingerprints, target-absence preconditions, frontmatter changes, rendered
  bytes, and expected indexing postconditions;
- pure task target-path and rank allocation that derives a `Tasks` folder from
  the project note's location, accepts an optional organizing subfolder,
  sanitizes a title into a safe filename, suggests the first free path, and
  spaces ranks 1000 apart;
- a **Create task** command and modal showing the allocated path and
  rank, resolved template, preconditions, read set, expected postconditions,
  and exact rendered bytes, with an explicit **Create task** action;
- a **Create project** command and modal on the same terms, allocating a
  folder of the project's own and offering a chooser when settings name more
  than one indexed folder;
- a commit coordinator that re-reads the proposal's inputs, compares
  fingerprints, re-checks target absence, and re-validates the produced note
  before writing it once;
- a create-only note-writing port with no way to express overwrite, move, or
  delete, implemented over Obsidian's Vault API;
- a vault template library and merged template catalog per ADR 0013, with
  per-key precedence and a composite reader that reaches templates outside the
  indexed project folders without widening what indexing sees;
- fixture-backed parser, index, query, dashboard projection, template
  rendering, incremental-update, lifecycle, and release-inventory tests;
- CI runs the same complete check on supported Node.js versions.

**New task** in the workbench, or **Create task** in the command palette,
exercises this chain end to end: it allocates a path and rank, resolves the template, shows the exact bytes
that would be written along with the preconditions and expected
postconditions, and creates the note when you confirm.

Creation is the only thing Project Weave writes. Indexing, plugin load,
settings changes, navigation, and the dashboard never modify vault content.
The write path creates new notes only: it has no operation that can modify,
move, or delete an existing note, and a target that already exists is refused
rather than overwritten. If the project note or template changes between
preview and confirmation, the commit aborts and asks you to preview again,
rather than writing something you did not see.

Editing existing notes, rank rebalancing and reorder, the remaining note
kinds, full Plan/Board/My Work perspectives, portfolio views, and agent/MCP
transport remain later slices.

New task notes are placed in a `Tasks` folder beside the project note, so
`Projects/Game/Project.md` gives `Projects/Game/Tasks/`. A caller may pass a
subfolder beneath it for organization. Titles become filenames with
path-hostile and link-hostile characters replaced; a colliding name gets a
numeric suffix as a visible suggestion, never as a silent overwrite.
[ADR 0008](docs/decisions/0008-derive-task-paths-and-allocate-spaced-ranks.md)
records these rules.

A created project takes a folder of its own inside an indexed project folder:
`Projects/Travel Planner/Project.md`. The folder is the project's identity, so
its tasks land in `Projects/Travel Planner/Tasks/` under the rule above, and a
folder already in use yields a numbered folder rather than a shared one — two
projects in one folder would mingle their tasks.
[ADR 0012](docs/decisions/0012-give-each-project-its-own-folder.md) records
that decision. Project notes use the packaged project template: a
project-owned template mapping lives in the project note, which is the note
being created.

With nothing indexed yet, the workbench's empty state offers **New project**,
so a fresh vault does not have to be bootstrapped by hand.

## Note templates

`templates/default/` holds the packaged starter templates.
`templates/default/task.md` and `templates/default/project.md` are used by
code; the plugin embeds a copy of each so rendering works without filesystem
access, and a test keeps each pair byte-identical. The remaining files are
inputs for later slices.

A task template is chosen per variant from three places, in order:

1. the project note's own `weave.templates.task.<variant>` mapping;
2. `<template library folder>/task/<variant>.md`;
3. the packaged minimal template, for `default` only.

Precedence applies per variant, so a project can override `bug` while still
using the vault's `default`. A broken, ambiguous, malformed, or wrong-kind
template blocks the variant that selected it rather than falling back to
another source — falling back would create bytes other than the ones the
chosen template describes. A variant that exists nowhere is reported instead of
becoming the default by accident.

The create-task modal shows a **Template** chooser once more than one variant
exists, listing the merged variants plus **Packaged minimal** as an explicit
escape hatch, and re-previews when you change it. With one variant there is no
choice to make, so there is no control.
[ADR 0013](docs/decisions/0013-resolve-templates-from-a-vault-template-folder.md)
records the design.

A created project uses `<template library folder>/project/default.md` when it
exists, and the packaged project template otherwise, on the same fail-closed
terms. There is no chooser: a project note is where a project's own template
mapping would live, so one house style per vault is the only choice there is to
make.

What a created note carries because of its kind does not depend on its
template. A task always gets its title, status, project relation, and the seven
planning properties; a project always gets its title and a status. A template
that declares one of those keeps its own value and position, so a template you
already use renders exactly the bytes it did before, while a template that is
only a heading and some sections still produces a valid note.

A template is an ordinary Markdown note marked `weave_template: true` with a
`template_for` kind. Marked templates are excluded from entity indexing, so a
template never appears as a task. Rendering removes the template-only keys
(`weave_template`, `template_schema`, `template_for`, `template_name`,
`template_description`, `template_inputs`) and keeps every other property.

Frontmatter placeholders must occupy a whole value, such as
`points: "{{points}}"`. They are replaced with the typed value, and a property
whose optional variable is unset is omitted rather than left empty. Body
placeholders insert Markdown, `{{#if variable}}` / `{{/if}}` blocks are the
only control construct and cannot nest, and `\{{` writes a literal `{{`.
`{{date}}`, `{{time}}`, and `{{datetime}}` accept formats built from `YYYY`,
`MM`, `DD`, `HH`, `mm`, and `ss` with bracketed literals, for example
`{{date:YYYY-MM-DD}}`.

The renderer executes nothing and reads nothing: it has no clock, network,
environment, or file access, and every value comes from the creation context
its caller supplies. Unknown variables, malformed or unmatched directives,
invalid metadata or input types, undeclared inputs, an unsafe target path, and
a template that contradicts the entity type or selected project are all
errors, and no note is produced.

## Development

Node.js 22 or newer is required.

```shell
npm ci
npm run check
```

Use `npm run dev` for a watching development bundle. A production build writes
exactly `main.js`, `manifest.json`, and `styles.css` to `dist/`. Install
those files only in a disposable development vault.

## Obsidian settings and manual test

Open **Settings → Community plugins → Project Weave**. The plugin indexes only
the configured **Indexed project folders**; a fresh install defaults to
`Projects`. Add a narrower root such as `Projects/Game` when only one project
should be visible. Removing every root intentionally produces an empty index.
Changing roots replaces the current runtime and rebuilds without retaining
out-of-scope notes.

The **Template library folder** names where vault-wide templates live, one
folder per kind and one file per variant, such as `task/bug.md`. It is a local
preference: saving it never creates or edits vault content, an empty value uses
the packaged templates only, and a folder nobody has created simply holds no
templates. Project notes may still map their own variants under
`weave.templates`, which travel with the project and take precedence. Task
creation reads `task/<variant>.md` from this folder and merges it with project
overrides and the packaged default. Project creation still uses its packaged
template; vault-backed `project/default.md` is a later ADR 0013 step.

Open the dashboard from the left ribbon, **Project Weave: Open project
workbench** in the command palette, or **Open dashboard** on the settings page.
After the view has been opened once, Obsidian restores it as part of the
workspace. With multiple indexed projects, use the project selector in the
view; with one project, the dashboard selects it automatically. Ready Now and
All Tasks buttons open exact existing task notes in another tab, leaving the
dashboard open. All Tasks initially includes `backlog`, `todo`, `in-progress`,
`waiting`, and `review`; select `done` or `cancelled` when searching terminal
history. Search matches task titles and vault paths without case sensitivity.
Priority, epic, milestone, owner, and due-state selectors can be combined with
the status and text filters. Due state compares canonical `due_date` values to
the user's current local calendar date.

For the dashboard and Ready Now walking-slice test, copy the contents of
`tests/fixtures/vault/` into a disposable vault. Its project is nested under
`Projects/Game/`, with the canonical project note at
`Projects/Game/Project.md`. Open the workbench and confirm **Implement request**
is the one Ready task. In All Tasks, confirm both todo tasks and **External
prerequisite** (`in-progress`) are visible, search for `external`, and then
select `done` to retrieve **Define request**. Open a result and confirm it uses
another tab without replacing the workbench. Edit a task dependency or status
and confirm both task sections refresh after index publication. The older
**Open Ready Now** command remains available as a compact modal.

For an advanced-filter check, temporarily add `priority: high`, `owner: Robin`,
`epic: "[[Engine]]"`, `milestone: "[[Alpha]]"`, and a valid `due_date` to one
fixture task. Confirm each value appears in its selector, combine all five
filters to isolate that task, then use **Reset filters**. Set `due_date` to
today's local date to verify **Due today**.

To test diagnostics, temporarily set a task to an invalid value such as
`status: complete`. The workbench lists the affected note and
`task.status.invalid`, including the allowed values. Change it to
`status: done` and confirm the issue disappears after the live index refresh.
Status-dependent validation suppresses redundant follow-on errors when the
status itself could not be parsed.

Open the affected task note and confirm the same severity, error code, field,
message, and available recovery guidance appear in a banner above the note.
Switch between editing and reading modes, then correct the status and confirm
the banner disappears. Jump-to-field behavior and inline field highlighting
are intentionally deferred.

Malformed notes and notes whose project link cannot resolve appear in the
prominent **Unassigned diagnostics** section, so every indexed error remains
findable even when Project Weave cannot safely infer project ownership.

To check the creation preview, press **New task** in the workbench, or open a
project or task note and run **Project Weave: Create task**. The workbench
button uses the project already selected there; the command infers one from
the active note. Type a title and confirm the target path
resolves under `Projects/Game/Tasks/`, the rank is 1000 past the largest
existing rank, and the rendered note matches that path and rank. Add a
subfolder such as `Combat` and confirm it nests. Enter a title matching an
existing task and confirm a numbered name is suggested with an explicit notice
rather than an overwrite. Try a title such as `///` and confirm a diagnostic
appears instead of a filename. Closing the modal creates nothing.

**Use a disposable vault for the creation check, because it writes.** Confirm
**Create task** creates exactly the previewed path with the previewed bytes,
creating the `Tasks` folder if it was missing, and that the new task appears
in the dashboard after the index refreshes. With the modal open, edit the
project note in another tab, then confirm: the commit must refuse with a
message about the note having changed, and create nothing.

Run **Project Weave: Create project** for the project kind. Confirm the target
path is `Projects/<Title>/Project.md`, that a title matching an existing
folder yields a numbered folder with an explicit notice, and that the created
project appears in the workbench picker after the index refreshes. Creating a
task in it should then land under its own `Tasks` folder.

## Versioning and exports

`package.json` is the canonical project version. Version commands update it
together with `package-lock.json`, `manifest.json`, and `versions.json`:

```shell
npm run version:show
npm run version:patch
npm run version:minor
npm run version:major
npm run version:set -- 1.2.3
```

Choose the increment by the size of the change, not by how many commits it
took. Before 1.0 the minor position carries feature weight:

- **patch** (`0.3.0` → `0.3.1`) — bug fixes, documentation, refactoring, and
  anything a user could not describe as a new capability.
- **minor** (`0.3.0` → `0.4.0`) — any completed feature slice or new
  user-visible capability, and any change to a compatibility surface: product
  terms, frontmatter fields, controlled values, diagnostic codes, or persisted
  workspace state. Crossing a boundary the plugin did not previously cross —
  the first vault write, for example — is always at least a minor bump.
- **major** (`0.4.0` → `1.0.0`) — reserved for the first stable release and,
  after that, for breaking changes to a compatibility surface.

When in doubt between patch and minor, take the minor. A version that
undersells a release is worse than one that oversells it, because installed
builds are identified by version alone.

The operational channel, BRAT preview, stable release, and Community directory
steps are in [Plugin Release and Testing](docs/PLUGIN_RELEASE_AND_TESTING.md).

Run `npm run export` to build and verify the plugin, then generate:

- `export/project-weave/` — the directly installable Obsidian plugin folder;
- `export/project-weave-<version>.zip` — a ZIP containing that plugin folder.

To create a disposable vault for the manual checks, seeded from
`tests/fixtures/vault/`, and install the plugin into it:

```shell
npm run test-vault:setup
npm run test-vault:reset
```

`setup` seeds a Git-ignored `test-vault/` with a minimal `.obsidian/` and a
manifest of everything it wrote, points `.project-weave-test-vault` at it, then
builds and installs. It refuses when the pointer already names a different
vault, since that decides where the next build lands; repoint deliberately with
`npm run test-vault:create -- --point --force`. `npm run test-vault:create`
alone seeds without touching the pointer.

Only `test-vault/` is seeded or reset. Any other vault, including a copy of a
real one, is an install target only, through `npm run test-vault:update`.

Seeded task notes carry due dates relative to the day they are seeded — one
overdue, one due today, one due later, one undated — so the due-state filters
have something to filter. A committed date cannot be today, so these are
written by the seeder rather than held in the fixture, and reseeding on a later
day moves them.

`reset` returns the vault to its baseline between checks, preserving
`.obsidian/` so the installed plugin survives, and reporting rather than
deleting notes it did not seed. Pass `-- --scale 250` to seed bulk tasks for
the truncation check. Every command refuses a directory without a manifest this
tool wrote, and refuses a target outside the repository unless given
`--allow-outside`.

To update a local Obsidian test vault on every export, put its absolute path in
the Git-ignored `.project-weave-test-vault` file or set
`PROJECT_WEAVE_TEST_VAULT`. The configured folder must already contain an
`.obsidian` directory. Export copies only `main.js`, `manifest.json`, and
`styles.css` into `.obsidian/plugins/project-weave`, preserving `data.json`
and other local plugin state. With no local setting, export only creates the
ordinary artifacts. To require a configured vault and receive a failure when
installation does not occur, run:

```shell
npm run test-vault:update
```

The entire `export/` directory is Git-ignored. `npm run release` runs the
complete validation gate and then produces the same export artifacts and
configured test-vault update.
