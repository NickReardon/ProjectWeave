---
type: task
title: Name the agent gateway toggle as the companion messages describe it
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-shared-reads-agent]]'
status: backlog
category: loose-end
priority: normal
rank: 5650
milestone: '[[Milestones/v1 release]]'
created: 2026-08-23
---

# Name the agent gateway toggle as the companion messages describe it

## Summary

The companion's remedy strings send the user to "Project Weave settings >
Agent Access" and then speak of it as the thing being switched: "Agent Access
enabled", "Agent Access may have been disabled". Those phrasings appear at
`src/agent/mcp-companion.ts` lines 298, 318, 324, 326 and 328.

`Agent access` is a real section heading in the settings tab, so the user does
arrive in the right place. The control inside it is named **Read-only agent
gateway**. The guidance therefore names the section correctly but never names
the toggle, and phrases the section as if it were the switch.

## Why this is small but worth closing

These strings are read at the exact moment something is broken and the user is
looking for one specific control. Naming the section and then describing it as
enable-able leaves the reader scanning a settings pane for a switch called
"Agent Access", which does not exist.

`README.md` already uses the real label, so the plugin and its documentation
disagree only in the companion's own error text.

## Acceptance criteria

- The companion's remedy strings name the **Read-only agent gateway** toggle
  as the control to enable, and the `Agent access` section as where to find it.
- Section and control are distinguishable in the text rather than conflated.
- The README troubleshooting table quotes whatever the messages then say, so
  the table and the emitted strings stay in agreement.

## Notes

Surfaced while writing [[Tasks/Add a companion troubleshooting section to the
README]], whose table quotes these messages verbatim. Changing the strings
means updating that table in the same commit.
