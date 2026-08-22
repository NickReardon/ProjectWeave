# Plugin implementation

`src/` contains the Obsidian composition root and inward-pointing domain,
indexing, application, port, adapter, settings, and UI layers.

## WHERE TO LOOK

| Change                          | Owner                                                                                         |
| ------------------------------- | --------------------------------------------------------------------------------------------- |
| Dependency direction            | `../docs/ARCHITECTURE.md`                                                                     |
| Lifecycle and persistence       | `../docs/project-vault/Projects/Weave/Documents/Specifications/lifecycle-and-persistence.md`  |
| Data model and indexing         | `../docs/project-vault/Projects/Weave/Documents/Specifications/data-model-and-index.md`       |
| Validation and writes           | `../docs/project-vault/Projects/Weave/Documents/Specifications/validation-and-safe-writes.md` |
| Plugin experience               | `../docs/project-vault/Projects/Weave/Documents/Specifications/plugin-experience.md`          |
| Quality and release constraints | `../docs/project-vault/Projects/Weave/Documents/Specifications/quality-and-release.md`        |

Read the owning specification, nearby source, tests, and fixtures for the
behavior being changed.

## CONVENTIONS

- Markdown in the user's vault is canonical; passive indexing, load, settings,
  and navigation preserve it byte-for-byte.
- Dependencies point inward. Domain, indexing, and application code remain
  independent of Obsidian, Node, Electron, UI modules, and transports.
- Obsidian API usage stays in adapters, the entry point, settings, or UI.
- Queries remain project-scoped and bounded, with deterministic ordering,
  immutable snapshots, and explicit diagnostics.
- Project-content writes flow through typed templates, proposals, validation,
  preconditions, and write coordination.
- Invalid notes remain visible as diagnostics; derivable relationships and
  view/index state remain derived.
- The core plugin remains mobile-compatible; desktop transport is conditional.
- Product terms, frontmatter fields, controlled values, diagnostic codes, and
  persisted workspace state are compatibility surfaces.
- Behavior changes include focused regression coverage.
