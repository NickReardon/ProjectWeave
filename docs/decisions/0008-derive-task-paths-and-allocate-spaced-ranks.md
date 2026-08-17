---
type: decision
id: "0008"
area: tasks
status: accepted
canonical: false
affects: ["task-management", "scheduling-and-milestones"]
---

# ADR 0008: Derive task target paths from the project folder and allocate spaced ranks

- Status: accepted
- Date: 2026-08-03
- Owners: Project Weave

## Context

The template renderer and the task creation proposal service both accept a
target path and a rank, but nothing decides either value. `docs/spec/README.md`
lists "exact folder defaults and filename collision policy" as an unresolved
design input, so no caller could assemble a creation request without inventing a
folder convention privately. Rank is better specified — the Scheduling and milestones spec fixes the
gap-of-1000 rule — but leaves two questions open that an implementation cannot
avoid answering.

Two normative statements about collisions also read differently depending on the
caller. `docs/spec/task-management.md` says a collision "blocks creation and
offers a different filename; v1 does not overwrite", while
`docs/spec/agent-access-and-mcp.md` says "the server chooses safe filenames
and spaced ranks when omitted; generated values remain visible/editable in
preview". One shared allocator needs a single rule that satisfies both.

## Decision

Derive task target paths from the project folder and allocate ranks from a
project-wide maximum, rather than leaving either for each caller to invent.

- **Task root:** a `Tasks` folder beside the project note, with optional
  caller-supplied subfolders validated to stay inside it, and unsafe paths
  rejected rather than repaired.
- **Filename:** derived from the title, with path-breaking characters replaced,
  and an unusable title producing a diagnostic rather than an invented name.
- **Collisions:** the allocator *suggests* a numeric suffix while the proposal
  service keeps `proposal.target.exists` as the authoritative block. Suggesting
  is not committing, which is what lets the Task management spec's "collision blocks creation"
  rule and the Agent access and MCP spec's generated-filename expectation both hold.
- **Rank:** the largest existing rank plus 1000, where the maximum spans every
  task in the project rather than only the backlog ones, and a project with no
  ranked task starts at 1000.

Allocation stays pure and composes above the proposal service; the service's
input contract is unchanged.

The resulting rules are specified in
[Task management](../spec/task-management.md) and
[Scheduling and milestones](../spec/scheduling-and-milestones.md).

## Alternatives considered

- **A vault-wide `defaultTaskFolder` setting** (`docs/spec/plugin-experience.md`): deferred. It adds a compatibility surface before any caller needs it, and configuration in plugin data does not travel with the project the way `weave.templates.task` does.
- **A per-project frontmatter folder override** mirroring `weave.templates.task`: deferred for the same reason — worth adding when a project actually needs a different layout, not before.
- **Hard-failing on the first collision** rather than suggesting a suffix: rejected because the Agent access and MCP spec expects a generated name, and a preview that opens on a known-bad path wastes the user's turn.
- **Auto-suffixing at commit time** instead of at allocation: rejected because the suffix would not be visible in the preview, so the user would confirm one path and receive another.
- **Repairing unsafe subfolders** by clamping traversal to the task root: rejected because it files the task somewhere nobody chose; the lifecycle contract prefers an explicit diagnostic.
- **Fractional or lexicographic ranks** (LexoRank and similar): rejected because the Scheduling and milestones spec fixes a positive-integer rank with integer midpoints and an explicit rebalance.
- **Scoping the rank maximum to backlog tasks:** rejected as above; it produces duplicate ranks, which the indexer already reports as `task.rank.duplicate`.

## Consequences

- Positive: a task creation caller can now be built without inventing conventions, and the UI and a future agent adapter will derive identical paths and ranks.
- Positive: the path-safety predicate is shared with the renderer, so one gate governs every write target.
- Positive: the folder convention needs no configuration and survives a project being moved.
- Negative: the `Tasks` convention is fixed until an override lands, so a project preferring a flat layout must wait.
- Negative: collision suffixes are position-based, so deleting `Implement request 2.md` lets the next allocation reuse that name.
- Follow-up: midpoint insertion and Rebalance Backlog Ranks remain unimplemented; both belong to a reorder slice, and rebalance is a previewed bulk write.
- Follow-up: the allocator has no runtime caller until the preview/confirmation surface lands, so it is tree-shaken out of the shipped bundle.
