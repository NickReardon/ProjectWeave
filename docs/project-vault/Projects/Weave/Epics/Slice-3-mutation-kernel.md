---
type: epic
title: Build Typed Mutation and Proposal Kernel
project: '[[Projects/Weave/Project]]'
status: active
owner: ''
origin: '[[Projects/Weave/Project]]'
created: 2026-08-07
milestone: '[[Milestones/v1 release]]'
---

# Build Typed Mutation and Proposal Kernel

## Summary

The shared foundation for every existing-note and multi-file operation. Source-preserving Markdown patcher, typed domain operations with before/after content, proposal lifecycle states, coordinator-only write port, multi-file preflight with deterministic ordering, and one-use approval receipts.

### Governing documents

- [Design 10 — Validation and Safe Writes](../../../../spec/10-validation-and-safe-writes.md)
- [Design 03 — Task Management](../../../../spec/03-task-management.md)
- [ADR 0009 — Create-Only Write Boundary](../../../../decisions/0009-create-only-write-boundary.md)
- [Design 17 — Proposal Lifecycle](../../../../spec/17-agent-access-and-mcp.md#proposal-lifecycle)

### Exit gate

Single/multi-file proposals abort before writing on stale inputs; partial reports are exact; unknown Markdown survives edits; replayed/mismatched receipts cannot commit.

## Progress

> Derived from member tasks.

<!-- progress-placeholder -->
