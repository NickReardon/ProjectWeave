---
type: task
title: Collapse the two creation ladders into one pipeline
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-creation-pipeline]]'
status: backlog
category: enhancement
priority: high
rank: 6750
milestone: '[[Milestones/v1 release]]'
created: 2026-08-19
---

# Collapse the two creation ladders into one pipeline

## Summary

Allocate, propose, preview is built twice — once for tasks and once for
projects — and the two ladders agree only because someone diffed them.
[[Documents/Decisions/0030-one-creation-pipeline-with-a-spec-per-note-kind|ADR 0030]]
settles that note creation is one pipeline with a declarative spec per kind.
This task is that change.

Commit is already shared: `NoteCreationCommitService` takes a
`NoteCreationProposal` and does not care what kind produced it. The duplication
is entirely upstream of it, in six files:

| Step | Task | Project |
| --- | --- | --- |
| Allocate | `task-creation-allocator.ts` | `project-creation-allocator.ts` |
| Propose | `task-creation-proposal.ts` | `project-creation-proposal.ts` |
| Preview | `task-creation-preview.ts` | `project-creation-preview.ts` |

## What varies and what does not

The invariant half is the safety sequence: validate the operation id, refuse a
snapshot that is not `current`, resolve a template, render, split and validate
frontmatter, confirm the target is absent, assemble the envelope. Both
`propose` implementations do all seven, in that order, with the same failure
codes.

The varying half is small enough to declare: how a path is allocated, what the
render context holds, what the operation reads, and what the postcondition
expects.

## Solution

One `preview(kind, request)` over a creation kind spec that supplies only the
varying half, feeding the commit service that already exists. `byteLength` and
`lineCount` move to the shared module, which ends
`project-creation-preview.ts` importing them from the task module.

## Acceptance criteria

- One module runs the safety sequence; adding a kind adds a spec and no
  service.
- Task and project creation produce byte-identical proposals and identical
  failure codes to the ones they produce today, proven by the existing tests
  before they are rewritten.
- `project-creation-preview.ts` imports nothing from `task-creation-preview.ts`.
- The pipeline is proven once against a fake spec; each kind keeps a table test
  covering its allocation, read set, and postcondition.
- `ProjectCreationProposalService`, the largest of the six files, currently has
  no test of its own — its behavior is covered directly once the pipeline lands.
- [[Documents/Decisions/0009-create-only-write-boundary|ADR 0009]] still
  holds: the pipeline cannot write, and the commit service remains `NoteWriter`'s
  only caller.

## Notes

Depends on [[Tasks/Give template rung resolution one owner]], which removes the
second rung ladder first so this change carries one argument rather than two.
Best done after [[Tasks/Lift a testable workspace out of the plugin entry point]],
so the two creation openers this replaces land somewhere testable; that ordering
is a convenience, not a dependency.

Generalizing the creation modal's fields is deliberately excluded; see
[[Tasks/Revisit declared creation fields after two more kinds]].
