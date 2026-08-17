---
type: task
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-shared-reads-agent]]'
status: backlog
category: chore
rank: 5300
milestone: '[[Milestones/v1 release]]'
---

# Add a companion troubleshooting section to the README

`README.md` documents the MCP client configuration for agent access
(companion mental model, worked `mcpServers` example, endpoint/grant
id/secret) but deliberately does not include a troubleshooting table keyed to
specific companion error messages.

This depends on the companion diagnosability fixes landing first: three
companion diagnosability defects are being corrected in a parallel branch and
the error text they produce is changing. Writing a troubleshooting table
against the current messages would document text that is about to be
replaced. Once that work lands, add a short table mapping the corrected
error messages (missing environment variables, same-release-tag mismatch,
authentication/revocation failures, closed gateway) to the recovery step a
user should take.
