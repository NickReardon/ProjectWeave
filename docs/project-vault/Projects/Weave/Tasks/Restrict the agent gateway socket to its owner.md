---
type: task
title: Restrict the agent gateway socket to its owner
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-shared-reads-agent]]'
status: done
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

## Outcome

`LocalAgentBridge#start` in `src/adapters/desktop/local-agent-bridge.ts` now
tightens `process.umask` to `0o177` on non-Windows platforms across the
synchronous span that binds the socket - the `Promise` executor holding
`server.listen(...)` - and restores the prior umask on the next statement,
before awaiting the `listening`/`error` result. The socket file is therefore
created with mode `0600` (owner read/write only) from the instant it exists.
A chmod-after-listen would leave it briefly world-reachable between bind and
chmod; tightening the umask closes that window instead of narrowing it.
Keeping the tightened span synchronous is itself load-bearing: umask is
process-global, so holding it across an await would have applied it to
unrelated files Obsidian created while the promise was pending, and no other
JavaScript can interleave during a synchronous span.
Windows named pipes have no mode bits, so the change is skipped there and
behavior is unchanged. Teardown was already removing the endpoint file on
stop and needed no change.

Added `tests/adapters/local-agent-bridge.test.ts` coverage, skipped on
win32 with `it.skipIf`, asserting the bound socket file's mode is `0600`
and that the umask is restored after `start()` returns. Updated
`Documents/Specifications/agent-access-and-mcp.md` to document the
owner-only socket bind and to correct the reachability line, which
previously implied the socket was open to any local process; it is now
reachable only by other processes run by the same user. Verified with
`npx vitest run tests/adapters/local-agent-bridge.test.ts`, `npx tsc
--noEmit`, and `npx eslint` on the two changed source/test files, all
passing (the new POSIX-only assertions could not run on this Windows 11
dev machine and were skipped rather than silently passed).
