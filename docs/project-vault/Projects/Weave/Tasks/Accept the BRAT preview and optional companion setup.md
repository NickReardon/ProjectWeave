---
type: task
title: Accept the BRAT preview and optional companion setup
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-stabilize-and-shipping]]'
status: backlog
category: manual-check
priority: high
rank: 2700
milestone: '[[Milestones/v1 release]]'
depends_on: ['[[Tasks/Automate the BRAT prerelease channel]]']
origin: '[[Documents/Design/Prerelease and optional MCP companion distribution]]'
created: 2026-08-16
---

# Accept the BRAT preview and optional companion setup

## Summary

Prove the public instructions and both optionality paths against an actual
prerelease before inviting testers.

## Acceptance criteria

- BRAT installs and updates the plugin using only the standard three files.
- Core desktop and mobile behavior works without the companion present.
- The README command installs the exact companion version and verifies its
  published checksum.
- A real MCP client connects through a scoped grant and exercises the bounded
  read-only tool inventory.
- Missing, stale, incompatible, revoked, and removed companions fail with
  actionable guidance and do not affect core plugin use.
- The recorded result names prerelease version, source SHA, Obsidian version,
  BRAT version, MCP client, operating system, and observed limitations.

## Validation

Run the BRAT and companion paths from clean disposable environments, then
record the evidence here before changing this task to done.

## Partial evidence

On 2026-08-17, the pinned updater installed private prerelease
`0.7.0-beta.1` from GitHub into the disposable test vault using authenticated
release-asset downloads. The installed manifest and exact three-file inventory
matched the tag, and local settings were preserved. BRAT, Obsidian runtime, and
companion-client acceptance remain outstanding.

Corrected workflow run `32012926052` then published prerelease
`0.7.0-beta.32012926052` from
`de86a86340c27f08487c714a72c56de9933f5c67`. Direct release inspection found
exactly the three plugin assets plus the companion and its checksum; the
downloaded manifest named the release version and minimum Obsidian `1.8.0`, and
the companion SHA-256 matched
`c5fbeda4a707e1928d88a9de20d771df2e5988e691f3eba50577f4c0c7abe6c6`.
The disposable vault is prepared with Obsidian `1.12.7` and BRAT `2.2.0`; the
actual BRAT command and runtime checks remain outstanding.
