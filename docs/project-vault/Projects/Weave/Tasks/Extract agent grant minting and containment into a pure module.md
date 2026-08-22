---
type: task
title: Extract agent grant minting and containment into a pure module
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-creation-pipeline]]'
status: done
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

## Outcome

`src/application/agent-grants.ts` now owns grant minting and containment as
`mintAgentGrant`, `projectContentRoot`, and `isWithinContentRoot`. It imports
nothing beyond its own code — no `obsidian`, no `node:*` — and takes an
injected `nextIdentifier` and `digestSecret` instead of reaching for a global;
`main.ts#createAgentGrant` supplies the real `crypto`-backed pair and keeps
only project-path resolution and settings persistence.

The `AgentGrant` type moved with it, since minting is what defines the shape.
`read-only-agent-gateway.ts` re-exports the type so its existing importers are
unchanged, and its own duplicate `projectContentRoot`/`isWithin` were deleted
in favor of the shared functions, so mint-time and request-time containment
can no longer drift apart. The refusal message — "Grant content folders must
stay inside the selected project." — is unchanged.

`tests/application/agent-grants.test.ts` covers the adversarial cases from
the acceptance criteria: upward traversal, an absolute path, a Windows-drive
path, a sibling folder sharing the project name as a text prefix, a
case-differing spelling, and a content root equal to the project root itself,
plus label fallback and a check that only the digest is ever stored.

Consolidating the two copies also closed a hole neither had been tested for.
Prefix matching cannot see through traversal: `Projects/Game/../Other` starts
with `Projects/Game/` and was therefore accepted as contained by both former
implementations. `isWithinContentRoot` now refuses any `.` or `..` segment in
either argument rather than resolving it, so it fails closed. Nothing
reachable changes today, because `normalizeVaultFolderPath` already rejects
those segments before a root reaches minting; the guard is what keeps the
rule true for a caller that skips normalization, which is the whole point of
lifting it out of the plugin class. The escaping cases are covered directly
and through `mintAgentGrant`.

The two former copies were not identical: the gateway normalized backslashes
and `main.ts` did not. The shared function keeps the normalizing form, which
is the more permissive of the two, so mint-time now agrees with the
enforcement point instead of being inconsistently stricter. No reachable
behavior changes, because `normalizeVaultFilePath` has already replaced
backslashes before minting sees the path.

Otherwise a pure refactor with no behavior change, so no specification was
edited.
