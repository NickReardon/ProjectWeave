---
type: task
title: Extract agent grant minting and containment into a pure module
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-creation-pipeline]]'
status: backlog
category: enhancement
priority: high
rank: 5750
milestone: '[[Milestones/v1 release]]'
created: 2026-08-19
---

# Extract agent grant minting and containment into a pure module

## Summary

`ProjectWeavePlugin.createAgentGrant` mints the grant id and secret, digests
the secret, and enforces that every content root stays inside
`projectContentRoot(projectPath)`. That containment check is what keeps a
read-only agent grant scoped to one project, and it lives on a class that can
only be constructed by loading an Obsidian plugin. There is no test for it.

## Why this is first

Of everything in this Epic, this is the only part where the untested code is a
security boundary rather than an inconvenience. It is also the smallest piece,
and it does not depend on the rest.

## Solution

A pure `src/application/agent-grants.ts` owning grant minting and the
containment rule, taking an injected identifier source and digest function
rather than reaching for a global. `main.ts` supplies the real ones.

## Acceptance criteria

- Containment is decided by a module that imports nothing from `obsidian`.
- Adversarial cases are covered by table tests: `../` traversal, absolute paths,
  a sibling whose name shares a prefix with the project folder, case
  differences, and a root equal to the project root.
- A rejected content root produces the same refusal it does today.
- The secret is still digested before persistence, and no plaintext secret is
  written to `data.json`.

## Notes

Related to [[Tasks/Restructure agent grant creation into validate-then-create]],
which changes when validation happens in the UI. This task changes where the
rule lives, not what it decides; the two do not conflict.
