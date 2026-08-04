# ADR 0008: Derive task target paths from the project folder and allocate spaced ranks

- Status: accepted
- Date: 2026-08-03
- Owners: Project Weave

## Context

The template renderer and the task creation proposal service both accept a
target path and a rank, but nothing decides either value. `docs/design/README.md`
lists "exact folder defaults and filename collision policy" as an unresolved
design input, so no caller could assemble a creation request without inventing a
folder convention privately. Rank is better specified — Design 15 fixes the
gap-of-1000 rule — but leaves two questions open that an implementation cannot
avoid answering.

Two normative statements about collisions also read differently depending on the
caller. `docs/design/03-task-management.md` says a collision "blocks creation and
offers a different filename; v1 does not overwrite", while
`docs/design/17-agent-access-and-mcp.md` says "the server chooses safe filenames
and spaced ranks when omitted; generated values remain visible/editable in
preview". One shared allocator needs a single rule that satisfies both.

## Decision

**Task root.** New task notes default to a `Tasks` folder beside the project
note: `Projects/Game/Project.md` yields `Projects/Game/Tasks`. A project note at
the vault root yields `Tasks`. Callers may supply a subfolder relative to that
root for organization, validated to stay inside it; absolute paths, drive
letters, `.`/`..`/empty segments, and control characters are rejected rather than
repaired, because each means the caller intended somewhere else.

**Filename.** The stem derives from the task title: control characters and the
characters that break vault paths or wiki links (`\ / : * ? " < > | # ^ [ ]`)
become separators, whitespace runs collapse, surrounding dots and spaces are
trimmed, the stem is capped, and Windows device names are refused. A title
leaving nothing usable produces a diagnostic instead of an invented name.

**Collisions.** The allocator suggests the first free path using a deterministic
` 2`, ` 3`, … suffix, bounded at 100 attempts. The proposal service keeps
`proposal.target.exists` as the authoritative block. This satisfies both
contracts because suggesting is not committing: the generated name reaches the
user as an editable preview value, and the write path still refuses to overwrite.
Occupancy compares case-insensitively, since macOS and Windows treat
`Fix crash.md` and `fix crash.md` as one file.

**Rank.** A new task takes the project's largest existing rank plus 1000, per
Design 15. Two gaps in that contract are resolved here:

- The maximum spans **every** task in the project, not only backlog ones. Design
  15 keeps a rank while a task is assigned elsewhere, so a status-scoped maximum
  would reissue a rank the project is still using.
- A project with no ranked task starts at **1000**, matching the
  `1000, 2000, 3000, ...` sequence an explicit rebalance produces.

Allocation stays pure and composes above the proposal service; the service's
input contract is unchanged.

## Alternatives considered

- **A vault-wide `defaultTaskFolder` setting** (`docs/design/12-plugin-experience.md`): deferred. It adds a compatibility surface before any caller needs it, and configuration in plugin data does not travel with the project the way `weave.templates.task` does.
- **A per-project frontmatter folder override** mirroring `weave.templates.task`: deferred for the same reason — worth adding when a project actually needs a different layout, not before.
- **Hard-failing on the first collision** rather than suggesting a suffix: rejected because Design 17 expects a generated name, and a preview that opens on a known-bad path wastes the user's turn.
- **Auto-suffixing at commit time** instead of at allocation: rejected because the suffix would not be visible in the preview, so the user would confirm one path and receive another.
- **Repairing unsafe subfolders** by clamping traversal to the task root: rejected because it files the task somewhere nobody chose; the lifecycle contract prefers an explicit diagnostic.
- **Fractional or lexicographic ranks** (LexoRank and similar): rejected because Design 15 fixes a positive-integer rank with integer midpoints and an explicit rebalance.
- **Scoping the rank maximum to backlog tasks:** rejected as above; it produces duplicate ranks, which the indexer already reports as `task.rank.duplicate`.

## Consequences

- Positive: a task creation caller can now be built without inventing conventions, and the UI and a future agent adapter will derive identical paths and ranks.
- Positive: the path-safety predicate is shared with the renderer, so one gate governs every write target.
- Positive: the folder convention needs no configuration and survives a project being moved.
- Negative: the `Tasks` convention is fixed until an override lands, so a project preferring a flat layout must wait.
- Negative: collision suffixes are position-based, so deleting `Implement request 2.md` lets the next allocation reuse that name.
- Follow-up: midpoint insertion and Rebalance Backlog Ranks remain unimplemented; both belong to a reorder slice, and rebalance is a previewed bulk write.
- Follow-up: the allocator has no runtime caller until the preview/confirmation surface lands, so it is tree-shaken out of the shipped bundle.
