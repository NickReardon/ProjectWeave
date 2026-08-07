---
type: decision
id: "0004"
area: agent-access
status: accepted
canonical: false
affects: ["17"]
---

# ADR 0004: Design agent access now and stage MCP from read to controlled writes

- Status: accepted
- Date: 2026-08-02
- Owners: Project Weave

## Context

Project Weave's canonical Markdown, immutable index, stable diagnostics, domain operations, and proposal/fingerprint write model already form a strong agent boundary. The intended developer workflow benefits directly from asking an agent to read a design, find related work, and propose executable tasks.

Waiting until all UI features are complete would risk view-specific domain logic and a second implementation for agents. Exposing generic file tools would bypass Project Weave's lifecycle, validation, and preservation contracts.

## Decision

Define a tool-neutral query/action/proposal API as part of the core architecture. Implement an optional local desktop MCP adapter in stages:

1. read-only project/task/document queries;
2. task creation proposals from documents/headings;
3. typed task edits;
4. controlled ordinary-Markdown create/edit proposals;
5. a small Project Weave skill.

The adapter is thin. UI, MCP, and tests share application services. Every agent write is proposal-based and uses trusted approval initially. Direct file/frontmatter/delete tools are forbidden.

## Alternatives considered

- **Implement MCP only after all v1 UI:** rejected because the shared API should shape the first vertical slice and agent-assisted design-to-task work is a primary use case.
- **Let a companion edit vault Markdown directly:** rejected because it duplicates parsing/rules, bypasses Obsidian APIs, and cannot safely use the live index.
- **Expose generic read/write filesystem tools:** rejected because path scope, entity invariants, frontmatter protection, and proposal approval would be bypassed.
- **Build an embedded agent runtime:** deferred because model/provider, privacy, permission, mobile, and support concerns are unnecessary for the initial value.

## Consequences

- Positive: Plan, Board, commands, tests, and agents share one behavior contract.
- Positive: read-only agent value arrives early with limited mutation risk.
- Positive: creating tasks from evolving game-design documents becomes a first-class workflow.
- Negative: a desktop bridge and trusted approval UI are required before agent writes can ship.
- Negative: ordinary document editing needs a separate safe patch contract in addition to typed entity operations.
- Follow-up: select and record the desktop bridge/transport architecture and pinned MCP protocol/SDK before implementing the adapter.
