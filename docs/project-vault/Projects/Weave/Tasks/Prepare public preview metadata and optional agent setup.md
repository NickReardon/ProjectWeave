---
type: task
title: Prepare public preview metadata and optional agent setup
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-stabilize-and-shipping]]'
status: backlog
category: chore
priority: high
rank: 2500
milestone: '[[Milestones/v1 release]]'
depends_on: ['[[Tasks/Separate plugin and companion release inventories]]']
origin: '[[Documents/Design/Prerelease and optional MCP companion distribution]]'
created: 2026-08-16
---

# Prepare public preview metadata and optional agent setup

## Summary

Make the repository understandable and supportable for invited BRAT preview
users, including a clear optional path for installing the MCP companion.

## Acceptance criteria

- The root README leads with user-facing installation, first-use, limitations,
  write behavior, compatibility, and support information.
- The repository has an explicitly approved license plus accurate author and
  support metadata.
- Network, local IPC, grant-secret, note-access, and no-telemetry behavior are
  disclosed.
- The optional agent section links to the versioned companion asset and gives a
  pinned install command, published checksum verification, compatibility
  guidance, MCP client configuration, update, and removal instructions.
- The instructions never imply that BRAT or the plugin installs the companion.

## Validation

Follow the public instructions from a clean checkout and clean MCP client
configuration, recording every undocumented assumption as a defect.

Implementation is committed and pushed as `6f6b8fb` on
`test/brat-preview-acceptance`: MIT licensing,
named author/support metadata, contribution and security guidance, explicit
privacy/network disclosures, a pinned companion download and checksum command,
and a current preview reference are present. Final acceptance still requires
following those instructions from a clean checkout and deciding when to make
the repository public.
