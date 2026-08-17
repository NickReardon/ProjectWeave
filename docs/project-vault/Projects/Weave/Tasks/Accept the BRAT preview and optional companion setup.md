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
