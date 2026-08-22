---
type: decision
id: '0021'
area: release
status: accepted
canonical: false
affects: ['quality-and-release', 'agent-access-and-mcp', '0018']
---

# ADR 0021: Distribute the MCP companion as an optional release asset

- Status: accepted
- Date: 2026-08-16
- Owners: core

## Context

ADR 0018 selected a separate stdio companion process for desktop agent access.
The implementation currently builds that process as `project-weave-mcp.cjs`
and treats it as a fourth installed plugin file. Obsidian and current BRAT
installations, however, install only the standard plugin assets: `main.js`,
`manifest.json`, and optional `styles.css`. They do not install arbitrary
additional release assets.

The core Project Weave plugin is useful without agent access. Keeping the
optional companion inside the mandatory plugin inventory would therefore make
ordinary distribution depend on a file the supported Obsidian channels do not
install, while moving it to a separate repository would split source history,
versioning, tests, and release coordination for two tightly coupled transport
halves.

## Decision

Keep the MCP companion source, tests, and build in the Project Weave
repository, but separate its distribution from the Obsidian plugin package.

- The installable Obsidian plugin contains exactly `main.js`, `manifest.json`,
  and `styles.css`.
- The same release may attach `project-weave-mcp.cjs` as an additional optional
  asset built from the same source ref. BRAT and Obsidian are expected to ignore
  it.
- The plugin never downloads, installs, updates, or executes the companion.
- The public README links to the companion and provides an explicit,
  version-pinned installation command, checksum verification, compatibility
  guidance, and MCP client configuration.
- Plugin behavior and mobile compatibility do not depend on whether the
  companion is installed.
- Companion/bridge compatibility is versioned and fails closed when the two
  sides cannot communicate safely.

## Alternatives considered

- **Keep the companion in the installed plugin inventory:** rejected because
  Obsidian and BRAT do not install arbitrary fourth assets and ordinary plugin
  use does not require the companion.
- **Move the companion to a separate repository:** rejected for now because it
  adds cross-repository versioning and release coordination without improving
  the runtime security boundary.
- **Have the plugin download the companion:** rejected because downloading
  executable JavaScript outside Obsidian's release path adds review,
  supply-chain, network, and lifecycle risk.
- **Embed and export the companion from `main.js`:** rejected because it grows
  every plugin install for an optional feature and makes the plugin write an
  executable sidecar.

## Consequences

- Positive: BRAT and Community Plugin installation follow Obsidian's standard
  three-file contract.
- Positive: the companion remains tested and versioned beside the bridge it
  connects to.
- Positive: agent access stays visibly optional and requires an explicit user
  setup step.
- Negative: agent users perform a separate installation and must keep a
  compatible companion version.
- Negative: release automation must verify two inventories and publish the
  companion asset without implying that BRAT installs it.
- Follow-up work: update export/release automation, public documentation,
  prerelease publication, and end-to-end BRAT plus companion acceptance.
