# Project Weave

Project Weave is a Markdown-first Obsidian project workbench for a solo
developer or small team building one substantial, long-lived project. It
connects design notes to a ranked backlog, dependency-aware board work, and a
clear Ready Now sequence without requiring sprints, estimates, owners, or
other process features a project does not use.

This file records what is implemented. What Project Weave is specified to do is
in [docs/spec/](docs/spec/README.md); [CURRENT-DESIGN.md](CURRENT-DESIGN.md) is
a one-page map of where each kind of truth lives.

Contributors and coding agents should begin with [AGENTS.md](AGENTS.md), which
defines the branch and small-commit workflow. Automated-validation evidence is
in [docs/CURRENT_WORK.md](docs/CURRENT_WORK.md); remaining manual checks,
known loose ends, and the next decision point are tracked as tasks in
[docs/project-vault/](docs/project-vault/), Project Weave's own dogfood vault;
commit history is the record of what changed. The dependency-ordered remaining
roadmap is represented by the project, Epic, and milestone notes in
[docs/project-vault/](docs/project-vault/).

## Current status

Implemented today:

- **Indexing** — asynchronous, non-writing Markdown indexing behind read-only
  ports, parsing projects, epics, tasks, milestones, planning periods,
  relations, and diagnostics. Dependency readiness, reverse edges, provenance,
  and deterministic ordering are derived rather than stored, and a
  plugin-lifetime publication layer keeps open views current when the indexed
  folders replace the indexing runtime.
- **Queries** — bounded project context, task context, and Ready Now
  application queries, each explicitly project-scoped.
- **Workbench** — a persistent Obsidian Project Workbench with a project
  picker, project summary, live index state, a bounded Ready Now list, and a
  project-scoped All Tasks list filterable by status, priority, epic,
  milestone, owner, category, due state, and title or path. Ribbon,
  command-palette, and settings entry points open it, and Obsidian restores it
  with the workspace.
- **Diagnostics** — project and unassigned diagnostic sections grouped by
  affected note, carrying severity, error code, field, recovery guidance,
  related-note links, and exact-note navigation, plus compact live banners
  above affected Markdown notes in editing and reading modes. Neither modifies
  note content.
- **Creation** — a deterministic template renderer in the domain; a read-only
  resolver for project template defaults and named variants with explicit
  packaged fallback and fail-closed broken references; pure target-path and
  rank allocation; exact one-file creation proposals carrying fingerprints,
  target-absence preconditions, rendered bytes, and expected postconditions;
  **Create task** and **Create project** commands and modals showing all of it
  before you confirm; and a commit coordinator that re-reads its inputs,
  compares fingerprints, and re-validates before writing once.
- **Templates** — a vault template library and merged catalog per
  [ADR 0013](docs/decisions/0013-resolve-templates-from-a-vault-template-folder.md),
  with per-key precedence and a composite reader that reaches templates outside
  the indexed project folders without widening what indexing sees.
- **Tests** — fixture-backed parser, index, query, dashboard projection,
  template rendering, incremental-update, lifecycle, and release-inventory
  coverage. CI runs the same complete check on supported Node.js versions.

**New task** in the workbench, or **Create task** in the command palette,
exercises this chain end to end: it allocates a path and rank, resolves the
template, shows the exact bytes that would be written along with the
preconditions and expected postconditions, and creates the note when you
confirm.

Creation is the only normal project-content write Project Weave performs.
Indexing, plugin load, settings changes, navigation, and the dashboard never
modify canonical Markdown. If **Diagnostics log folder** is configured, the
plugin also writes its derived `diagnostics.json` report there after complete
index publications; it never indexes that report as a project entity.
The write path creates new notes only: it has no operation that can modify,
move, or delete an existing note, and a target that already exists is refused
rather than overwritten. If the project note or template changes between
preview and confirmation, the commit aborts and asks you to preview again,
rather than writing something you did not see.

Editing existing notes, rank rebalancing and reorder, the remaining note
kinds, full Plan/Board/My Work perspectives, portfolio views, and agent/MCP
transport remain later slices.

### Where notes are created

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
that decision.

With nothing indexed yet, the workbench's empty state offers **New project**,
so a fresh vault does not have to be bootstrapped by hand.

## Task categories

Tasks may carry an optional `category` such as `bug` or `chore`, filterable in
the workbench beside owner and priority. It is free-form by default: with no
configuration, any value is accepted and the filter offers whatever tasks use.

Listing categories under **Settings → Task categories** turns on validation —
anything else is reported as `task.category.invalid` naming the allowed values,
without changing the note. Matching ignores case, a declared category is
offered even before a task uses it, and an undeclared value in use stays
offered so the task carrying the diagnostic remains findable.

The vocabulary is vault-wide rather than per project, because Obsidian's own
property suggestions are vault-wide; two lists would contradict each other in
adjacent editors. A `task/bug.md` template that declares `category: bug` is how
choosing a template assigns one.
[ADR 0014](docs/decisions/0014-group-tasks-with-a-vault-wide-category.md)
records the decision, including why a `bug` entity type was rejected.

## Note templates

`templates/default/` holds the packaged starter templates. The plugin embeds
the complete set so future creation services can use them without filesystem
access, and tests keep every embedded copy byte-identical to its editable
source file. Task and project are the kinds with runtime creation flows today;
epic, milestone, planning period, and document starters remain inputs for later
slices.

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

A created project resolves `project/default` through the same merged catalog:
the vault template wins when present, and the packaged project template is the
fallback. An ambiguous or malformed vault winner fails closed instead of
silently changing the bytes. There is no chooser yet: a project note is where
a project's own template mapping would live, so one house style per vault is
the only choice there is to make.

What a created note carries because of its kind does not depend on its
template. A task always gets its title, status, project relation, and the seven
planning properties; a project always gets its title and a status. A template
that declares one of those keeps its own value and position, so a template you
already use renders exactly the bytes it did before, while a template that is
only a heading and some sections still produces a valid note.

A template is an ordinary Markdown note marked `weave_template: true` with a
`template_for` kind. Marked templates are excluded from entity indexing, so a
template never appears as a task. Rendering removes the template-only keys and
keeps every other property. The renderer executes nothing and reads nothing: it
has no clock, network, environment, or file access, and every value comes from
the creation context its caller supplies.

Template metadata keys, frontmatter and body placeholder syntax, the
`{{#if}}` construct, and the date and time formats are specified in
[Design 18 — Project note templates](docs/spec/18-project-note-templates.md).

## Development

Node.js 22 or newer is required.

```shell
npm ci
npm run check
```

To inspect the current diagnostics in a vault from the command line, run the
read-only scanner. You can pass the vault directly:

```shell
npm run diagnostics -- --vault "C:\\path\\to\\vault" --project "Projects/Game/Project.md" --out diagnostics.json --pretty
```

Or put `PROJECT_WEAVE_VAULT=C:\\path\\to\\vault` in a local `.env` file and
run `npm run diagnostics` without `--vault`. The `.env` file is ignored by Git;
`.env.example` shows the shape.

Omit `--project` to report all diagnostics under the indexed roots. Add
`--watch` to refresh the JSON after Markdown changes. The scanner uses the same
parser and index validation rules as the plugin; it does not modify the vault.

`npm run diagnostics:check` scans the committed dogfood vault and exits
unsuccessfully if it contains any error-level diagnostic. The command is part
of `npm run check`; warnings and info remain visible for review without failing
the automated gate.

Use `npm run dev` for a watching development bundle. A production build writes
exactly `main.js`, `manifest.json`, and `styles.css` to `dist/`. Install
those files only in a disposable development vault.

Manual checks against Obsidian — the procedure, the disposable test vault, and
the recorded results — are in
[docs/development/testing.md](docs/development/testing.md). Release channels and
the version-sizing rule are in
[docs/development/release.md](docs/development/release.md).

## Obsidian settings

Open **Settings → Community plugins → Project Weave**.

**Indexed project folders** decides what Project Weave reads. A fresh install
defaults to `Projects`. Add a narrower root such as `Projects/Game` when only
one project should be visible. Removing every root intentionally produces an
empty index. Changing roots replaces the current runtime and rebuilds without
retaining out-of-scope notes.

**Template library folder** names where vault-wide templates live, one folder
per kind and one file per variant, such as `task/bug.md`. It is a local
preference: saving it never creates or edits vault content, an empty value uses
the packaged templates only, and a folder nobody has created simply holds no
templates. Project notes may still map their own variants under
`weave.templates`, which travel with the project and take precedence. A project
note cannot map its own project template, since it is the note being created.

**Diagnostics log folder** optionally names a vault-relative folder where
Project Weave writes `diagnostics.json` after each complete index publication.
The report contains diagnostics and index metadata, not note bodies. Leave it
empty to disable the export; saving this setting may create the folder when the
first report is published.

Open the workbench from the left ribbon, **Project Weave: Open project
workbench** in the command palette, or **Open dashboard** on the settings page.
After it has been opened once, Obsidian restores it as part of the workspace.
With multiple indexed projects, use the project selector in the view; with one
project, it is selected automatically. Ready Now and All Tasks open exact
existing task notes in another tab, leaving the workbench open. All Tasks
starts with the non-terminal statuses and can be filtered by status, priority,
epic, milestone, owner, category, due state, and text across titles and paths;
[Design 09](docs/spec/09-project-workbench.md) specifies the behavior in full.

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

Size the increment by the change, not the commit count. Before 1.0 the minor
position carries feature weight:

- **patch** — every exported build that carries changes. The ordinary
  increment.
- **minor** — a numbered slice passing its exit gate, or a change to a
  compatibility surface.
- **major** — reserved for the first stable release against the full
  specification.

[docs/development/release.md](docs/development/release.md) holds the full rule,
including when to bump relative to an export and how to resolve genuine
ambiguity, along with the operational channel, BRAT preview, stable release,
and Community directory steps.

Run `npm run export` to build and verify the plugin, then generate:

- `export/project-weave/` — the directly installable Obsidian plugin folder;
- `export/project-weave-<version>.zip` — a ZIP containing that plugin folder.

The entire `export/` directory is Git-ignored. `npm run release` runs the
complete validation gate and then produces the same export artifacts and
configured test-vault update. Setting up a disposable vault and installing into
it are covered in [docs/development/testing.md](docs/development/testing.md).
