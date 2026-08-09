---
type: epic
title: Stabilize Shared Reads and Deliver Agent Slice A
project: '[[Projects/Weave/Project]]'
status: active
owner: ''
origin: '[[Projects/Weave/Project]]'
created: 2026-08-07
milestone: '[[Milestones/v1 release]]'
---

# Stabilize Shared Reads and Deliver Agent Slice A

## Summary

Expand the existing application query boundary before creating new views or agent tools. Bounded project context, entity reads, ordinary-Markdown search, note/section reads with fingerprints, related-work, dependency-sequence, diagnostics, Action Context, Creation Context queries, plus read-only agent gateway.

### Governing documents

- [Design 02 — Data Model and Index](../../../../spec/02-data-model-and-index.md)
- [Design 17 — Agent Access and MCP](../../../../spec/17-agent-access-and-mcp.md)

### Exit gate

UI and adapter queries return equivalent context; one grant cannot read another project; disabling the gateway leaves no listener or write capability.

## Progress

> Derived from member tasks.

<!-- progress-placeholder -->
