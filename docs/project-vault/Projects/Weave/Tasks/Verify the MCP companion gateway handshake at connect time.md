---
type: task
title: Verify the MCP companion gateway handshake at connect time
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-shared-reads-agent]]'
status: done
category: bug
priority:
points:
rank: 4900
milestone: '[[Milestones/v1 release]]'
---

# Verify the MCP companion gateway handshake at connect time

## Summary

`initialize` and `tools/list` advertised the full ten-tool inventory and
`serverInfo.version` without ever contacting the gateway. Every operation
already carries an exact same-release-tag version handshake
(`ReadOnlyAgentGateway.handle`), but nothing exercised it until an agent's
first `tools/call`, so a version-mismatched, disabled, or misconfigured
gateway looked like a clean successful connection during setup.

## Reproduction

```
printf '%s\n%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"probe","version":"0"}}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' \
  | PROJECT_WEAVE_ENDPOINT='\\.\pipe\project-weave-nonexistent' \
    PROJECT_WEAVE_GRANT_ID='grant_fake' PROJECT_WEAVE_GRANT_SECRET='fake' \
    node export/companion/project-weave-mcp.cjs
```

Both requests succeeded against a dead endpoint with fake credentials.

## Fix

`src/agent/mcp-companion.ts`: `main()` now performs one lightweight,
always-permitted gateway request (`projects_list`) before constructing the
stdio transport. This reuses the exact authentication and
companion/plugin-version check every other operation already goes through,
so a disabled gateway, stale endpoint, revoked grant, or version mismatch is
caught here instead of lazily on first use. On failure the process exits
non-zero with one actionable line to stderr and the stdio transport never
connects, so no client can observe a successful connection to a companion
that cannot serve requests.

Design choice: fail before serving any request (process exit, non-zero,
one-line stderr) rather than encoding the failure inside a returned
`initialize` result or relying on how a given MCP client surfaces a failed
`initialize` RPC. MCP clients vary in how they render a failed `initialize`;
every client that spawns a stdio subprocess already has to handle that
subprocess exiting during startup, so this keeps the failure path uniform,
client-agnostic, and identical in shape to the missing-env-var fix.

After the fix, the same reproduction fails closed:

```
Could not reach the Project Weave gateway at \.\pipe\project-weave-nonexistent.
Confirm Obsidian is running with this vault open and Agent Access enabled in
Project Weave settings, and that PROJECT_WEAVE_ENDPOINT matches the endpoint
shown there. (connect ENOENT \.\pipe\project-weave-nonexistent)
```

exit code 1, and stdout contains no MCP response at all.

Judged a defect fix rather than a product decision: the acceptance criterion
"missing, stale, incompatible, revoked, and removed companions fail with
actionable guidance" and the same-release-tag handshake (ADR 0018) already
required this; the gap was purely in when the existing check ran. No ADR was
added.

## Verification

Covered by `scripts/mcp-companion.node-test.mjs` ("unreachable gateway:
fails closed at connect time with actionable guidance, before serving any
request"), which asserts the process exits non-zero, stdout stays empty
(initialize/tools-list are never answered), and stderr names the likely
cause and remedy while preserving the underlying transport error.
