---
type: decision
id: '0035'
area: agent-access
status: accepted
canonical: false
affects: ['agent-access-and-mcp']
---

# ADR 0035: Record grant revocations as tombstones

- Status: accepted
- Date: 2026-08-27
- Owners: core

Once this record is accepted, its body is not edited. A decision that changes
is superseded by a new record; see [`README.md`](README.md).

## Context

[ADR 0028](0028-immutable-dialog-based-agent-grants.md) made revocation the
only correction a grant has: grants are immutable, so withdrawing one is how a
mistake or a compromise is answered. Revocation therefore has to survive
whatever the vault does to `data.json`, including sync rewriting it on another
device's behalf.

The plugin adopts that file when it changes, and every local write now waits in
one queue with the adoption and re-reads the file before saving. That orders
every writer this plugin controls. It does not order sync, which writes the
file directly. A revocation landing between a local write's read and the end of
that write is overwritten by it, and the change notification for that
revocation then reads back the settings the write restored. The withdrawn grant
keeps authorizing on this device, and nothing later corrects it: the revoking
device has already written its file and has no reason to write again.

`loadData` and `saveData` are the whole persistence surface. Neither offers
compare-and-swap or a version to write against, so no amount of re-reading
closes the window — the write is never atomic with the read that justified it.
The deeper problem is that a grant's **absence** is the only evidence it was
revoked, and a stale save destroys that evidence. A device that never observes
the absence cannot remember it.

## Decision

Revocation is recorded, not inferred. Revoking a grant writes its id to a
retained set in settings as well as removing the grant entry, and adoption
drops any grant whose id that set contains, so a restored entry never reaches
the list authorization is served from.

The set is grow-only in memory: an id read from the file or already held is
never dropped by adopting a file that omits it. That alone does not propagate,
because the device holding the id may be the only one that has it — the losing
interleaving is exactly the one where the revoking device's write was
overwritten, and this record has already established that no later write from
it is guaranteed. **Adopting a file that omits an id this device holds
therefore writes the union back.** Propagation is what makes the set converge;
without it a tombstone can be held forever by one device and never seen by
another.

That write is best-effort. This device is already protected the moment it holds
the id, so a failed propagation is logged rather than raised, and the next
adoption attempts it again.

Tombstones are kept permanently. Bounded retention is not decidable here: an
offline device can hold a stale grant indefinitely, so no elapsed time or
generation count proves an id is safe to drop, and only device acknowledgements
would — a mechanism this plugin does not have and should not grow for this.
Compaction is a separate design if growth ever matters; a revoked id is a short
string, and grants are created by hand.

The set is added to settings without a `settingsVersion` bump. A bump makes
every older install treat the file as unreadable, which costs a working
installation to protect a field that install would ignore anyway. An older
build instead drops the field when it writes, and the next adoption on a
current build restores it from memory by the rule above — the propagation write
makes the schema self-healing across mixed versions.

## Alternatives considered

- **Keep re-reading before the write, and accept the window:** rejected. It
  narrows the interleaving without bounding it, and the failure it leaves is a
  credential that stays authorized after the user withdrew it — the one
  outcome the grant model exists to prevent.
- **Remember, per session, every grant id seen to disappear from an adopted
  file:** rejected. It closes nothing here, because the losing interleaving is
  precisely the one where this device never observes the disappearance.
- **Write through a separate file that sync does not touch:** rejected. Nothing
  makes a second file exempt from sync, and a revocation that does not travel
  between devices is not the guarantee being sought.
- **Ship with the gap, named in the specification:** rejected. It was a
  legitimate choice for a preview, and it was declined deliberately rather than
  inherited from a comment.
- **Hold tombstones in memory without writing them back:** rejected. It
  protects the device that revoked and no other, and in the losing interleaving
  that device is precisely the one whose write was lost.
- **Bound retention by the grant lifecycle:** rejected as undecidable. An
  offline device can retain a stale grant for any length of time, so nothing
  short of acknowledgement from every device proves an id is droppable.
- **Bump `settingsVersion` for the new field:** rejected. Older builds refuse a
  version they do not know, so a synced file would leave them with no roots and
  no grants; an ignored extra field costs them nothing.

## Consequences

- Positive: revocation stops depending on which writer lands last, and a
  restored grant entry can no longer re-authorize anywhere.
- Positive: the specification can state a cross-device guarantee with no
  reachable exception, which it cannot today.
- Negative: adoption is no longer a path that only reads. It writes in one
  case — a file missing an id this device holds — which reverses a property the
  hook was deliberately given, and that write races the sync that triggered it
  like any other. The trade is taken knowingly: what it can lose is an
  unrelated setting written in the same instant, and what it buys is a
  revocation that stops being lost.
- Negative: the settings schema gains a field, with the normalizer work that
  implies, and the set grows without bound until a compaction design exists.
- Follow-up work:
  [[Tasks/Survive a revocation that syncs into a save already in flight]]
  builds it, and updates
  [[Documents/Specifications/agent-access-and-mcp|Agent access and MCP]], which
  owns the resulting cross-device guarantee and the permanent-retention rule.
