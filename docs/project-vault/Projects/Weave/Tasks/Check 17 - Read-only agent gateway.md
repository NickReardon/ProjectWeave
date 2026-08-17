---
type: task
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-shared-reads-agent]]'
status: done
category: manual-check
rank: 950
milestone: '[[Milestones/v1 release]]'
---

# Check 17 - Read-only agent gateway

Run manual check 17 in `docs/development/testing.md` on desktop. Confirm the
disabled endpoint, one-project grant and content-root boundaries, current
read results, revocation, and shutdown behavior. Record the observed MCP client
and Obsidian versions here before marking this done.

## Result

Passed on 2026-08-17 in Windows 11 with Obsidian 1.13.7 (installer 1.12.7),
BRAT 2.2.0, Node 24.11.1, and a purpose-built MCP SDK 1.30.0 stdio client.
The locally built plugin and companion used release version
`0.7.0-beta.32018589204`.

With the gateway disabled, no endpoint was present and the companion could not
complete a request. With a grant for `Projects/Game/Project.md` and document
root `Projects/Game/Design`, the client advertised exactly ten read-only tools,
returned current project context, searched only the granted project, and read
`Projects/Game/Design/Travel.md` with `untrusted: true`. A generic Markdown note
outside the document root and an attempted cross-project read both returned
`query.read.out_of_scope`. Revocation returned
`gateway.authentication_failed`; disabling the gateway removed the endpoint
and closed a live connection. No Obsidian runtime errors were captured.
