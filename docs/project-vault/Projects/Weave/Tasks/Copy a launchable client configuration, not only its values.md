---
type: task
title: Copy a launchable client configuration, not only its values
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-agent-grant-lifecycle]]'
status: done
category: enhancement
priority: normal
rank: 6900
milestone: '[[Milestones/v1 release]]'
created: 2026-08-18
---

# Copy a launchable client configuration, not only its values

## Summary

[[Tasks/Copy a complete client configuration on grant creation]] replaced the
bare secret with the three values a client needs: endpoint, grant id, and
secret. That removed the transcription step for the values themselves, which was
the worst of the problem.

It stops short of what the task was named for. A client also needs the command
and its arguments, and those are still assembled by hand around what is copied.
The reasoning was sound as far as it went: the plugin cannot know where the user
placed `project-weave-mcp.cjs`, so it cannot emit a real path.

## Decision

Copy a complete, ready-to-paste configuration block, the way a WireGuard peer
configuration is copied: the whole thing arrives intact, and the only thing the
reader edits is the part only they can know. The comparison is to that
experience, not to that file format.

An unknown path is a reason to emit a placeholder, not a reason to emit nothing.
A block carrying `<path to project-weave-mcp.cjs>` is edited in one obvious
place. Three loose values require the reader to know the shape of an
`mcpServers` entry, find the documented example, and assemble the two — more
work, more places to go wrong, and the reason the README has to carry a worked
configuration at all.

Rejected: asking for the companion path in the dialog. It removes the
placeholder but adds a field to a form this redesign just finished simplifying,
and the path is a property of the installation rather than of the grant.

## Acceptance criteria

- What is copied is a complete configuration block that a client accepts once
  the placeholder is replaced, not a set of values to assemble.
- What must be edited is unmistakable in the copied text itself, not only in
  the README.
- The copied form and the README's documented shape agree; neither is the sole
  owner of an example the other contradicts.
- The secret is never logged or persisted.
