---
type: task
title: Install a pinned GitHub release into a configured plugin folder
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-stabilize-and-shipping]]'
status: done
category: chore
priority: high
rank: 2450
milestone: '[[Milestones/v1 release]]'
depends_on: ['[[Tasks/Separate plugin and companion release inventories]]']
origin: '[[Documents/Design/Prerelease and optional MCP companion distribution]]'
created: 2026-08-17
completed: 2026-08-17
---

# Install a pinned GitHub release into a configured plugin folder

## Summary

Provide a repository-owned update command that exercises the same individual
GitHub release assets a preview user receives and installs them into an exact,
locally configured Obsidian plugin directory.

## Acceptance criteria

- Ignored `.env` values configure the exact
  `.obsidian/plugins/project-weave` destination and pinned release tag, while
  process environment values take precedence.
- Only `main.js`, `manifest.json`, and `styles.css` are downloaded from the
  configured GitHub repository and exact tag.
- Every artifact is staged and validated before the installed plugin changes.
- The updater rejects broad destinations, mismatched manifests, missing or
  empty assets, and source-mapped production bundles.
- `data.json` and unmanaged local files are preserved; the retired in-plugin
  companion is removed.

## Validation

Automated tests cover local configuration precedence, destination safety,
managed URLs, failure without target mutation, settings preservation, and
retired-file cleanup. The complete gate passes. A real network install remains
part of preview acceptance after a prerelease exists.
