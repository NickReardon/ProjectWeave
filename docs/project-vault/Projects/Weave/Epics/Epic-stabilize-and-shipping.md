---
type: epic
title: Stabilize Schemas, Ship Skill, and Accept v1
project: '[[Projects/Weave/Project]]'
status: planned
owner: ''
origin: '[[Projects/Weave/Project]]'
created: 2026-08-07
rank: 9000
milestone: '[[Milestones/v1 release]]'
---

# Stabilize Schemas, Ship Skill, and Accept v1

## Summary

Freeze and version all compatibility surfaces: application DTO schemas, cursors, entity references, proposal states, MCP tool schemas, frontmatter fields, controlled values, diagnostics, action/reason codes, template catalog keys, persisted workspace/settings state. Ship the Project Weave skill teaching project selection, capabilities, backlog vs board, rank vs dependency, optional planning periods, bounded reads, query-propose-review-commit behavior. Add 10,000-task fixture; record benchmarks for indexing, queries, rendering. Complete desktop/narrow-layout/keyboard/touch/theme/pop-out/workspace/live-event/conflict/mobile checks.

### Governing documents

- [Plugin experience](../../../../spec/plugin-experience.md)
- [Quality and release](../../../../spec/quality-and-release.md)
- [Agent access and MCP](../../../../spec/agent-access-and-mcp.md#project-weave-skill)
- [Manual Checks](../../../../development/testing.md)
- [Plugin Release and Testing](../../../../development/release.md)

### Exit gate

npm run check passes from clean install; export inventory exact; required manual checks recorded; mobile confirmed; product-brief success criteria work without optional configuration.

## Progress

> Derived from member tasks.

<!-- progress-placeholder -->
