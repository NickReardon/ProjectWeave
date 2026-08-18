---
type: task
title: Describe what each agent grant permits in the grant list
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-agent-grant-lifecycle]]'
status: backlog
category: enhancement
priority: high
rank: 6400
milestone: '[[Milestones/v1 release]]'
created: 2026-08-17
---

# Describe what each agent grant permits in the grant list

## Summary

The settings entry for agent grants becomes a list of existing grants with
create and revoke actions, replacing today's row that only ever showed the
form for creating a new one. Because grants are becoming immutable (see
[[Tasks/Make the agent grant form explain what it asks for]] and
[ADR 0028](../../../../decisions/0028-immutable-dialog-based-agent-grants.md)),
this list is the only place a grant's scope is ever visible again after
creation — there is no editor to open. Each row already shows the label,
grant id, project, and content roots today (`#renderAgentGrant`'s existing
`Setting` per grant); this task is about making that description sufficient
on its own, not about the list existing in the first place.

## What the list must convey

- The project the grant may read.
- Whether the grant is metadata-only or which content roots additionally
  expose Markdown bodies, stated plainly rather than left to be inferred from
  a comma-separated path list.
- Enough identity to recognize the grant when deciding whether to revoke it,
  and enough to reconstruct a client configuration against it (at minimum the
  grant id, which is already shown).

## Decision point carried over from the dialog task

[[Tasks/Move agent grant creation into a dialog]] raises whether the
free-text label field survives. If it is dropped, this list is where its
absence has to be made up for — a grant then needs to be identifiable by
project, content scope, and creation order (or another stable anchor) alone.
Do not resolve this independently of that task; land the two together so the
list's identity story and the dialog's field set agree.

## Acceptance criteria

- Every existing grant is listed with its project, its metadata-only versus
  content-root scope stated explicitly, and enough identity to distinguish it
  from another grant on the same project.
- A grant's scope is readable without opening anything else.
- The list holds together at narrow widths.
- Revoke remains available per grant and its confirmation still names what is
  being revoked.

## Validation

Manual check: create two grants against the same project with different
content-root scopes (one metadata-only, one with folders) and confirm the
list distinguishes them without ambiguity. Add or extend settings-tab DOM
coverage asserting the rendered description text for both scope states.
