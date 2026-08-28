---
type: task
title: Restructure agent grant creation into validate-then-create
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-agent-grant-lifecycle]]'
status: review
category: enhancement
priority: high
rank: 5500
milestone: '[[Milestones/v1 release]]'
created: 2026-08-17
---

# Restructure agent grant creation into validate-then-create

> **Part of one redesign.** The grant form moves out of the settings row into a
> dialog, and grants stay immutable once created. Because a mistake can only be
> corrected by revoking and recreating, the ordering below is load-bearing
> rather than a convenience. See
> [[Tasks/Make the agent grant form explain what it asks for]], which owns the
> redesign; land them together rather than as separate passes over the same
> control.

## Summary

Agent grant creation currently performs path interpretation and secret
generation in a single irreversible action. The **Create and copy secret**
button takes three free-text fields, resolves them, generates the grant, and
writes the secret to the clipboard at once. A mistyped project path or content
root therefore produces a grant that looks successful and fails much later,
during MCP client setup, where the error is hard to attribute.

The flow should instead be: select the project and content folders, see them
confirmed as resolving, and only then create the grant and take the secret.

## Order of operations

1. The project and each content root are chosen through suggestion rather than
   typed blind. That part is covered by
   [[Tasks/Suggest indexed projects and folders for agent grant fields]] and is
   a prerequisite rather than part of this task.
2. A row shows the resolved selection and states that each part is a real,
   choosable target: the project path is one of the indexed projects, and every
   content root is an existing vault folder.
3. The create action is not pressable until every chosen value resolves.
4. Pressing it creates the grant and hands over the secret in one step.

## What counts as resolvable

Content roots are **optional** — the settings row already describes them that
way, and a grant with none is a valid metadata-only grant. Empty must therefore
count as resolvable, or the flow loses the ability to create one. A non-empty
list resolves only if every entry names an existing folder.

The project path is required and must name an indexed project.

A button that is simply unpressable is a dead end, so the row states which value
is unresolved rather than leaving the user to guess why nothing happens.

## The atomicity constraint

Creation and clipboard copy are currently **atomic**: the grant is rolled back
if the clipboard write fails, which is why no "grant exists but its secret was
never captured" state can occur today. Splitting copy into a separate later
action would reintroduce exactly that state.

The chosen resolution keeps step 4 atomic: validation gates the button, and the
button still creates and copies together with rollback on failure. The
alternative — creating first and offering a separate copy button — was rejected
because it requires a partial grant state and a visible "secret never copied"
condition in the grant list to remain safe.

## What validation means here

Validation is **local to the vault**. It resolves the chosen paths against the
existing index and file tree: does this path name an indexed project, does this
folder exist. It is not a request to the gateway and does not confirm that a
grant would work end to end.

That distinction matters for setup order. The gateway does not need to be
enabled to create a valid grant, so the row must validate with it switched off.
Proving that a grant actually serves an MCP client is a separate concern, and
belongs with the companion rather than with this settings row.

## Acceptance criteria

- The project and content-root selections are resolved before a grant can be
  created, and the create action is unavailable until they resolve.
- The result is visible, naming what failed rather than only refusing.
- A grant either exists with its secret delivered, or does not exist; no
  partial state is reachable.
- The responsive layout established for this row still holds at narrow widths.
- A path that is not an indexed project and a content root that is not an
  existing folder are rejected with distinct messages.
- Resolution works with the agent gateway disabled.

## Resolution

`resolveAgentGrantForm` in `src/ui/agent-grant-form.ts` is the gate, and the
dialog re-runs it on every field change rather than only on submit.

- **Resolution precedes creation.** The create button is disabled until every
  chosen value resolves, and `#create` re-checks before calling out, so the
  button state is not the only guard.
- **The result names what failed.** Each unresolved state produces its own
  message, in the status line and on the button, rather than an unexplained
  refusal.
- **Distinct messages.** A path that is not indexed is rejected as *not an
  indexed project*; a folder that does not exist is rejected as *not an
  existing vault folder*, quoting the offending entry. Covered separately.
- **Atomicity.** Creation and clipboard delivery happen in one action, and a
  clipboard failure removes the grant again. Deleting the rollback call fails
  `tests/ui/agent-grant-creation-modal.test.ts`, so the coverage is real.
- **Gateway disabled.** This had a harness that could not express it: the
  `endpoint` option folded `null` back into the enabled default through `??`,
  so the disabled case had never actually been run. Fixed, and the dialog now
  resolves and creates with `endpoint: null`, emitting an empty endpoint in
  the copied configuration. Making readiness depend on the endpoint fails
  that test.

`resolveAgentGrantForm` takes both predicates as arguments and reaches
nothing else, so the local-versus-gateway distinction is structural rather
than only tested.

**Residual, not covered by the atomicity claim as written.** Rollback itself
can fail: if the clipboard write fails *and* the subsequent `removeAgentGrant`
save also fails, the grant survives with its configuration never delivered.
Both failures are surfaced to the user and the grant is visible in the list to
revoke by hand, but the specification's "no reachable state" is absolute and
this compound path is a counterexample. Deciding whether to soften the claim
or close the path belongs with the specification's owner.

### Outstanding: narrow widths

**Not verified, and this task stays open for it.** See the same section on
[[Tasks/Make the agent grant form explain what it asks for]]: the rule is
restored in `styles.css`, but confirming it needs Obsidian, since the test DOM
applies no stylesheet and performs no layout.

## Notes

Depends on the suggester work landing first, since the selections it validates
are the ones that work introduces. The owning specification already carries
these rules under "Grant lifecycle and creation" in
[[Documents/Specifications/agent-access-and-mcp]] — local resolution gating
creation, gateway independence, explicit scope, and atomic creation — so this
change adds no behavior the specification does not already state.
