---
type: task
title: Move agent grant creation into a dialog
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-agent-grant-lifecycle]]'
status: backlog
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

## Decision points to resolve while building this

- **Does the free-text label field survive?** It exists only so a grant is
  recognizable later, when deciding whether to revoke it — its current
  placeholder, `Repository name`, is also the single most misleading string
  on the row. If the grant list (once it shows project, scope, and creation
  order) already makes a grant recognizable without a label, the field adds a
  required decision with no payoff. Recommendation: drop the label field
  unless building the list first shows it is insufficient without one; if it
  is dropped, the list's identity needs a different anchor (see
  [[Tasks/Describe what each agent grant permits in the grant list]]).
- **Should content scope be an explicit binary choice plus folder list,
  rather than a bare list?** Today, whether a grant is metadata-only is
  inferred from whether the content-roots field is empty — the real decision
  a user is making (metadata only vs. metadata plus note text) is never
  stated as a choice. Recommendation: make it explicit — a toggle or radio
  for metadata-only vs. content-readable, revealing the folder list only in
  the content-readable state — so the field asks the real question instead
  of inferring it from emptiness.

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
