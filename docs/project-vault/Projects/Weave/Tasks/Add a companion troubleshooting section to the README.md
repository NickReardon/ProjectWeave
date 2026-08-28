---
type: task
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-shared-reads-agent]]'
status: done
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

## Outcome

The blocking work has landed: both
[[Tasks/Fix MCP companion env validation crashing before the error formatter]]
and [[Tasks/Map MCP companion transport failures to actionable guidance]] are
`status: done`, so the table is keyed to the corrected text rather than the
text it replaced.

Merged with
[[Tasks/Document the companion launch ordering requirement]] into one
`### Starting order and troubleshooting` subsection at the end of
`## Read-only agent access` in `README.md`, so the two do not give separate
accounts of the same behavior. The launch-ordering prose comes first and the
closed-gateway row points back to it instead of restating it.

Every row was read out of the source rather than paraphrased:

- Missing environment variables — `collectRequiredEnvironment` in
  `src/agent/mcp-companion.ts` builds one message naming every missing or
  blank variable, ending `is required.` or `are required.`
- Same-release-tag mismatch — the `gateway.companion_incompatible` denial in
  `src/application/read-only-agent-gateway.ts`, whose message already names
  its own remedy and is passed through unchanged.
- Authentication and revocation — the `gateway.authentication_failed` denial
  (`The grant credentials are invalid.`) from the same file, and the
  `gateway.disabled` denial (`The agent gateway is disabled.`), each augmented
  by `GATEWAY_ERROR_REMEDY` in the companion.
- Closed gateway — `DEFAULT_TRANSPORT_GUIDANCE` and
  `TRANSPORT_GUIDANCE_BY_CODE` in the companion. A row covers the
  never-connected case (`Could not reach the Project Weave gateway at …`,
  used for `ENOENT`, `ECONNREFUSED`, and the fallback) and a row covers the
  mid-session drop (`… was reset.` for `ECONNRESET`, `… closed unexpectedly.`
  for `EPIPE`).

Where a message is built at runtime, the table documents the stable,
matchable part and says so: the endpoint and versions are shown as
placeholders, and the prose notes that transport failures also carry the
underlying Node error text.

## Loose end

The companion's remedies name the setting as "Agent Access"
(`src/agent/mcp-companion.ts`), while the actual toggle is labelled
"Read-only agent gateway" (`src/ui/settings-tab.ts`). The README uses the real
label. Reconciling the companion strings is out of scope here and not yet
tracked.
