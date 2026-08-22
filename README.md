# Project Weave

Project Weave is a Markdown-first Obsidian project workbench for a solo
developer or small team building one substantial, long-lived project. It
connects design notes to a ranked backlog, dependency-aware board work, and a
clear Ready Now sequence without requiring sprints, estimates, owners, or
other process features a project does not use.

This file records what is implemented. What Project Weave is specified to do is
in [the specifications](docs/project-vault/Projects/Weave/Documents/Specifications/README.md);
[CURRENT-DESIGN.md](CURRENT-DESIGN.md) is a one-page map of where each kind of
truth lives.

Project support is provided through the
[GitHub issue tracker](https://github.com/NickReardon/ProjectWeave/issues).
Project Weave is released under the [MIT License](LICENSE).

Contributors and coding agents should begin with [AGENTS.md](AGENTS.md), which
defines the branch and small-commit workflow. Work in flight on the current
checkout is in [docs/CURRENT_WORK.md](docs/CURRENT_WORK.md), and `git log` is
the record of what changed and what verification passed. Remaining manual
checks, known loose ends, slice progress, and the dependency-ordered roadmap
are tracked as project, Epic, milestone, and task notes in
[docs/project-vault/](docs/project-vault/), Project Weave's own dogfood vault.

## Preview installation and updates

Project Weave is not yet listed in Obsidian's Community Plugins directory.
Published previews use tagged GitHub prereleases from
[`NickReardon/ProjectWeave`](https://github.com/NickReardon/ProjectWeave).
Invited testers can add that repository through **BRAT: Add a beta plugin for
testing**; BRAT downloads `main.js`, `manifest.json`, and `styles.css` directly
into the vault's `.obsidian/plugins/project-weave/` folder and handles later
updates.

Choose an exact preview tag from the [GitHub Releases](https://github.com/NickReardon/ProjectWeave/releases)
page. BRAT installs only the three plugin files; it never installs the
optional companion.

The repository also provides a pinned direct-update harness. Put the exact
plugin destination and release tag in the ignored local `.env` file:

```text
PROJECT_WEAVE_PLUGIN_PATH=D:\\Vault\\.obsidian\\plugins\\project-weave
PROJECT_WEAVE_RELEASE_VERSION=PASTE_EXACT_PRERELEASE_TAG_HERE
```

Then run `npm run plugin:update`. It downloads all three assets from that exact
GitHub release, validates them before touching the destination, preserves
`data.json`, and removes the obsolete in-plugin companion file. Reload Obsidian
or disable and re-enable Project Weave afterward. A private test repository
also requires `GITHUB_TOKEN` in the process environment; public releases do
not.

### Optional MCP companion

The companion is a separate, desktop-only download. It is not installed by
BRAT or by the plugin. Choose the same exact tag from GitHub Releases:

```shell
tag="PASTE_EXACT_PRERELEASE_TAG_HERE"
release="https://github.com/NickReardon/ProjectWeave/releases/download/$tag"
curl --fail --location "$release/project-weave-mcp.cjs" --output project-weave-mcp.cjs
curl --fail --location "$release/project-weave-mcp.cjs.sha256" --output project-weave-mcp.cjs.sha256
sha256sum --check project-weave-mcp.cjs.sha256
```

The checksum file published with the selected release is authoritative.
Remove both downloaded files and the MCP client configuration to remove the
companion. Core plugin use does not depend on it.

This download only places the file; it does not run it. The companion is a
stdio MCP server that an MCP client launches as a subprocess — see
[Read-only agent access](#read-only-agent-access) for the client configuration
and required environment. Running it directly from a shell fails with a
missing-environment-variable error, because no client supplied the endpoint,
grant id, or secret.

## Current status

This section describes capability — what the plugin does today. It does not
track slice progress; the Epic notes in the dogfood vault own that.

Implemented today:

- **Indexing** — asynchronous, non-writing Markdown indexing behind read-only
  ports, parsing projects, epics, tasks, milestones, planning periods,
  relations, and diagnostics. Dependency readiness, reverse edges, provenance,
  and deterministic ordering are derived rather than stored, and a
  plugin-lifetime publication layer keeps open views current when the indexed
  folders replace the indexing runtime.
- **Queries** — bounded project/task context, Ready Now and My Work, explicit
  search modes with score ordering, exact note/heading reads, related work,
  dependency-respecting sequences, diagnostics, Action Context, and Creation
  Context, each explicitly project-scoped.
- **Agent access** — an optional desktop-only, read-only gateway over an
  authenticated local pipe/socket, plus a stdio MCP companion. It is disabled
  by default; each grant is bound to one vault project and optional document
  roots, and no write or proposal tools are exposed.
- **Workbench** — a persistent Obsidian Project Workbench with a project
  picker, project summary, live index state, a bounded Ready Now list, and a
  project-scoped All Tasks list filterable by status, priority, epic,
  milestone, owner, category, due state, and title or path. Ribbon,
  command-palette, and settings entry points open it, and Obsidian restores it
  with the workspace.
- **Diagnostics** — project and unassigned diagnostic sections grouped by
  affected note, carrying severity, error code, field, recovery guidance,
  related-note links, and exact-note navigation, plus compact live banners
  above affected project and configured template-library notes in editing and
  reading modes. Neither modifies note content.
- **Creation** — a deterministic template renderer in the domain; a read-only
  resolver for project template defaults and named variants with explicit
  packaged fallback and fail-closed broken references; pure target-path and
  rank allocation; exact one-file creation proposals carrying fingerprints,
  target-absence preconditions, rendered bytes, and expected postconditions;
  **Create task** and **Create project** commands and modals showing all of it
  before you confirm; and a commit coordinator that re-reads its inputs,
  compares fingerprints, and re-validates before writing. The coordinator also
  accepts explicitly ordered multi-file create proposals: it preflights every
  target and output before the first write, stops at the first unexpected
  failure, and reports written and unwritten paths exactly. No user workflow
  produces a multi-file proposal yet.
- **Templates** — a vault template library and merged catalog per
  [ADR 0013](docs/project-vault/Projects/Weave/Documents/Decisions/0013-resolve-templates-from-a-vault-template-folder.md),
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
kinds, full Plan/Board/My Work perspectives, portfolio views, and agent
proposal/write tools remain later slices.

### Where notes are created

New task notes are placed in a `Tasks` folder beside the project note, so
`Projects/Game/Project.md` gives `Projects/Game/Tasks/`. A caller may pass a
subfolder beneath it for organization. Titles become filenames with
path-hostile and link-hostile characters replaced; a colliding name gets a
numeric suffix as a visible suggestion, never as a silent overwrite.
[ADR 0008](docs/project-vault/Projects/Weave/Documents/Decisions/0008-derive-task-paths-and-allocate-spaced-ranks.md)
records these rules.

A created project takes a folder of its own inside an indexed project folder:
`Projects/Travel Planner/Project.md`. The folder is the project's identity, so
its tasks land in `Projects/Travel Planner/Tasks/` under the rule above, and a
folder already in use yields a numbered folder rather than a shared one — two
projects in one folder would mingle their tasks.
[ADR 0012](docs/project-vault/Projects/Weave/Documents/Decisions/0012-give-each-project-its-own-folder.md)
records that decision.

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
[ADR 0014](docs/project-vault/Projects/Weave/Documents/Decisions/0014-group-tasks-with-a-vault-wide-category.md)
records the decision, including why a `bug` entity type was rejected.

## Note templates

`templates/default/` holds the packaged starter templates. The plugin embeds
the complete set so future creation services can use them without filesystem
access, and tests keep every embedded copy byte-identical to its editable
source file. Task and project are the kinds with runtime creation flows today;
epic, milestone, planning period, and document starters remain inputs for later
slices.

A task template is chosen per variant from two places, in order:

1. `<template library folder>/task/<variant>.md`;
2. the packaged minimal template, for `default` only.

Every project sees the same vault library. Project-specific overrides are
deferred until they have a configuration workflow that does not require editing
nested project-note frontmatter. A broken, ambiguous, malformed, or wrong-kind
template blocks its variant rather than falling back to another source —
falling back would create bytes other than the ones selected. A variant that
exists nowhere is reported instead of becoming the default by accident.

The create-task modal always shows a **Template** control and the task
destination. When only one variant exists, the control is disabled and the
description says where new tasks can be created; when multiple variants exist,
it lists the merged variants plus **Built-in default** as an explicit escape
hatch and re-previews when you change it. The stable internal selector remains
`builtin:minimal`.

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

A template is an ordinary Markdown note with a `template_for` kind. That is the
only required template metadata: an omitted `template_schema` means schema 1,
and the older `weave_template: true` marker remains optional for compatibility.
Templates are excluded from entity indexing, so one never appears as a task.
Rendering removes template-only keys and keeps every other property. The
renderer executes nothing and reads nothing: it has no clock, network,
environment, or file access, and every value comes from the creation context
its caller supplies.

Template metadata keys, frontmatter and body placeholder syntax, the
`{{#if}}` construct, and the date and time formats are specified in
[Vault note templates](docs/project-vault/Projects/Weave/Documents/Specifications/vault-note-templates.md).

## Development

Node.js 22 or newer is required.

```shell
./agents setup
./agents check
```

On Windows, use `.\agents.cmd`. `./agents help` lists diagnostics, test-vault,
version, export, release, and focused validation verbs. The npm scripts remain
the internal implementation surface used by the task runner.

To inspect the current diagnostics in a vault from the command line, run the
read-only scanner. You can pass the vault directly:

```shell
./agents diagnostics --vault "C:\\path\\to\\vault" --project "Projects/Game/Project.md" --out diagnostics.json --pretty
```

Or put `PROJECT_WEAVE_VAULT=C:\\path\\to\\vault` in a local `.env` file and
run `./agents diagnostics` without `--vault`. The `.env` file is ignored by Git;
`.env.example` shows the shape.

Omit `--project` to report all diagnostics under the indexed roots. Add
`--watch` to refresh the JSON after Markdown changes. The scanner uses the same
parser and index validation rules as the plugin; it does not modify the vault.

`./agents diagnostics:check` scans the committed dogfood vault and exits
unsuccessfully if it contains any error-level diagnostic. The command is part
of `./agents check`; warnings and info remain visible for review without failing
the automated gate.

Use `./agents dev` for a watching development bundle. A production build writes
the three-file Obsidian package to `dist/plugin/` and the optional
`project-weave-mcp.cjs` companion to `dist/companion/`. Install plugin files
only in a disposable development vault.

Manual checks against Obsidian — the procedure, the disposable test vault, and
the recorded results — are in
[Project Weave Manual Checks](docs/project-vault/Projects/Weave/Documents/References/testing.md).
Release channels and the version-sizing rule are in
[Plugin Release and Testing Plan](docs/project-vault/Projects/Weave/Documents/References/release.md).

## Read-only agent access

Three pieces make up agent access, and each runs in a different place: the
plugin hosts a local gateway inside Obsidian; an MCP client (not you) launches
the companion as a stdio subprocess; and the companion connects back to the
gateway over a local authenticated pipe/socket. You configure a client to
start the companion — you never run `project-weave-mcp.cjs` yourself.

On desktop, enable **Read-only agent gateway** in Project Weave settings, then
use **Create grant** to open the grant dialog. It asks which tool the grant is
for, which one indexed project it may read, and an explicit choice between
metadata only and metadata and note text — the folder list appears only for
the second choice, and it stays empty for a metadata-only grant. The create
action stays disabled until the chosen project and every chosen folder
resolve locally against the vault, naming whichever one does not.

A grant is immutable once created: there is no edit operation, so correcting
a mistake means revoking the grant and creating a replacement. Settings shows
every existing grant with its label, grant id, project, and scope — metadata
only, or which content roots additionally expose Markdown bodies — so a
grant's scope is always readable without opening anything.

Pressing **Create grant** both creates the grant and copies a complete,
ready-to-paste client configuration to the clipboard in one step, once, and
never shows or stores it again — capture it immediately, since a lost
configuration means revoking the grant and creating a new one. Like a
WireGuard peer configuration, it arrives whole rather than as loose values
you assemble yourself: it is a full `mcpServers` entry, following the shape
Claude Desktop and similar clients use, with the endpoint, grant id, and
secret already filled in:

```json
{
  "mcpServers": {
    "project-weave": {
      "command": "node",
      "args": ["<path to project-weave-mcp.cjs>"],
      "env": {
        "PROJECT_WEAVE_ENDPOINT": "<the gateway endpoint, empty if currently disabled>",
        "PROJECT_WEAVE_GRANT_ID": "<the new grant's id>",
        "PROJECT_WEAVE_GRANT_SECRET": "<the new grant's one-time secret>"
      }
    }
  }
}
```

The one thing the plugin cannot know — where you placed
`project-weave-mcp.cjs` — is left as the unmistakable placeholder
`<path to project-weave-mcp.cjs>` in `args`, rather than omitted, so it is the
only thing left to edit and it is obvious where. Replace it with the real
path and merge the entry into your client's configuration file. On Windows,
double every backslash in that path — a single backslash inside a JSON string
is a silent failure, not an error.

The companion exposes only bounded read tools. Entity metadata stays within the
grant's project; Markdown bodies additionally require an allowed content root.
The plugin and companion must come from the same exact release tag — including
a locally built companion, which must be paired with a plugin built from the
same source; a mismatch fails closed and tells the client to install the
matching companion. Disabling the gateway closes the local endpoint. Mobile
never starts it.

## Privacy and network behavior

Project Weave has no analytics or telemetry. The plugin reads Markdown only
from configured indexed roots and writes a new note only after you confirm the
exact preview; indexing, navigation, settings, and dashboards do not edit
existing notes. The optional desktop gateway uses a local authenticated
pipe/socket, and the companion connects to that local endpoint over stdio.
Grant IDs and secrets are generated locally, shown only at creation, and must
be supplied through the MCP client's environment. GitHub network access is
limited to BRAT or the explicitly invoked release updater; it is not part of
ordinary vault indexing or plugin use.

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
templates. The library is shared by every indexed project; project-specific
template selection is deferred.

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
[Project workbench](docs/project-vault/Projects/Weave/Documents/Specifications/project-workbench.md)
specifies the behavior in full.

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

[Plugin Release and Testing Plan](docs/project-vault/Projects/Weave/Documents/References/release.md)
holds the full rule, including when to bump relative to an export and how to
resolve genuine ambiguity, along with the operational channel, BRAT preview,
stable release, and Community directory steps.

Run `./agents export` to build and verify the plugin, then generate:

- `export/project-weave/` — the directly installable Obsidian plugin folder;
- `export/project-weave-<version>.zip` — a ZIP containing that plugin folder;
- `export/companion/project-weave-mcp.cjs` and its SHA-256 file — the optional
  desktop agent companion, installed separately from the plugin.

The entire `export/` directory is Git-ignored. `./agents release` runs the
complete validation gate and then produces the same export artifacts and
configured test-vault update. Setting up a disposable vault and installing into
it are covered in
[Project Weave Manual Checks](docs/project-vault/Projects/Weave/Documents/References/testing.md).
