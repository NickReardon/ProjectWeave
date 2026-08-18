---
type: task
title: Copy a complete client configuration on grant creation
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-agent-grant-lifecycle]]'
status: done
category: enhancement
priority: normal
rank: 6800
milestone: '[[Milestones/v1 release]]'
created: 2026-08-17
---

# Copy a complete client configuration on grant creation

## Summary

`#createAgentGrant` currently copies only the secret to the clipboard, even
though a client also needs the endpoint and the grant id, both of which are
displayed on the row but must be transcribed by hand. Successful creation in
the new dialog (see [[Tasks/Move agent grant creation into a dialog]]) should
instead copy a complete client configuration — endpoint, grant id, and secret
together — removing the transcription step and the ambiguity about what the
copied value even is. This is the connection-values gap described in
[[Tasks/Make the agent grant form explain what it asks for]].

The existing atomicity guarantee must not regress: creation is rolled back
today if the clipboard write fails (see
`#createAgentGrant`/`removeAgentGrant` in `src/ui/settings-tab.ts`), so that a
grant is never left existing without its secret having been delivered.
Copying a larger payload does not change this contract — the write either
succeeds and the grant stands, or it fails and the grant is rolled back.

## What "complete" means here

At minimum the endpoint, grant id, and secret — the three values
[[Tasks/Document the MCP client configuration for agent access]] already
documents as what a working `mcpServers` entry needs. Whether the copied
value is a ready-to-paste JSON fragment matching that documented example, or
a plainer combined format, is an implementation choice for this task to make;
either way it must be unambiguous about which value is which without the user
needing to cross-reference the README.

## Acceptance criteria

- Successful grant creation copies endpoint, grant id, and secret together in
  one clipboard write.
- A clipboard write failure still rolls back the created grant, exactly as it
  does today for the secret-only copy.
- The copied value's format is documented somewhere a user configuring a
  client will see it (README or the dialog itself), so "what did I just copy"
  is never a question.
- No behavior here depends on the free-text label decision in
  [[Tasks/Move agent grant creation into a dialog]]; the configuration is
  copied whether or not a label field exists.

## Validation

Automated test asserting the exact clipboard payload shape on successful
creation and asserting rollback occurs when the clipboard write rejects.
Manual check: create a grant, paste the clipboard contents into an
`mcpServers` entry, and confirm it matches the README's documented example
without hand-editing.
