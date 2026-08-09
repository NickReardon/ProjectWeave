---
type: task
title: Move validation and historical material
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-12-dogfood-vault-migration]]'
status: backlog
priority: normal
created: 2026-08-09
---

# Move validation and historical material

## Summary

Place testing, release, and supporting references in Documents/References and
move obsolete material to Archive/Legacy without making history canonical.

## Acceptance criteria

- `docs/CURRENT_WORK.md` remains the append-only automated evidence log.
- Historical notes are ordinary Markdown and excluded from typed-document views.
- Repository entrypoints route to the new canonical locations.

## Validation

Run the release inventory and verify all routing links from README and AGENTS.
