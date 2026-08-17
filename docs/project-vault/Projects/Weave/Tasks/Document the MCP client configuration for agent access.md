---
type: task
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-shared-reads-agent]]'
status: done
category: chore
rank: 5200
milestone: '[[Milestones/v1 release]]'
---

# Document the MCP client configuration for agent access

`README.md` named the companion, the environment variables, and the same-tag
rule but never showed them assembled into a working MCP client configuration,
and never stated that the companion is a stdio server a client launches, not
something a user runs directly. A real setup attempt ran
`node export/companion/project-weave-mcp.cjs` from a shell, hit the
missing-environment-variable error, and read it as a bug.

Added to `README.md`: the client/gateway/companion mental model stated before
any command, a worked `mcpServers` JSON example with `command`, `args`, and
`env` carrying `PROJECT_WEAVE_ENDPOINT`, `PROJECT_WEAVE_GRANT_ID`, and
`PROJECT_WEAVE_GRANT_SECRET`, an explicit note that Windows paths need doubled
backslashes in JSON, and an explanation of the endpoint/grant id/secret values
including that the secret cannot be recovered once lost. Verified the
environment variable names and the required-value check against
`src/agent/mcp-companion.ts`, and the settings values shown (endpoint, grant
id, label, project, content roots, one-time secret) against
`src/ui/settings-tab.ts`. The same-release-tag requirement was already stated
correctly in `README.md` and was left as is.

A troubleshooting section keyed to companion error messages is deliberately
deferred; see the backlog task for it.
