# Architecture

## Status

The first read-only vertical slice implements the shared core described by
Designs 01, 02, 16, and 17. ADR 0006 records the TypeScript, build, mobile, and
minimum-Obsidian decisions.

## Dependency direction

```text
Obsidian commands and modal
  -> application query API
      -> immutable index snapshot
          -> Markdown parser and domain rules

Obsidian Vault and MetadataCache
  -> persisted project-root scope
      -> read-only VaultReader and LinkResolver ports
      -> index coordinator and builder
```

Dependencies point inward. Domain, indexing, and application modules do not
import Obsidian, Node, Electron, views, or future MCP code.

## Implemented boundaries

- **Domain:** supported entities, controlled values, diagnostics, wiki-link
  parsing, template exclusion, workflow defaults, and readiness concepts live
  under src/domain.
- **Indexing:** IndexBuilder deterministically publishes a complete immutable
  snapshot. IndexCoordinator owns asynchronous rebuilds, coalesced targeted
  reads, revisions, stale-last-good state, and unload cancellation.
- **Application:** ProjectWeaveQueryApi returns schema-versioned, explicitly
  project-scoped, bounded DTOs for project context, task context, and Ready Now.
- **Ports:** VaultReader has read/list methods only. LinkResolver isolates
  Obsidian link semantics.
- **Adapters:** src/adapters/obsidian is the only vault/API integration. It uses
  Vault.cachedRead, MetadataCache link resolution, and TFile metadata; it
  filters paths before content reads and exposes no content-write primitive.
- **Entry point/UI:** src/main.ts defers indexing until layout readiness,
  registers managed scope-aware vault events, owns runtime replacement after a
  scope change, exposes settings, and opens the read-only Ready Now modal.

## Lifecycle and safety

Plugin load constructs services and commands but does not scan synchronously.
After layout readiness it registers events and starts an asynchronous full
read of configured project roots. Create/modify/delete/rename events are
filtered against the active scope and coalesced; an ordinary update rereads
only affected notes and rebuilds derived projections from cached sources.
Changing roots persists settings before atomically replacing the reader,
coordinator, and query runtime. Unload cancels pending publication and timers.
None of these paths has access to a write-capable vault port.

Content-changing work will enter through separate typed Template, Proposal, and
Write Coordinator services. Views and future agent adapters must call those
services rather than acquire generic file mutation access.

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
