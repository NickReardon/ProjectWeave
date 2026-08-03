# Architecture

## Status

The first read-only slices implement the shared core and persistent project
workbench described by Designs 01, 02, 09, 16, and 17. ADRs 0006 and 0007
record the platform baseline and workspace-view decisions. The deterministic
task-template renderer, project template resolver, and exact task-creation
proposal builder implement the first non-writing creation path from Plan
Addendum 005, Design 18, Design 10, and ADR 0005.

## Dependency direction

```text
Obsidian workspace view, commands, and modal
  -> stable read publications
      -> workbench projection or application query API
      -> immutable index snapshot
          -> Markdown parser and domain rules

Obsidian Vault and MetadataCache
  -> persisted project-root scope
      -> read-only VaultReader and LinkResolver ports
      -> index coordinator and builder

future creation callers (UI or agent adapter)
  -> task creation proposal service
      -> project task-template resolver
          -> read-only VaultReader and LinkResolver ports
      -> creation context, template source, and invariants
          -> task template renderer
              -> template parser and Markdown parser
```

Dependencies point inward. Domain, indexing, and application modules do not
import Obsidian, Node, Electron, views, or future MCP code.

## Implemented boundaries

- **Domain:** supported entities, controlled values, diagnostics, wiki-link
  parsing, template exclusion, workflow defaults, and readiness concepts live
  under src/domain.
- **Templates:** src/domain/templates parses a Markdown template into reserved
  metadata, declared typed inputs, frontmatter properties, and a body, then
  renders one task note from an injected creation context. Rendering is a pure
  function of its request: it reads no clock, environment, network, or file.
  Precedence runs template static values, context defaults and explicit typed
  inputs, then the entity-type and selected-project invariant overlay. The
  packaged minimal task template is embedded as a plugin asset, and every
  rendered note is re-parsed with the ordinary entity parser before it is
  returned. The renderer produces content only; it has no write capability and
  no proposal, path-allocation, or template-map resolution behavior; those
  concerns stay in application services.
- **Indexing:** IndexBuilder deterministically publishes a complete immutable
  snapshot. IndexCoordinator owns asynchronous rebuilds, coalesced targeted
  reads, revisions, stale-last-good state, and unload cancellation.
- **Application:** ProjectWeaveQueryApi returns schema-versioned, explicitly
  project-scoped, bounded DTOs for project context, task context, and Ready Now.
  ProjectWeaveReadSource publishes snapshot-bound query APIs across replaceable
  indexing runtimes. The pure Project Workbench projection derives all visible
  counts, selection states, bounded project and unassigned diagnostics, and
  Ready ordering from one publication. Diagnostic details preserve severity,
  code, field, recovery guidance, and related-note paths for exact read-only
  navigation. Unassigned diagnostics cover malformed entities and unresolved
  ownership without guessing from folder layout.
- **Creation proposals:** TaskTemplateResolver reads project-owned task
  mappings through the existing read-only ports, resolves default/named
  variants, and fails closed on explicit reference errors.
  TaskCreationProposalService renders one exact create proposal with
  fingerprints, target-absence and index-freshness preconditions, exact
  frontmatter/content, and expected postconditions. Neither service can write.
- **UI:** the Project Workbench and note-diagnostic banner consume the stable
  read publication. The banner mounts through public Markdown view containers,
  refreshes on workspace and index publications, and never edits Markdown.
- **Ports:** VaultReader has read/list methods only. LinkResolver isolates
  Obsidian link semantics.
- **Adapters:** src/adapters/obsidian is the only vault/API integration. It uses
  Vault.cachedRead, MetadataCache link resolution, and TFile metadata; it
  filters paths before content reads and exposes no content-write primitive.
- **Entry point/UI:** src/main.ts registers the persistent workbench before
  layout restoration, defers indexing until layout readiness, registers managed
  scope-aware vault events, owns runtime replacement after a scope change, and
  exposes ribbon, command, settings, workbench, and compact Ready Now entry
  points. The workbench stores only its selected project path in Obsidian
  workspace state.

## Lifecycle and safety

Plugin load constructs services and commands but does not scan synchronously.
After layout readiness it registers events and starts an asynchronous full
read of configured project roots. Create/modify/delete/rename events are
filtered against the active scope and coalesced; an ordinary update rereads
only affected notes and rebuilds derived projections from cached sources.
Changing roots persists settings before atomically replacing the reader and
coordinator. One plugin-lifetime read source binds the replacement before the
old coordinator is disposed, publishes an empty rebuilding snapshot
immediately, and prevents callbacks from a retired runtime reaching open views.
Unload cancels pending publication and timers and disposes view subscriptions.
None of these paths has access to a write-capable vault port.

Content-changing work will enter through separate typed Template, Proposal, and
Write Coordinator services. Views and future agent adapters must call those
services rather than acquire generic file mutation access. Template rendering,
project task-template resolution, and one-file task proposal construction are
implemented. The proposal carries the read set and exact output a future
coordinator must recheck after confirmation. No write coordinator or runtime
caller exists, so nothing in the current plugin can commit a proposed note.

## Release boundary

The repository contains source, tests, fixtures, and design material. The
installable dist directory contains exactly main.js, manifest.json, and
styles.css. The core plugin remains mobile-compatible; desktop-only agent
transport must be conditionally isolated in a later adapter.

The package.json version is canonical and is synchronized explicitly to the
lockfile, Obsidian manifest, and versions.json. The ignored export directory
contains a directly installable project-weave folder and a versioned ZIP; both
are derived only from the verified dist inventory.

## Decision records

Material choices should be recorded in `docs/decisions/` using the template in `0000-template.md`. Keep each record concise and preserve superseded decisions for context.
