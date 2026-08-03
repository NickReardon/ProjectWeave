# Project Weave

Project Weave is a Markdown-first Obsidian project workbench for a solo
developer or small team building one substantial, long-lived project. It
connects design notes to a ranked backlog, dependency-aware board work, and a
clear Ready Now sequence without requiring sprints, estimates, owners, or
other process features a project does not use.

The current product direction and normative reading order are in
[CURRENT-DESIGN.md](CURRENT-DESIGN.md).

## Current status

The first read-only walking slice is implemented:

- strict TypeScript Obsidian plugin and production bundle;
- asynchronous, non-writing Markdown indexing behind read-only ports;
- project, epic, task, milestone, planning-period, relation, and diagnostic
  parsing;
- dependency readiness, reverse edges, provenance, and deterministic ordering;
- bounded project context, task context, and Ready Now application queries;
- an Obsidian **Open Ready Now** command and modal;
- a persisted Obsidian settings tab for project-folder discovery and template
  scaffold location;
- fixture-backed parser, index, query, incremental-update, lifecycle, and
  release-inventory tests.
- CI runs the same complete check on supported Node.js versions.

Task creation, template rendering, proposal commits, full Plan/Board/My Work
views, and agent/MCP transport remain later slices.

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

For the Ready Now walking-slice test, copy the contents of
`tests/fixtures/vault/` into a disposable vault. Its project is nested under
`Projects/Game/`, with the canonical project note at
`Projects/Game/Project.md`.

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
