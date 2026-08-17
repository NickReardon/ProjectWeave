---
type: spec
area: tasks
status: current
canonical: true
related_decisions: ["0008", "0014"]
---

# Task Management

## Goal

Let a user create, inspect, edit, organize, and navigate task notes without obscuring their Markdown representation.

## Create task

The command opens a form with title, project, optional epic, optional sprint, status, points, owner, priority, dependencies, origin, and target folder/filename. Defaults are context-sensitive but visible before confirmation.

Required behavior:

- Project is required and chosen explicitly unless unambiguous from the active view/note.
- Initial status defaults to `backlog`. Creation MAY offer an explicit create-on-board choice that produces `todo` instead; Add to Board moves an existing backlog task to `todo`.
- Epic choices are restricted to the selected project.
- Project-sprint choices are restricted to that project; portfolio-sprint choices must include it.
- Dependencies show same-project choices first and mark cross-project choices as warning-only.
- Filename/path collision blocks creation and offers a different filename; v1 does not overwrite.
- The body may be empty or initialized from a configurable task template.

Creation is a single-file proposal. The note is not created until validation succeeds and the user confirms the form.

### Target folder

New task notes default to a `Tasks` folder beside the project note, so `Projects/Game/Project.md` yields `Projects/Game/Tasks`. A project note at the vault root yields `Tasks`.

A caller MAY supply a subfolder relative to that root, validated to stay inside it. Absolute paths, drive letters, `.`, `..`, empty segments, and control characters are rejected rather than repaired: each one means the caller intended a different location, and silently clamping it files the task somewhere nobody chose.

There is no vault-wide or per-project folder override in v1. The convention needs no configuration and survives a project being moved.

### Filename derivation

The filename stem derives from the task title:

- control characters and the characters that break vault paths or wiki links — `\ / : * ? " < > | # ^ [ ]` — become separators;
- whitespace runs collapse;
- surrounding dots and spaces are trimmed;
- the stem is length-capped;
- Windows device names are refused.

A title that leaves nothing usable produces a diagnostic rather than an invented name.

### Collision policy

Allocation suggests the first free path using a deterministic ` 2`, ` 3`, … suffix, bounded at 100 attempts. Occupancy compares case-insensitively, because macOS and Windows treat `Fix crash.md` and `fix crash.md` as one file.

Suggesting is not committing. The generated name reaches the user as an editable preview value, and the write path still refuses to overwrite an existing note; see [Validation and safe writes](validation-and-safe-writes.md). This is what lets this document's "collision blocks creation" rule and the generated-filename behavior in [Agent access and MCP](agent-access-and-mcp.md) hold at the same time.

Suffixes are position-based, so deleting `Implement request 2.md` allows the next allocation to reuse that name.

## Edit task

Edit exposes the same supported fields and preserves the body plus unknown frontmatter keys. Field removal removes only the selected supported key. Manual editing remains fully supported; the UI reflects changes after re-indexing.

The editor MUST NOT normalize unrelated formatting, reorder unknown keys, or rewrite the whole note when only a supported property changes. If the note changes after the form opens, saving reports a conflict and offers Reload Draft; automatic overwrite is forbidden.

## Status transitions

Allowed user-selected statuses are all seven controlled values. In the default enforced dependency mode, Project Weave rejects starting a same-project-blocked task, defined as transition from `backlog`, `todo`, or `waiting` to `in-progress` while an unsatisfied hard dependency exists. A project that selects advisory mode surfaces the same blockers and requires acknowledgement instead of rejecting the transition; see [Dependencies and iterations](dependencies-and-iterations.md). Other transitions are permitted with these rules:

- `done` is terminal for readiness calculations but may be reopened explicitly.
- `cancelled` is terminal but does not satisfy downstream hard dependencies.
- Moving to `waiting` does not create a dependency.
- Moving to `done` or `cancelled` does not silently alter sprint membership.

## Assignment and planning fields

- Owner is one optional free-text name in v1; clearing it removes the key.
- Points, when present, are positive integers. A missing estimate never makes a task invalid, and estimates are usable with or without a planning period. Missing-estimate warnings or requirements occur only when the project explicitly enables an estimation policy. Any total that includes estimates discloses both the estimated and unestimated task counts.
- Priority, due date, rank, and estimates never affect dependency readiness.
- Removing a sprint sends the task to backlog while retaining sprint history.
- Changing the project requires preflight of epic, sprint, and dependency compatibility. Incompatible relations must be resolved explicitly in the same proposal; they are never silently dropped.

## Navigation

From a task, commands can open its project, epic, current sprint, origin, each dependency, each dependent, iteration root, previous iteration, and next iteration. Missing targets show a diagnostic notice and do not create placeholder notes.

## Bulk operations

V1 MAY support multi-select status/sprint/owner changes in workbench views. When present, each is a bulk proposal governed by the full safe-write contract. Mixed invalid selections fail preflight as a whole; there is no best-effort default.

## Edge cases

- A task with an invalid project remains inspectable but mutating commands are disabled except an explicit repair action.
- A manually assigned incompatible epic/sprint is shown with an error; the plugin does not hide it.
- A task can be reopened after sprint completion, but it is backlog work unless explicitly assigned to a current eligible sprint.
- Unknown status values are errors, not additional columns.

## Acceptance criteria

- Create produces one valid, human-readable Markdown note with no hidden canonical state.
- Edit preserves body bytes and unrelated frontmatter semantics.
- Blocked work cannot be started through Project Weave UI.
- Owner, points, epic, sprint, status, dependencies, and origin can each be set and cleared where optional.
- Every related-note navigation command handles resolved, unresolved, and ambiguous targets.
- External edits during an open form cannot be overwritten silently.
