---
type: decision
id: '0036'
area: agent-access
status: accepted
canonical: false
affects: ['agent-access-and-mcp']
---

# ADR 0036: Require a revocation-aware build on every gateway-hosting device

- Status: accepted
- Date: 2026-08-27
- Owners: core

Once this record is accepted, its body is not edited. A decision that changes
is superseded by a new record; see [`README.md`](README.md).

## Context

[ADR 0035](0035-record-grant-revocations-as-tombstones.md) added recorded
revocations to settings without a `settingsVersion` bump, and called the result
self-healing across mixed versions: an older build drops the field when it
writes, and the next adoption on a current build restores it from memory.

That is true of the data and false of the authorization, which is what the
field exists for. An older build does not consult recorded ids at all. Handed a
file where a stale save restored a grant, it loads the grant and serves it, and
it is a desktop build, so it can be hosting the gateway itself. The repair
ADR 0035 describes happens on a *different* device, only if one is running, and
only when it next adopts — so the exposure is bounded by nothing the plugin
controls.

The additive field also removed the one signal that could have failed the older
build closed. A version it does not recognize is refused outright, which would
have left it with no grants to serve.

## Decision

Recorded revocations are enforceable only on builds that read them, so every
device that hosts the agent gateway for a vault must run a build that does.
This is a release constraint, stated where the gateway's behavior is
documented, not a mechanism: no build can make an older one on another machine
refuse a credential.

This replaces ADR 0035's claim that the additive field makes mixed versions
safe. The field stays additive and the write-back stays as decided there; what
is withdrawn is the conclusion that this covers authorization.

A vault whose devices are not all upgraded keeps the guarantee ADR 0035 states
on every upgraded device and loses it on the others. Revocation from a device
running an older build still removes the entry, so the ordinary case is
unaffected; what an older build cannot do is refuse a grant an entry has been
restored for.

## Alternatives considered

- **Bump `settingsVersion` so older builds fail closed:** rejected. They do
  fail closed on authorization — an unrecognized version yields no grants — but
  the same path yields no project roots either, and the next setting such a
  build writes puts its defaults over the shared file, destroying the roots and
  grants of every device. Trading a bounded authorization gap for unbounded
  data loss is the worse failure.
- **Refuse to serve when the file looks like an older build wrote it:**
  rejected. The absence of the field is indistinguishable from a vault that has
  never revoked anything, so this fails closed on the common case and still
  cannot constrain the older build, which is the device actually serving.
- **Say nothing and rely on the repair write:** rejected. It is the claim this
  record exists to withdraw.

## Consequences

- Positive: the documented guarantee matches what the code can enforce, on the
  one subject where overstating it means a credential the user believes is
  withdrawn.
- Negative: a real constraint is carried by documentation, which a user can
  miss. Nothing available at this layer changes that.
- Follow-up work: none. The constraint is stated in
  [[Documents/Specifications/agent-access-and-mcp|Agent access and MCP]] and in
  `README.md`; a mechanism that could enforce it would be a new decision.
