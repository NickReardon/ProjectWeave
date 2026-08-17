---
type: task
title: Map MCP companion transport failures to actionable guidance
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-shared-reads-agent]]'
status: done
category: bug
priority:
points:
rank: 5000
milestone: '[[Milestones/v1 release]]'
---

# Map MCP companion transport failures to actionable guidance

## Summary

A failed tool call surfaced a raw Node syscall error (`connect ENOENT
\\.\pipe\project-weave-nonexistent`) instead of guidance naming the likely
cause and remedy. The security boundary held -- fake credentials returned no
vault data -- but the failure was not actionable.

## Reproduction

```
printf '%s\n' \
  '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"weave_projects_list","arguments":{}}}' \
  | PROJECT_WEAVE_ENDPOINT='\\.\pipe\project-weave-nonexistent' \
    PROJECT_WEAVE_GRANT_ID='grant_fake' PROJECT_WEAVE_GRANT_SECRET='fake' \
    node export/companion/project-weave-mcp.cjs
```

Returned `isError: true` with text `connect ENOENT
\\.\pipe\project-weave-nonexistent`.

## Fix

`src/agent/mcp-companion.ts`: added `describeTransportFailure`, which maps a
transport/syscall failure (`ENOENT`, `ECONNREFUSED`, `ETIMEDOUT`,
`ECONNRESET`, `EPIPE`, and a generic fallback) to a message naming the
likely cause -- gateway not enabled, endpoint stale, vault closed -- and the
remedy, keeping the original error text as parenthetical secondary context.
Added `describeGatewayFailure`, which augments a denial the gateway itself
returns (`gateway.disabled`, `gateway.authentication_failed`) with a
concrete remedy alongside its existing message; `gateway.companion_incompatible`
already names its own remedy and is passed through unchanged. Both paths are
used everywhere a tool result can report failure, and neither ever includes
the grant secret -- only the endpoint path and Node's own error text are
surfaced.

Because connect-time handshake verification (companion task at rank 4900)
now fails the whole process before serving any request when the gateway is
already unreachable at startup, this mapping is exercised on a tool call
specifically when a request fails *after* a successful handshake -- for
example the gateway going away mid-session.

## Verification

Covered by `scripts/mcp-companion.node-test.mjs` ("tool-call transport
failure after a successful handshake: actionable guidance, not a raw
errno"), which lets a fake gateway answer the startup handshake once, then
stops listening so a subsequent tool call forces a real reconnect failure,
and asserts the returned text is not a bare `connect ENOENT`/`ECONNREFUSED`
string, names the gateway as the likely cause, and still preserves the
underlying errno as secondary detail.
