---
type: task
title: Move agent grant creation into a dialog
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-agent-grant-lifecycle]]'
status: done
category: enhancement
priority: high
rank: 6200
milestone: '[[Milestones/v1 release]]'
created: 2026-08-17
---

# Move agent grant creation into a dialog

## Summary

Replace the **Create agent grant** row's three inputs hung off one `Setting`
with a dialog. The settings entry becomes a list of existing grants (already
covered by [[Tasks/Describe what each agent grant permits in the grant
list]]) plus a **Create grant** action that opens the dialog. Each field in
the dialog carries its own label and a description of what the value means
and whether it is required, replacing today's placeholder-only explanation —
see [[Tasks/Make the agent grant form explain what it asks for]], which owns
the reasoning for this move and the field-by-field meaning table.

This task owns the dialog surface itself: its fields, labels, descriptions,
and open/close behavior. Gating the create action on local resolution is
[[Tasks/Gate agent grant creation on local resolution]]; what the create
action copies on success is [[Tasks/Copy a complete client configuration on
grant creation]].

## Settled decisions this task implements

- **The label field stays; the terminology does not.** Settled: a grant keeps
  a short free-text name, because naming the tool a grant serves is how you
  recognize it later when deciding whether to revoke it. What goes is the
  `Repository name` framing — a grant has nothing to do with a repository,
  and that placeholder is the single most misleading string on the row. The
  field asks which tool the grant is for, and its example should look like a
  client name rather than a path or a project.
- **Content scope is an explicit choice.** Settled: the dialog asks which of
  the two levels applies — metadata only, or metadata and note text — and
  reveals the folder list only in the second. Scope is no longer inferred from
  whether the content-roots field happens to be empty. This is the one control
  that decides how much of the vault an external client can read, so it is
  posed as a question rather than left as a side effect of a blank field. The
  rule is owned by [Agent access and MCP](../../../../spec/agent-access-and-mcp.md).

## Acceptance criteria

- Grant creation opens in a dialog, not an inline settings row; the settings
  entry itself has no multi-field creation control left in it.
- The label, project, and content-scope fields each carry a visible label and
  a description of what the value means, distinguishing required from
  optional without trial and error.
- The two decision points above are resolved (not left as silent inference)
  and the resolution is recorded in this note before the change ships.
- The project and content-root fields keep the suggestion behavior from
  [[Tasks/Suggest indexed projects and folders for agent grant fields]].
- The dialog holds together at narrow widths, matching the responsive
  handling already established for this row.
- Cancelling or dismissing the dialog creates nothing.

## Validation

Manual check: open the dialog, confirm every field is labeled and described,
confirm cancel creates no grant, and confirm keyboard-only operation reaches
every field and both the create and cancel actions. Add or extend settings-tab
DOM coverage for the dialog's open/close and field wiring alongside
[[Tasks/Add DOM coverage for the settings tab]].

## Resolution

Shipped as `AgentGrantCreationModal` (`src/ui/agent-grant-creation-modal.ts`),
a plain `Modal` subclass following the same structure and lifecycle as
`TaskCreationPreviewModal`/`ProjectCreationPreviewModal` — a titled dialog
built from labeled `Setting` fields in `onOpen`, cleared in `onClose`, with a
create button whose enabled state and tooltip reflect live validation rather
than the shared `CreationPreviewModal` base, which is specific to previewing
and committing note creation and does not fit a settings-owned record.

Both decision points from "Settled decisions this task implements" are
resolved as built:

- **Label stays, terminology changes, and the field is required.** The field
  is titled "Which tool is this for", its placeholder example is
  `Claude Desktop` (client-shaped, not a repository or path), and it is
  required with no default and no prefill: only the user can answer which
  tool a grant is for, and a fallback to the project title would let two
  grants serving different tools on the same project both be named after the
  project, looking meaningful while carrying none. An empty or
  whitespace-only name is unresolved and blocks creation the same way an
  unindexed project or a missing content folder does. This is a UI-level
  requirement only — `#createAgentGrant`'s existing fallback to the project
  title in `src/main.ts` still exists and is untouched, tolerating a blank
  label reaching the application layer by some other path.
- **Scope is an explicit choice.** A "What this grant can read" dropdown asks
  Metadata only vs. Metadata and note text; the content-folder field renders
  only in the second state via `#renderContentRootsField`. At rest, the
  persisted `AgentGrant.contentRoots` shape is unchanged — an empty array
  still means metadata-only — so the explicit choice is a UI-level framing
  over the same compatibility surface, not a schema change.

The settings entry has no multi-field control left in it: it is a heading,
the existing-grants list, and one "Create grant" button that opens the modal.
