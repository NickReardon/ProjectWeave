---
type: task
title: Make the agent grant form explain what it asks for
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-agent-grant-lifecycle]]'
status: backlog
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

## Notes

Overlaps [[Tasks/Restructure agent grant creation into validate-then-create]],
which changes the same row's order of operations, and builds on
[[Tasks/Suggest indexed projects and folders for agent grant fields]]. These
should land as one redesign rather than three passes over the same control.
