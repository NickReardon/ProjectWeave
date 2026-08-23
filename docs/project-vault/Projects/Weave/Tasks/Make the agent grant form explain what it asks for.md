---
type: task
title: Make the agent grant form explain what it asks for
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-agent-grant-lifecycle]]'
status: review
category: enhancement
priority: high
rank: 6100
milestone: '[[Milestones/v1 release]]'
created: 2026-08-17
---

# Make the agent grant form explain what it asks for

## Summary

The grant row is one `Setting` named "Create agent grant" with three unlabeled
inputs hung off it. Each field's only explanation is a placeholder, which is not
a label and vanishes as soon as anything is typed. A reader cannot tell what is
being asked, which fields are required, or what the values mean.

Two of the three placeholders actively mislead. `Repository name` names a free
text label for the grant itself and has nothing to do with a repository.
`Projects/Game/Documents` looks like a required example path when the field is
optional and its emptiness is meaningful.

## What each field really is

| Field | Meaning | Required |
| --- | --- | --- |
| Label | How this grant is recognized later, in order to revoke it. Naming the tool it serves is the useful convention. | Yes |
| Project | The single project this grant may read. | Yes |
| Content roots | Folders whose Markdown bodies may also be read. Empty means metadata only. | No |

## The distinction worth surfacing

Content roots are the actual permission boundary, not a formatting detail. A
grant with none exposes entity metadata — titles, statuses, structure. Adding a
folder additionally exposes the prose inside notes under it. The form presents
this as an optional comma-separated list, which reads as a convenience rather
than as the choice that decides what an external tool can see.

## Connection values are incomplete

Creating a grant copies only the secret to the clipboard. A client also needs
the endpoint and the grant id, both of which are displayed but must be
transcribed by hand. The copy action therefore hands over one of three required
values while presenting itself as the step that delivers the credential.

Copying a complete client configuration block, rather than a bare secret, would
remove the transcription step and the ambiguity about what the copied value
even is.

## Agreed direction

The grant form moves out of the settings row and into a dialog, and a grant is
fixed once it exists.

**A dialog, not a settings row.** `Setting` gives one label and a control strip,
which is why three inputs share a single name and why the row's responsive
layout has already been repaired twice. Every other multi-input surface in this
plugin is a modal. The settings entry reduces to a list of existing grants with
create and revoke actions.

**Immutable once created.** A grant is not edited after the fact. Correcting one
means revoking it and creating a replacement. Editing is deliberately deferred
rather than ruled out: nothing prevents adding it later, since grants live in
`data.json` rather than in vault Markdown and `removeAgentGrant` already mutates
them, so the create-only note boundary would not stand in the way.

Immutability keeps the security story simple. A secret handed to a tool covers
exactly what it covered when issued, and scope cannot silently widen underneath
a client that already holds the credential.

**The grant list carries the details.** Each existing grant shows what it
permits — the project, whether it is metadata-only or which content roots it
can read, and enough identity to configure a client. Reading a grant's scope
therefore does not require an editor, which is what makes immutability
tolerable rather than opaque.

**Consequence for validation.** Because a mistake is permanent rather than
repairable, resolving the chosen values before the grant can be created is
load-bearing, not a nicety. See
[[Tasks/Restructure agent grant creation into validate-then-create]], whose
ordering this design depends on.

## Acceptance criteria

- Grant creation happens in a dialog; the settings entry is a list of existing
  grants with create and revoke actions.
- Each input carries its own label and a description of what the value means.
- Required and optional fields are distinguishable without trial and error.
- The metadata-only versus content-readable consequence of content roots is
  stated where the choice is made.
- Each listed grant describes what it permits without needing to be opened.
- What is copied on creation is unambiguous, and covers everything a client
  needs to connect.
- The dialog and the grant list both hold together at narrow widths.

## Resolution

Built across the member tasks under this one and audited criterion by
criterion against `src/ui/agent-grant-creation-modal.ts`,
`src/ui/agent-grant-form.ts`, `src/ui/settings-tab.ts`, and `styles.css`.
Every criterion but the last holds, and each is now covered by a test that
fails when the behavior is removed:

- **Dialog, and a list with create and revoke.** `AgentGrantCreationModal`,
  opened from a single **Create grant** button. The settings entry is the
  grant list plus that button. `tests/ui/settings-tab.test.ts` asserts the
  create row carries no value-collecting control at all, so the retired
  three-input row cannot quietly come back.
- **Own label and description per input.** Four separate `Setting` rows.
  `tests/ui/agent-grant-creation-modal.test.ts` asserts one control per row
  and one row per field name; hanging a second input off any row fails it.
- **Required versus optional distinguishable.** Each description states it,
  and every unresolved field names itself in the status line and the button
  tooltip rather than leaving a dead button.
- **The metadata-only consequence is stated at the choice.** The scope row's
  description says what each level exposes and that this is the permission
  boundary. Previously only the two option names were asserted, which passed
  with the explanation deleted; the new test reads the scope row itself.
- **The list describes what each grant permits.** Project, grant id, and
  `describeAgentGrantScope` for both scope states, covered for metadata-only
  and content-readable grants.
- **What is copied is unambiguous and complete.** A whole `mcpServers` entry
  — endpoint, grant id, secret, and a bracketed placeholder for the one path
  the plugin cannot know.

### Outstanding: narrow widths

**Not verified, and this task stays open for it.** The responsive rule the
inline row carried was deleted along with the row, and the replacement
comment claimed a stacking that no rule performed: Obsidian's `.setting-item`
keeps a field's label beside its control at every desktop width. `styles.css`
now stacks both the dialog's fields and the grant list's rows below 700px and
lets long paths and grant ids break.

That is the implementation, not the confirmation. Layout cannot be exercised
in the test DOM, which applies no stylesheet and performs no layout, so what
is proven automatically is only that both surfaces still carry the classes
the stylesheet targets. Seeing the dialog and the list at narrow width in
Obsidian — including a mobile-width window — is the remaining check, and it
is the same one [[Tasks/Move agent grant creation into a dialog]] and
[[Tasks/Describe what each agent grant permits in the grant list]] each
claimed while no rule was in place.

## Notes

Overlaps [[Tasks/Restructure agent grant creation into validate-then-create]],
which changes the same row's order of operations, and builds on
[[Tasks/Suggest indexed projects and folders for agent grant fields]]. These
should land as one redesign rather than three passes over the same control.
