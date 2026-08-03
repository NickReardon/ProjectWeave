# 03 — Task Management

## Goal

Let a user create, inspect, edit, organize, and navigate task notes without obscuring their Markdown representation.

## Create task

The command opens a form with title, project, optional epic, optional sprint, status, points, owner, priority, dependencies, origin, and target folder/filename. Defaults are context-sensitive but visible before confirmation.

Required behavior:

- Project is required and chosen explicitly unless unambiguous from the active view/note.
- Initial status defaults to `todo`.
- Epic choices are restricted to the selected project.
- Project-sprint choices are restricted to that project; portfolio-sprint choices must include it.
- Dependencies show same-project choices first and mark cross-project choices as warning-only.
- Filename/path collision blocks creation and offers a different filename; v1 does not overwrite.
- The body may be empty or initialized from a configurable task template.

Creation is a single-file proposal. The note is not created until validation succeeds and the user confirms the form.

## Edit task

Edit exposes the same supported fields and preserves the body plus unknown frontmatter keys. Field removal removes only the selected supported key. Manual editing remains fully supported; the UI reflects changes after re-indexing.

The editor MUST NOT normalize unrelated formatting, reorder unknown keys, or rewrite the whole note when only a supported property changes. If the note changes after the form opens, saving reports a conflict and offers Reload Draft; automatic overwrite is forbidden.

## Status transitions

Allowed user-selected statuses are all six controlled values. Project Weave rejects starting a same-project-blocked task, defined as transition from `todo` or `waiting` to `in-progress` while an unsatisfied hard dependency exists. Other transitions are permitted with these rules:

- `done` is terminal for readiness calculations but may be reopened explicitly.
- `cancelled` is terminal but does not satisfy downstream hard dependencies.
- Moving to `waiting` does not create a dependency.
- Moving to `done` or `cancelled` does not silently alter sprint membership.

## Assignment and planning fields

- Owner is one optional free-text name in v1; clearing it removes the key.
- Points, when present, are positive integers.
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
