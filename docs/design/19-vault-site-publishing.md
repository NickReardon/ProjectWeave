# 19 — Vault site publishing (proposed)

## Status

**Proposed. Not accepted, not implemented, and not yet a contract.**

[Design 14](14-non-goals-and-future-features.md) currently lists
"design-document manifests, continuous assembled reading, compilation, or
export" as an explicit v1 non-goal, with a *candidate: design-document
manifests and compilation* entry that names the design work required first.
This document is that design work. Nothing here becomes normative until it is
accepted, an ADR records the decision, and design 14 is amended to move the
candidate into scope. Until then `docs/design/README.md` deliberately does not
list this file in its coverage table.

The v1 slice in [`CURRENT-DESIGN.md`](../../CURRENT-DESIGN.md) is unchanged by
this proposal. Publishing is additive, runs outside the plugin, and can be
built without touching any implemented plugin behavior.

## Purpose

Turn a Project Weave vault — or selected project folders within it — into a
static, self-contained, interactive HTML site, deployed to a private URL the
owner and a few named people can open from any device.

The site is **Weave-first**: its primary surfaces are the project's plan,
board, readiness, dependencies, and milestones. But a project folder is not
only tasks. Design notes, briefs, research, and ordinary Markdown live beside
the entity notes and are the reason the tasks exist, so **every note in the
published scope gets a page**, and the Weave surfaces link into them.

### Named user problem

A solo developer or small team plans a long-lived project in Obsidian. The
plan is only legible inside Obsidian, on one machine, to someone with the
vault. Sharing state with a collaborator, a publisher, a client, or a future
self means screenshots or copy-paste, and the design documents that give the
tasks meaning do not travel with them.

Observed examples this must serve:

1. Read the current plan and the design note a task points at, on a phone,
   without Obsidian and without the vault.
2. Give a collaborator a URL that shows what is done, what is next, what is
   blocked, and why — without giving them the vault or a copy of it.
3. Keep a durable, diffable snapshot of the project's state at a point in time.

### Non-goals

This proposal does **not** introduce:

- any write to the vault, or any widening of the create-only write boundary;
- an application server, account system, database, or telemetry. Hosting is
  static file serving behind an identity gate the host provides; no Project
  Weave code runs on it;
- editing, commenting, or any write path from the site back to the vault. The
  read-only app is deliberately shaped so a later write phase can reuse its
  data layer and UI, but that phase is out of scope here and needs its own
  design and ADR — see *Room for a later write phase*;
- multi-user identity, permissions, or presence. Access is all-or-nothing per
  viewer and enforced by the host, not modeled in the product;
- a plugin-side publish command in this scope (see *Runtime*);
- publication of the whole vault by default, or of anything not explicitly
  opted in;
- Dataview, Canvas, Bases, plugin-rendered blocks, or arbitrary Obsidian
  plugin syntax;
- incremental or watch-mode rebuild.

### Terminology

The repository already uses **export** for plugin packaging
(`npm run export`, `export/`, `scripts/export-plugin.mjs`). This feature uses
**publish** and **site** exclusively. `npm run publish:site`, `src/publishing/`,
`--out`. No script, path, or type in this feature may be called *export*.

## Runtime and placement

The publisher is a **Node CLI post-processor**, not a plugin feature.

```text
scripts/publish-site.mjs  (thin CLI: argv, fs, exit codes)
  -> src/adapters/node/node-vault-reader.ts   (implements VaultReader over fs)
  -> src/indexing/*                            (existing, unchanged)
  -> src/application/project-workbench-model   (existing, unchanged)
  -> src/publishing/*                          (new, pure)
       -> SitePlan  (what will be published, and why)
       -> SiteModel (pages, links, navigation, data)
       -> EmittedFile[] { path, bytes }
  -> scripts/publish-site.mjs writes EmittedFile[] under --out
```

Why this placement:

- **No new vault-write surface.** The publisher never writes inside the vault.
  It reads through the existing read-only `VaultReader` port, and the only
  code that touches the filesystem for writing is the CLI, which writes under
  an explicit `--out` directory outside the vault.
- **No plugin bundle or mobile impact.** Nothing under `src/publishing/` or
  `src/adapters/node/` is reachable from `src/main.ts`, so `dist/main.js` is
  byte-identical to today and the core plugin stays mobile-compatible.
- **The core is already portable.** Domain, indexing, and application code
  import neither Obsidian nor Node. A second adapter is exactly the seam the
  architecture was built for, and the publisher gets the real parser, the real
  readiness rules, and the real workbench projection rather than a second
  implementation that can disagree with the plugin.

`src/publishing/` obeys the same inward-dependency rule as the rest of the
core: it imports domain, indexing, and application types and nothing else. It
is a pure function from `(snapshot, note contents, config)` to a list of files
with byte contents. It performs no I/O, reads no clock, and uses no randomness.

### Boundary enforcement

Three guards, because the existing release check alone is not sufficient:

1. **ESLint** gains a `src/adapters/node/**` override permitting `node:*`
   imports (the current `src/**` rule bans them), plus a restricted-import zone
   forbidding `src/main.ts`, `src/ui/**`, and `src/adapters/obsidian/**` from
   importing `src/publishing/**` or `src/adapters/node/**`.
2. **`verify-release.mjs`** already fails on unexpected runtime `require()` in
   the bundle, which catches a leaked `node:fs`. It does **not** catch a
   bundled third-party dependency, which esbuild inlines. So it gains a check
   that `dist/main.js` contains no publisher sentinel export name — the same
   technique already used to confirm the allocator is tree-shaken out.
3. **Architecture doc** records the direction so the intent survives the
   tooling.

### CLI build

`src/publishing/` is TypeScript, so the CLI needs a build step. A second
esbuild target emits `tools/publish-site.mjs` (gitignored, Node platform,
external nothing). `dist/` keeps its exact three-file release inventory, so
`verify:release` is unaffected.

```shell
npm run publish:site -- --vault "D:/Vault" --project "Projects/Game" --out "./site"
```

## What gets published

Accidental publication is the dominant risk in this feature: a vault holds
private notes, and a site is handed to someone else. The design is **deny by
default, opt in explicitly, and preview before writing** — the same posture the
task-creation chain already takes toward vault writes.

### Selection

A note is published only if **all** of these hold:

1. It is inside a **selected scope**: a project folder named on the CLI, or a
   configured project root when `--all-projects` is passed. Scope is a folder,
   so ordinary notes beside the entity notes are included by construction.
2. The scope is **opted in**. A project folder is publishable only if its
   project note carries `publish: true` in frontmatter, or the CLI passes
   `--force-scope` for a one-off publish. The frontmatter key is a new
   compatibility surface and must be preserved by the parser as an unknown
   field until then.
3. The note is **not excluded**. `publish: false` on any note excludes it.
   Configured exclude globs exclude it. A note under the template scaffold
   folder is excluded. A note whose path contains a segment beginning `_` or
   `.` is excluded.

Exclusion beats inclusion at every level. A folder-level `publish: false` on a
folder note excludes its subtree.

### The publish manifest

Before any bytes are written, the publisher produces a **manifest**: every
note in scope, its decision (`published` / `excluded`), the rule that decided
it, its output path, and the diagnostics it carries. `--dry-run` prints the
manifest and writes nothing. This mirrors the preview-then-commit shape of task
creation, and it is the first shippable slice.

### Leak rules

- A wiki-link whose target is **not published** renders as its alias or link
  text in plain text. It must not emit the target path, the target title, or
  an href. An unpublished note's existence must not be inferable from the
  site.
- Frontmatter is **not rendered** into pages. Only an allowlist of known
  display fields (status, owner, priority, due date, points, rank, milestone,
  epic, planning period, dependencies) reaches the site, and only through the
  Weave layer. Arbitrary user frontmatter stays private.
- Attachments are copied only when embedded from a published note.
- The manifest is written into the site as `_manifest.json` **only** under
  `--include-manifest`; it is a build artifact, not site content.

## Site structure

```text
<out>/
  index.html                     project home (or project chooser for many)
  plan.html                      milestones, epics, and their tasks
  board.html                     tasks by status, filterable
  ready.html                     Ready Now, with unlock chains
  dependencies.html              dependency and blocker view
  tasks/<slug>.html              one page per task entity
  notes/<vault-path>.html        one page per published ordinary note
  assets/site.css
  assets/site.js
  assets/attachments/...
  data/site.json                 { schema_version, project, tasks, edges, ... }
  data/search.json               lazily loaded search index
  .project-weave-site.json       output marker (version, manifest digest)
```

Task pages and note pages use the same page shell, so a design note and a task
feel like one site. Every entity page links to its origin note and its
backlinks; every note page lists the entities that point at it, which is what
[design 07](07-document-provenance.md) already models as provenance.

## The Weave layer

Weave surfaces are generated from the same publication the plugin uses. The
site must never compute readiness, ordering, or filtering itself:

- readiness, blockers, and dependency edges come from `IndexSnapshot`;
- project summary, counts, Ready ordering, and task lists come from the pure
  `project-workbench-model` projection;
- deterministic ordering and the 200-result bound come with them.

Two consequences worth stating. First, the site and the workbench cannot
disagree, because there is one implementation. Second, the site inherits the
workbench's caps; a project above the bound publishes a truncated list and must
say so on the page rather than silently drop tasks.

Diagnostics are published as a **build report**, not as page banners: a
published site should not surface a reader-facing error for an authoring
problem. Errors are printed by the CLI and, with `--include-manifest`, land in
the manifest.

## Interactivity

One small hand-written vanilla script, no framework and no CDN.

Because the site is served over HTTP rather than opened from a folder, page
data is fetched as JSON and the search index is loaded lazily on first use,
rather than being inlined into a script global. Keep the emitted JSON free of
anything that would break a `file://` fallback anyway — no absolute origins,
no root-relative paths — so a single-file or offline variant stays a build
option rather than a rewrite.

Scope for the first interactive slice:

- client-side filtering of the board and task lists by status, priority, epic,
  milestone, owner, and due state, matching the workbench filters;
- full-text search across published note titles, paths, and headings, from a
  prebuilt index;
- expand/collapse of blocker chains on the dependency view;
- light/dark following `prefers-color-scheme`.

Deferred: a rendered dependency graph, a link graph, per-user saved views.

The site carries no analytics, no external requests, and no fonts or scripts
from a third-party origin. That is a hard constraint, not a preference: a
static site with an outbound request is a privacy leak from the reader's side.

### Reading through a source seam

The app reads its data through a single `SiteReadSource` interface, never by
reaching for a global or a hardcoded URL. The first implementation resolves
the published JSON; the interface is what a later live or write-capable
implementation replaces.

This mirrors `ProjectWeaveReadSource` in the plugin, which already lets open
views survive a replaced indexing runtime, and it is the cheapest thing to get
right now: retrofitting a data seam after the UI is written is expensive, and
declaring one before is nearly free.

## Hosting and access

The site is deployed to static hosting behind an **identity gate provided by
the host**, admitting a named list of people. Cloudflare Pages with Access is
the reference target: named email policies, no application code, no session
handling, and nothing to get wrong in our own auth. Netlify password
protection or an equivalent gate is acceptable.

Constraints on whatever host is chosen:

- authentication is enforced **before** any site byte is served, not by the
  page after load;
- the deploy is driven by the same CLI, so the hosted site and a locally
  published folder are byte-identical;
- no build step runs on the host. It serves files; it does not compile them.

Three things follow, and they should be decided knowingly rather than
discovered:

- **Deploying uploads vault-derived content to a third party.** Gated or not,
  the content leaves the machine. The publish gate and leak rules in *What
  gets published* stay deny-by-default for exactly this reason; they are not
  softened by the audience being small. Any actual deploy is an explicit,
  per-occasion decision by the owner.
- **A gate is not a redaction.** Anyone admitted sees everything published.
  Scope selection, not the access list, is what keeps a note private.
- **The gate is the host's, so it is also the host's outage and the host's
  policy change.** Local publish to a folder must keep working standalone, so
  losing the host costs a URL and not the feature.

## Room for a later write phase

Write-back is out of scope, but three decisions made now keep it from becoming
a rewrite later, and none of them costs anything today:

1. **The source seam above.** A write-capable build swaps the implementation;
   the UI does not learn where data comes from.
2. **Versioned payloads.** Every emitted data file carries `schema_version`,
   following the query API convention, so a later client can refuse a payload
   it does not understand instead of misreading it.
3. **Actions stay absent, not disabled.** The read-only app ships no greyed-out
   edit affordances and no dead handlers. A control that cannot act should not
   exist, so nothing implies a capability the build does not have — the same
   reasoning behind the creation preview modal offering no confirm action
   before a commit coordinator existed.

What a write phase would additionally need, none of it started here: an
application server, authenticated sessions, the typed proposal and commit
chain re-hosted server-side, conflict handling against Obsidian editing the
same files, and an amendment to the design 14 non-goals. It is a separate
product decision with its own ADR.

## Markdown rendering

`markdown-it` handles CommonMark plus tables and footnotes, with raw HTML
passthrough **disabled by default** (`--allow-raw-html` opts in). Obsidian
syntax markdown-it does not know is handled by small local plugins in
`src/publishing/markdown/`:

| Syntax                     | v1 behavior                                      |
| -------------------------- | ------------------------------------------------ |
| `[[note]]`, `[[note\|alias]]` | Link if published; plain text if not             |
| `[[note#heading]]`         | Link plus anchor, when the heading exists         |
| `![[image]]`               | Copy attachment, emit `<img>`                     |
| `![[note]]`                | Inline the published note's rendered body once    |
| `> [!note]` callouts       | Styled callout block                              |
| `- [ ]` / `- [x]`          | Disabled checkboxes                               |
| `#tag`                     | Rendered as a tag chip; tag pages deferred        |
| Dataview / Canvas / Bases  | Rendered as a labeled unsupported-block notice    |

Wiki-link resolution reuses `PathLinkResolver` against the **published** path
set, not the vault path set. An `ambiguous` resolution is a build warning and
renders as plain text; guessing which note was meant is exactly the kind of
silent repair the project forbids elsewhere.

Headings get deterministic slug anchors so `[[note#heading]]` and the search
index agree.

## Determinism and safety

**Determinism.** The same vault bytes and the same config produce byte-identical
output. The pure layer reads no clock and no environment; the CLI injects a
build stamp explicitly, the same way the UI injects the civil date into the
workbench projection today. `--no-build-stamp` omits it entirely so two
publishes of an unchanged vault diff to nothing. This makes republishing
idempotent, makes the site diffable in version control, and makes golden-file
tests possible.

**Output safety.** The CLI:

- refuses an `--out` that resolves inside the vault;
- refuses an existing non-empty `--out` that lacks the
  `.project-weave-site.json` marker;
- deletes only files listed in the previous run's marker, never a path it did
  not produce;
- writes to a temporary directory and moves into place, so an interrupted
  publish cannot leave a half-site;
- exits non-zero on any error and reports that the output is unchanged.

## Delivery slices

Each slice stands alone, builds, is tested, and is separately useful.

**0 — Acceptance.** ADR recording the post-processor decision and the
deny-by-default publish gate. Amend design 14 to move the candidate into
scope. Add this file to the design index. *No code.*

**1 — Read and manifest.** `NodeVaultReader` implementing `VaultReader` over
`node:fs`, the ESLint override and boundary zone, the second esbuild target,
and `publish:site --dry-run` printing the manifest. Nothing is written
anywhere. *Acceptance: against `tests/fixtures/vault/`, the manifest lists the
expected published and excluded notes with the deciding rule for each; running
against a scope whose project note lacks `publish: true` publishes nothing.*

**2 — Note pages.** The pure site model and emitter, Markdown rendering, link
resolution against the published set, attachment copying, the page shell, and
the marker-guarded writer. *Acceptance: every published note has a page,
unpublished targets leak nothing, and two runs produce identical bytes.*

**3 — Weave surfaces.** Project home, plan, board, ready, dependency views,
and task pages, all from the existing snapshot and workbench projection.
*Acceptance: the site's task lists, ordering, readiness, and counts match the
workbench for the same vault.*

**4 — Interactivity.** The `SiteReadSource` seam, the versioned data payloads,
the lazy search index, client-side filters, and blocker expansion.
*Acceptance: filters reproduce the workbench's results for the same vault, and
the loaded page issues no request to any origin other than its own.*

**5 — Presentation.** Theming, responsive layout, print styles, and an
accessibility pass — semantic landmarks, keyboard-operable filters, visible
focus, contrast, and reduced-motion respect.

**6 — Hosting.** Deploy to gated static hosting, driven by the same CLI, with
the access list configured at the host. README and `docs/MANUAL_CHECKS.md`
entries covering a publish, a deploy, and a revoked viewer.
*Acceptance: an unauthenticated request is refused before any site byte is
served; an admitted viewer sees the site; the deployed bytes equal the locally
published bytes; and a removed viewer is refused on their next request.*

## Testing

- **Golden files.** Publish `tests/fixtures/vault/` and byte-compare against a
  committed expected site. This is the determinism test and the regression net.
- **Leak invariant.** Given a fixture with an excluded note carrying a
  distinctive title and body token, assert those tokens appear in **no** emitted
  byte, including `data/site.json` and the search index. Cheap, and it is the
  test that matters most.
- **No third-party origin.** Assert that no emitted HTML, CSS, or JS references
  an absolute external URL, so the privacy constraint cannot regress quietly.
- **Selection rules.** Unit tests for every include/exclude precedence pair.
- **Link resolution.** Published, unpublished, ambiguous, unresolved, heading
  anchors, and embeds.
- **Parity.** The site's task ordering and readiness are asserted equal to the
  workbench projection's for the same snapshot.
- **Output safety.** Refusal cases: out inside vault, non-empty unmarked out,
  interrupted write.
- **Boundary.** `dist/main.js` contains no publisher symbol and no `node:*`
  import.

## Compatibility surfaces

New and therefore versioned from the start: the `publish` frontmatter key, the
CLI flag set, the output directory layout, the emitted data payload schemas
(each carrying `schema_version`, following the query API's convention), the
`SiteReadSource` interface, and the `.project-weave-site.json` marker format.

The data payload schema deserves the most care of these. It is the contract a
later live or write-capable client would speak, so a shape chosen carelessly
now is the one that constrains that phase.

## Open questions

1. **Multi-project sites.** One site per project, or one site with a project
   chooser? The layout above supports both; the first slice should publish one
   project and defer the chooser.
2. **Attachment policy.** Images are clear. PDFs, audio, and video have real
   size consequences for a folder handed to someone — copy, link, or skip by
   extension allowlist?
3. **Task page necessity.** A task's content is mostly frontmatter the Weave
   layer already renders. Is a per-task page worth it, or should tasks be rows
   that expand in place?
4. **Completed-work history.** Should the site publish `done` tasks and
   completion timestamps by default, or is a finished-work view opt-in?
5. **Where config lives.** CLI flags only, a committed `publish.config.json`,
   or frontmatter on the project note. Frontmatter keeps the vault canonical,
   which is the house style, but puts build config in user content.
6. **Publish cadence.** Manual publish, or automatic on vault change? A hosted
   site invites "why is this stale?" in a way a handed-off folder does not.
   Automatic needs the vault in version control and a CI runner that can see
   it; manual needs the site to state plainly how old it is. The site should
   show its build stamp either way.
7. **Staleness while reading.** If someone has the page open when a republish
   lands, do they get a quiet refresh prompt, or nothing until reload? Nothing
   is defensible for a read-only snapshot and is the assumed default.
