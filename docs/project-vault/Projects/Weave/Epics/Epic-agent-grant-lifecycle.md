---
type: epic
title: Give agent grants a dialog, a readable list, and an immutable lifecycle
project: '[[Projects/Weave/Project]]'
status: planned
owner: ''
origin: '[[Tasks/Make the agent grant form explain what it asks for]]'
created: 2026-08-17
rank: 2500
milestone: '[[Milestones/v1 release]]'
depends_on: '[[Epics/Epic-shared-reads-agent]]'
---

# Give agent grants a dialog, a readable list, and an immutable lifecycle

## Summary

Replace the three-input **Create agent grant** settings row with a dialog and
a list of existing grants. Grants become immutable once created — correcting
one means revoking and creating a replacement — which makes local resolution
of the chosen project and content roots load-bearing before creation, and
makes the grant list responsible for showing what each grant permits without
opening an editor. Creation stays atomic and hands over a complete client
configuration instead of a bare secret.

### Governing documents

- [Agent access and MCP](../../../../spec/agent-access-and-mcp.md)
- [ADR 0028](../../../../decisions/0028-immutable-dialog-based-agent-grants.md)
- [[Tasks/Make the agent grant form explain what it asks for]]
- [[Tasks/Restructure agent grant creation into validate-then-create]]

### Exit gate

Grant creation happens in a dialog; the settings entry is a list of existing
grants with create and revoke actions; the create action is unavailable
until the chosen project and content roots resolve locally against the vault
with the gateway disabled; a grant either exists with its secret delivered or
does not exist; each listed grant states its project and metadata-only versus
content-root scope without being opened; and what is copied at creation is a
complete client configuration.

## Progress

> Derived from member tasks.

<!-- progress-placeholder -->
