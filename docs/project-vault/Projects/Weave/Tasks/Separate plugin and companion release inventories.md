---
type: task
title: Separate plugin and companion release inventories
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-stabilize-and-shipping]]'
status: backlog
category: chore
priority: high
rank: 2400
milestone: '[[Milestones/v1 release]]'
origin: '[[Documents/Design/Prerelease and optional MCP companion distribution]]'
created: 2026-08-16
---

# Separate plugin and companion release inventories

## Summary

Refactor build, verification, export, and local-install tooling so the Obsidian
plugin has the standard three-file inventory while the companion remains a
separately verified output from the same source ref.

## Acceptance criteria

- The installable plugin folder and ZIP contain only `main.js`, `manifest.json`,
  and `styles.css`.
- `project-weave-mcp.cjs` is still built and receives its existing read-only
  surface and protocol checks.
- Release verification reports plugin and companion inventories separately.
- Local test-vault and dogfood-vault updates preserve `data.json` and do not
  install the companion as a plugin file.
- Automated tests reject a missing, extra, stale, or mismatched artifact in
  either inventory.

## Validation

Run the complete automated gate, export a clean artifact set, and compare the
installed test-vault files with the plugin export byte for byte.
