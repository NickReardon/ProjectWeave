---
type: task
project: '[[Projects/Weave/Project]]'
status: backlog
category: manual-check
rank: 2300
---

# Check 14 - Mobile compatibility

Procedure: [[Documents/References/testing]], check 14.

Deferred until a mobile device or emulator is available. Not required for
desktop acceptance — nothing in the workbench is known to be desktop-only —
but unrun, not waived. Run before any release that claims mobile support.

## Partial evidence

On 2026-08-17, Obsidian 1.13.7 desktop mobile emulation loaded the locally built
`0.7.0-beta.32018589204` plugin and opened the Project Workbench without a
captured runtime error. Selecting Fixture Game rendered its current index,
summary metrics, Ready Now items, All Tasks filters and results, and project
diagnostics. A saved enabled desktop-gateway setting produced no endpoint while
the renderer carried Obsidian's mobile state. Full check 11a through 11g was not
run, so this task remains outstanding.
