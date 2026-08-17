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

On 2026-08-17, BRAT 2.2.0 installed public prerelease
`0.7.0-beta.32018589204` from source
`b5a397b14c25c483e29de077d8d450c282f76b54` into the disposable vault using
only `main.js`, `manifest.json`, and `styles.css`. Obsidian 1.13.7 (installer
1.12.7) loaded that exact version on Windows 11, and the README download
installed the matching companion with its published checksum intact. Core
desktop use remained available without the companion; mobile-emulation smoke
evidence is recorded in Check 14.

The published prerelease is not accepted. Enabling its gateway failed because
the bundled desktop adapter retained `import("node:net")`, which Electron tried
to fetch as a browser module. Acceptance also showed that the bridge request
carried no plugin/companion compatibility version. The current branch replaces
the dynamic Node imports with lazy desktop-only `require` calls, makes release
verification reject dynamic `node:` imports, and adds an exact same-release-tag
handshake. With prospective same-version artifacts, a purpose-built MCP SDK
1.30.0 client under Node 24.11.1 passed all ten tools, project/root boundaries,
revocation, and shutdown; the prior companion failed closed with actionable
same-tag guidance. A new prerelease and a clean rerun of this task remain
required before inviting testers.
