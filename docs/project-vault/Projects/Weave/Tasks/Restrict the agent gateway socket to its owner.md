---
type: task
title: Restrict the agent gateway socket to its owner
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-shared-reads-agent]]'
status: backlog
category: bug
priority: normal
rank: 5800
milestone: '[[Milestones/v1 release]]'
created: 2026-08-17
---

# Restrict the agent gateway socket to its owner

## Summary

`LocalAgentBridge` calls `server.listen(this.#endpoint)` with no explicit
permissions. On Linux and macOS the resulting Unix-domain socket file takes its
mode from the process umask, so on a shared machine another user may be able to
open it. The grant secret still refuses them any data, but the connection
itself should not be reachable.

This is the only identified case where the gateway grants access the filesystem
does not already grant, which is why it is worth closing independently of
[[Tasks/Revisit whether the agent grant secret is load-bearing]].

## Acceptance criteria

- The endpoint is reachable only by the user running Obsidian.
- Behavior is unchanged on Windows, where the transport is a named pipe rather
  than a socket file.
- Disabling the gateway still leaves no listener and no socket file behind.

## Notes

Cheap now, awkward later: once testers hold grants in the field, changing the
endpoint's permissions risks breaking working configurations. The existing
teardown already removes the endpoint file on stop, so the lifecycle hook to
extend is present.
