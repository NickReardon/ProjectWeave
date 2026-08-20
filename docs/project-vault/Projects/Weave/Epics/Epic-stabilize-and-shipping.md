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

- [[Documents/Specifications/plugin-experience|Plugin experience]]
- [[Documents/Specifications/quality-and-release|Quality and release]]
- [[Documents/Specifications/agent-access-and-mcp#Project Weave skill|Agent access and MCP]]
- [[Documents/References/testing|Manual Checks]]
- [[Documents/References/release|Plugin Release and Testing]]

### Exit gate

npm run check passes from clean install; export inventory exact; required manual checks recorded; mobile confirmed; product-brief success criteria work without optional configuration.

## Progress

> Derived from member tasks.

<!-- progress-placeholder -->
