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
what changed.

## Current status

The first two read-only walking slices are implemented:

- strict TypeScript Obsidian plugin and production bundle;
- asynchronous, non-writing Markdown indexing behind read-only ports;
- project, epic, task, milestone, planning-period, relation, and diagnostic
  parsing;
- dependency readiness, reverse edges, provenance, and deterministic ordering;
- bounded project context, task context, and Ready Now application queries;
- a persistent Obsidian Project Workbench with a project picker, project
  summary, live index state, and bounded Ready Now list;
- visible project and unassigned diagnostic sections grouped by affected note,
  with severity, error code, field, recovery guidance, related-note links, and
  exact-note navigation;
- compact, live diagnostic banners above affected Markdown notes in editing
  and reading modes without modifying note content;
- ribbon, command-palette, and settings entry points for the workbench;
- workspace-restored project selection and task navigation that preserves the
  dashboard tab;
- an Obsidian **Open Ready Now** command and modal for the compact flow;
- a persisted Obsidian settings tab for project-folder discovery and template
  scaffold location;
- a plugin-lifetime read publication layer that keeps open views current when
  indexed project folders replace the indexing runtime;
- a deterministic task-template renderer in the domain, covering template
  parsing, typed variable substitution, optional-field omission, conditional
  body blocks, and entity-type/project invariants;
- fixture-backed parser, index, query, dashboard projection, template
  rendering, incremental-update, lifecycle, and release-inventory tests.
- CI runs the same complete check on supported Node.js versions.

The template renderer is a pure core service with no caller yet: nothing in
the running plugin renders, proposes, or writes a note. Task creation UI,
project template-map resolution, proposal commits, full Plan/Board/My Work
perspectives, portfolio views, and agent/MCP transport remain later slices.
The repository does not currently designate which later slice comes next.

## Note templates

`templates/default/` holds the packaged starter templates. Only
`templates/default/task.md` is currently used by code; the plugin embeds a
copy so rendering works without filesystem access, and a test keeps the two
byte-identical. The remaining files are inputs for later slices.

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

The **Template scaffold folder** is a local destination preference for the
future template-initialization flow. Canonical template mappings remain in the
project note so they travel with the project; saving this preference never
creates or edits vault content.

Open the dashboard from the left ribbon, **Project Weave: Open project
workbench** in the command palette, or **Open dashboard** on the settings page.
After the view has been opened once, Obsidian restores it as part of the
workspace. With multiple indexed projects, use the project selector in the
view; with one project, the dashboard selects it automatically. Ready task
buttons open exact existing task notes in another tab, leaving the dashboard
open.

For the dashboard and Ready Now walking-slice test, copy the contents of
`tests/fixtures/vault/` into a disposable vault. Its project is nested under
`Projects/Game/`, with the canonical project note at
`Projects/Game/Project.md`. Open the workbench, confirm **Implement request**
is the one Ready task, then edit a task dependency or status and confirm the
view refreshes after index publication. The older **Open Ready Now** command
remains available as a compact modal.

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

Run `npm run export` to build and verify the plugin, then generate:

- `export/project-weave/` — the directly installable Obsidian plugin folder;
- `export/project-weave-<version>.zip` — a ZIP containing that plugin folder.

The entire `export/` directory is Git-ignored. `npm run release` runs the
complete validation gate and then produces the same export artifacts.
