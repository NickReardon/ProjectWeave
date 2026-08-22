---
type: epic
title: Build Typed Mutation and Proposal Kernel
project: '[[Projects/Weave/Project]]'
status: active
owner: ''
origin: '[[Projects/Weave/Project]]'
created: 2026-08-07
rank: 3000
milestone: '[[Milestones/v1 release]]'
---

# Build Typed Mutation and Proposal Kernel

## Summary

The shared foundation for every existing-note and multi-file operation. Source-preserving Markdown patcher, typed domain operations with before/after content, proposal lifecycle states, coordinator-only write port, multi-file preflight with deterministic ordering, and one-use approval receipts.

### Governing documents

- [[Documents/Specifications/validation-and-safe-writes|Validation and safe writes]]
- [[Documents/Specifications/task-management|Task management]]
- [[Documents/Decisions/0009-create-only-write-boundary|ADR 0009 — Create-Only Write Boundary]]
- [[Documents/Specifications/agent-access-and-mcp#Proposal lifecycle|Agent access and MCP]]

### Exit gate

Single/multi-file proposals abort before writing on stale inputs; partial reports are exact; unknown Markdown survives edits; replayed/mismatched receipts cannot commit.

## Progress

> Derived from member tasks.

<!-- progress-placeholder -->
