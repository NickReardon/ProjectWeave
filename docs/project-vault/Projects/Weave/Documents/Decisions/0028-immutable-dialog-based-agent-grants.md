---
type: decision
id: '0028'
area: agent-access
status: accepted
canonical: false
affects: ['agent-access-and-mcp']
---

# ADR 0028: Immutable, dialog-based agent grants with editing deferred

- Status: accepted
- Date: 2026-08-17
- Owners: Project Weave

Once this record is accepted, its body is not edited. A decision that changes
is superseded by a new record; see [`README.md`](README.md).

## Context

The **Create agent grant** row is one `Setting` named for the row, not the
task, with three unlabeled inputs hung off it: a free-text label, a project
path, and a comma-separated list of content roots. Each field's only
explanation is a placeholder, and two of the three placeholders mislead —
`Repository name` names a free-text grant label and has nothing to do with a
repository, and `Projects/Game/Documents` reads as a required example when
the field is optional and its emptiness is meaningful (no content roots means
a metadata-only grant). Creating a grant resolves all three values and
generates a credential in the same irreversible action; a mistyped project
path or content root produces a grant that looks successful and fails later,
far from where the mistake was made, once an MCP client tries to use it.

`Setting` was designed for one label and one control strip. Cramming three
inputs into it is why the row's responsive layout has already needed repair
twice, and why nothing on the row can explain what each field means without
crowding it further. Every other multi-input creation surface in this plugin
already uses a modal.

Separately, [[Tasks/Suggest indexed projects and folders for agent grant
fields]] added suggestion-based entry for the project and content-root
fields, and [[Tasks/Restructure agent grant creation into validate-then-create]]
established that local resolution must gate creation because a mistake is
otherwise expensive to diagnose. Both land against the same row and the same
underlying question: what shape should grant creation and management take.

## Decision

Grant creation moves out of the settings row into a dialog. The settings
entry becomes a list of existing grants with create and revoke actions; there
is no inline multi-field creation row.

Grants are immutable once created. There is no update operation. Correcting a
mistaken grant means revoking it and creating a replacement. Editing is
deliberately deferred rather than ruled out — grants live in `data.json`
rather than in vault Markdown, and `removeAgentGrant` already mutates the
grant list, so nothing about a create-only boundary stands in the way of
adding an edit operation later if the deferral proves costly.

The grant list carries enough about each grant — the project it may read,
whether it is metadata-only or which content roots it can also expose, and
enough identity to recognize and configure a client against it — that reading
a grant's scope never requires opening it. This is what makes immutability
tolerable: a permanent grant would be opaque without it.

Because a mistake is now permanent rather than repairable, resolving the
chosen project and content roots against the vault before the grant can be
created is load-bearing rather than a nicety, and creation stays atomic: the
dialog's create action both creates the grant and hands over its secret in
one step, with rollback on failure, so no grant can exist without its secret
having been delivered. What is delivered is a complete client configuration
— endpoint, grant id, and secret together — rather than the secret alone,
removing the transcription step the current single-value clipboard copy
leaves behind.

The owning specification is [Agent access and MCP](../Specifications/agent-access-and-mcp.md),
whose "Grant lifecycle and creation" section now states these rules.

## Alternatives considered

- **Keep the settings-row layout and only add labels/descriptions:** rejected
  because three inputs sharing one `Setting` name is the underlying defect,
  not a missing description; a fourth responsive-layout repair would not fix
  the readability problem.
- **Allow editing an existing grant's scope in place:** rejected for now
  because a mutable grant would let scope widen silently underneath a client
  that already holds the credential, which complicates the security story
  this redesign is meant to simplify. Not ruled out permanently — see
  Consequences.
- **Create first, then offer a separate "copy secret" action:** rejected
  because it reintroduces a "grant exists but its secret was never captured"
  state that today's atomic create-and-copy avoids, and would require a
  visible partial-grant condition in the list to stay safe.
- **Validate against the gateway instead of the local vault/index:** rejected
  because it would make grant creation depend on the gateway being enabled,
  contradicting the existing requirement that creation work with the gateway
  disabled.

## Consequences

- Positive: grant scope is readable from the settings list without opening
  anything, which is what makes a create-only lifecycle tolerable.
- Positive: a grant can no longer be created from an unresolved path that
  only fails later during MCP client setup.
- Positive: a client configuration is copied as one complete, unambiguous
  unit instead of a bare secret the user must combine by hand with values
  read from elsewhere on the row.
- Negative: correcting any grant, even a trivial one, requires revoking and
  recreating it rather than adjusting one field, until an edit operation is
  built.
- Follow-up: whether the free-text grant label survives this redesign, and
  whether content scope becomes an explicit metadata/content choice rather
  than an inferred one, are both left to the task-level design under the new
  Epic rather than decided here.
