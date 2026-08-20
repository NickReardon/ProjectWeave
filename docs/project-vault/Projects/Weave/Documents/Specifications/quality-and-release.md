---
type: spec
area: quality
status: current
canonical: true
related_decisions: ["0006", "0021"]
---

# Quality, Compatibility, and Release

## Goal

Ship reproducible plugin artifacts only after domain, fixture-vault, lifecycle, UI, and compatibility evidence demonstrates the Markdown safety contract.

## Test layers

### Unit

Pure tests cover schema parsing, controlled values, links, readiness, dependency cycles, reverse edges, iterations, owner filters, project/epic membership, sprint eligibility/overlap, commitment totals, closing outcomes, history, diagnostics, and proposal validation.

### Repository/component

Use in-memory or fixture-backed adapters to test frontmatter edits, body/unknown-field preservation, collision handling, concurrent-change detection, deterministic proposal output, and partial-failure reporting.

### Fixture-vault integration

The checked-in fixture vault contains:

- multiple projects and duplicate note titles in different folders;
- project and portfolio sprints across all statuses;
- same- and cross-project dependencies, cycles, cancelled prerequisites, and broken links;
- epics spanning sprints;
- iteration chains and malformed chains;
- provenance at note/missing/existing heading levels;
- legacy tasks and representative migration mappings;
- manually edited inconsistent states and unknown frontmatter fields.

Tests compare incremental index results with clean full rebuilds.

### Lifecycle safety

Hash every content file before and after install simulation, activation, layout readiness, reload, unload, reactivation, settings migration, and plugin upgrade. Unless a test invokes a named write command, hashes and file inventories must match byte-for-byte.

### UI and manual

Test desktop/mobile rendering, default/light/dark/high-contrast themes, keyboard-only operation, touch alternatives, pop-out windows, workspace restore, external edits, Obsidian link renames, concurrent edits to different notes, and explicit same-note conflict handling.

## Required checks

One documented command runs formatting verification, linting, TypeScript checking, unit/integration tests, and a production build. CI runs the same checks on supported Node versions and publishes no release from a failing run.

## Packaging

The Obsidian plugin package contains exactly:

```text
main.js
manifest.json
styles.css
```

The repository also builds `project-weave-mcp.cjs` from the same source ref as
the plugin. It is an optional companion release asset, not part of the Obsidian
plugin package and not installed by Obsidian or BRAT. The plugin remains fully
usable without it and never downloads it. The public README links to the
companion asset and provides a version-pinned installation command, integrity
verification, compatibility guidance, and MCP client configuration for users
who explicitly opt into desktop agent access.

No source maps with user paths, fixture-vault content, test files, development
dependencies, or secrets enter either release artifact. `manifest.json` ID
matches the plugin folder, uses semantic versioning, declares the chosen
minimum app version, and remains non-desktop-only for v1. Official manifest
requirements are documented at [Obsidian Manifest](https://docs.obsidian.md/Reference/Manifest).

## Compatibility policy

- Record the minimum supported Obsidian version in an ADR before implementation.
- Use documented Obsidian APIs; avoid Node/Electron APIs and direct adapter access where public Vault/FileManager APIs suffice.
- Test the minimum supported version and current stable desktop/mobile versions before release.
- Update `versions.json` only when the minimum app version changes, following [Obsidian's version guidance](https://docs.obsidian.md/Reference/Versions).

## Release gates

- [ ] All automated checks pass from a clean checkout.
- [ ] Lifecycle content hashes pass.
- [ ] Fixture full/incremental indexes agree.
- [ ] Write conflict and injected partial-failure tests pass.
- [ ] Desktop and mobile smoke tests pass.
- [ ] Manifest/version compatibility is valid.
- [ ] Release bundle inventory is exact.
- [ ] Changelog names schema/behavior changes and migration implications.
- [ ] Installation is tested only in a disposable/fixture vault before any real vault.

## Acceptance criteria

- A clean checkout builds and tests with documented commands.
- Plugin and optional companion artifacts are reproducible, separately
  inventoried, and built from the same accepted source ref.
- No passive test lifecycle changes fixture content.
- Every global invariant has at least one positive and negative test.
- Mobile compatibility is proven rather than inferred from desktop behavior.
