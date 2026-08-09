---
type: spec
area: lifecycle
status: current
canonical: true
related_decisions: ["0006"]
---

# 01 — Lifecycle and Persistence

## Goal

Make Project Weave safe to install, enable, reload, disable, upgrade, and uninstall in any vault without changing project content.

## User-visible behavior

- Installation places only `main.js`, `manifest.json`, `project-weave-mcp.cjs`, and `styles.css` in the plugin folder.
- First activation MAY show onboarding and MAY create plugin settings/cache through Obsidian's plugin data store.
- Activation indexes existing notes but creates, edits, moves, renames, or deletes none of them unless the user has configured the derived diagnostics report; that report is the only non-creation vault output and contains no canonical note content.
- Deactivation closes Project Weave resources cleanly and changes no content.
- Uninstall leaves every project note readable as ordinary Markdown.
- Upgrade may migrate plugin-owned settings but MUST NOT migrate content implicitly.

## Lifecycle sequence

### `onload`

1. Load and schema-check plugin settings, applying in-memory defaults for missing values.
2. Register commands, view types, settings UI, and lightweight processors.
3. Wait for Obsidian's workspace layout to be ready.
4. Register vault and metadata event handlers through plugin-managed registration.
5. Start an asynchronous full index build.
6. Publish index progress and then the first complete snapshot.

No vault scan or expensive data fetch occurs synchronously in `onload`.

### Reload

Reload is equivalent to orderly unload followed by load. It MUST NOT interpret an interrupted UI draft as authorization to write.

### `onunload`

1. Cancel pending debounced index work and mark asynchronous jobs stale.
2. Detach registered resources through Obsidian's component lifecycle.
3. Dispose views/subscriptions and release index snapshots.
4. Discard uncommitted proposals and modal drafts.

No cleanup write is allowed.

## Persisted plugin data

Allowed settings include configured entity folders, filename templates, UI preferences, onboarding completion, and non-sensitive diagnostic preferences. Disposable caches MAY be persisted only when the same state can be reconstructed from Markdown. Cache format versions must be independent of content schema versions.

Forbidden plugin data includes the only copy of an entity, status, dependency, sprint membership, history, or provenance.

## Event handling

- Event subscriptions begin after layout readiness so startup file enumeration is not mistaken for user-created files.
- Handlers for create, modify, delete, and rename enqueue targeted index updates.
- Event callbacks do no heavy work; repeated events for the same path are coalesced.
- Unloading invalidates queued work through a generation token or cancellation signal.
- The plugin does not infer write permission from an external file event.
- A configured diagnostics log is refreshed only after a complete published
  snapshot; a report-write failure is logged and never blocks publication or
  changes indexed Markdown.

## Failure behavior

- Invalid settings fall back safely and appear in diagnostics; they do not block access to Markdown.
- Index failure leaves commands that require a consistent index disabled and exposes Retry Index.
- One malformed note does not abort the complete index; it becomes a diagnostic record.
- A settings-save failure reports an error but never falls back to a content note.

## Acceptance criteria

- Lifecycle fixture tests prove all content hashes are identical before and after install, activation, reload, deactivation, reactivation, and upgrade.
- Event handlers and timers do not run after unload.
- Repeated reloads do not duplicate commands, views, listeners, or notices.
- A corrupted settings payload starts with safe defaults and preserves the original payload until the user explicitly saves new settings.
- Indexing a large fixture vault does not block the initial workspace render.

## Official API constraints

Use Obsidian-managed event/interval registration and defer expensive initialization until layout readiness. Store plugin-owned settings with the plugin data APIs. See the official [Events](https://docs.obsidian.md/Plugins/Events), [load-time](https://docs.obsidian.md/plugins/guides/load-time), and [plugin guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines) documentation.
