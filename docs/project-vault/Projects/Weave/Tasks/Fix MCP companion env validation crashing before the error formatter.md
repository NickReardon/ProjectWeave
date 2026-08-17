---
type: task
title: Fix MCP companion env validation crashing before the error formatter
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-shared-reads-agent]]'
status: done
category: bug
priority:
points:
rank: 4800
milestone: '[[Milestones/v1 release]]'
---

# Fix MCP companion env validation crashing before the error formatter

## Summary

Running `project-weave-mcp.cjs` with no environment configured printed a raw
Node stack trace instead of the intended one-line actionable message,
because required-env-var reads happened at module scope and threw before the
`.catch(...)` at the bottom of the entry point could format the error.

## Reproduction

```
node export/companion/project-weave-mcp.cjs
```

with no `PROJECT_WEAVE_ENDPOINT`, `PROJECT_WEAVE_GRANT_ID`, or
`PROJECT_WEAVE_GRANT_SECRET` set produced an unhandled-exception stack trace
ending in `Error: PROJECT_WEAVE_ENDPOINT is required.` and only named the
first missing variable.

## Fix

`src/agent/mcp-companion.ts`: moved required-environment resolution into the
async `main()` entry point via `collectRequiredEnvironment`, which reports
every missing or blank variable together instead of throwing on the first.
The throw now happens inside the promise `main().catch(...)` already
handles, so it is routed through the existing one-line `console.error`
formatter with a non-zero exit and no stack trace.

After the fix:

```
$ node dist/companion/project-weave-mcp.cjs
PROJECT_WEAVE_ENDPOINT, PROJECT_WEAVE_GRANT_ID, and PROJECT_WEAVE_GRANT_SECRET are required.
$ echo $?
1
```

## Verification

Covered by `scripts/mcp-companion.node-test.mjs` ("missing required env
vars: one actionable line naming all of them, no stack trace, non-zero
exit"), which spawns the built companion with the three variables stripped
and asserts stdout is empty, stderr is exactly one line naming all three
variables, and the process exits non-zero.
