---
type: epic
title: Add Optional Planning Periods and Agent Slice C
project: '[[Projects/Weave/Project]]'
status: planned
owner: ''
origin: '[[Projects/Weave/Project]]'
created: 2026-08-07
milestone: '[[Milestones/v1 release]]'
---

# Add Optional Planning Periods and Agent Slice C

## Summary

Project-scoped planning periods (sprints/cycles/periods) as canonical `type: sprint` notes. Create/edit planned periods with goal and dates; assign/reassign eligible tasks; activate with overlap validation; close or cancel with per-task outcome and history; point totals without partial-completion claims. Agent Slice C exposes the same task operations through the proposal service after fields stabilize.

### Governing documents

- [Design 05 — Dependencies and Iterations](../../../../spec/05-dependencies-and-iterations.md)
- [Design 06 — Sprints](../../../../spec/06-sprints.md)
- [Design 16 — Optional Planning Periods](../../../../spec/16-streamlined-long-project-workflow.md#optional-planning-periods-and-estimates)
- [Design 17 — Agent Slice C](../../../../spec/17-agent-access-and-mcp.md#agent-slice-c--typed-task-editing)

### Exit gate

No period required to use board; activation/close conflicts cannot overwrite edits; UI and agent operations return equivalent changes, diagnostics, and postconditions.

## Progress

> Derived from member tasks.

<!-- progress-placeholder -->
