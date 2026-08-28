---
type: task
title: Survive a revocation that syncs into a save already in flight
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-agent-grant-lifecycle]]'
status: done
category: defect
priority: high
rank: 5875
milestone: '[[Milestones/v1 release]]'
created: 2026-08-27
---

# Survive a revocation that syncs into a save already in flight

A grant revoked on another device could stay authorized on this one. Every
settings write shares one queue with the adoption of a synced `data.json` and
re-reads the file first, which orders every writer this plugin controls — but
not sync, which writes the file directly. A revocation landing between a local
write's read and that write was overwritten by it, and the notification for it
then read back the settings the write restored. Nothing corrected it: the
revoking device had already written its file.

`loadData` and `saveData` have no compare-and-swap, so no amount of re-reading
closes that window. The fix, decided in
[[Documents/Decisions/0035-record-grant-revocations-as-tombstones|ADR 0035]],
is to stop treating a grant's absence as the evidence that it was revoked.

Revoking now records the grant's id in `revokedAgentGrantIds` as well as
removing the entry, and every path that reads settings drops a grant whose id is
recorded — adoption and load alike, since a restart has no memory to compare a
file against and would otherwise restore the credential. Recorded ids merge as a
union rather than being replaced by the file. Holding an id protects only the
device holding it, and in the losing interleaving that is the device whose write
was lost — so adopting a file that omits one writes the union back, which is the
single case where adopting settings writes them. That write is not raised as an
error, because the holder already refuses the grant, but a revocation that
cannot be written is durable only for the session: the user is told, once per
grant, and the next adoption retries.

A record that is present but unreadable is not treated as an empty one: the
settings it accompanies serve no grant and leave the gateway off, with a notice
naming the field, and the sync path refuses such a payload outright. Reading a
damaged record as "nothing was revoked" would hand back every grant the file
still named, on the one path — a cold load — where nothing in memory contradicts
it.

Ids are kept permanently. Bounded retention is not decidable without device
acknowledgements, since an offline device can hold a stale grant for any length
of time; compaction is a separate design if growth ever matters. The field is
added without a `settingsVersion` bump, because an older build would refuse a
version it does not know, lose its roots and grants, and write its defaults over
the shared file. That keeps the data compatible and not the authorization: an
older build ignores the record entirely, so
[[Documents/Decisions/0036-require-a-revocation-aware-build-on-every-gateway-device|ADR 0036]]
requires a recording build on every device that hosts the gateway and withdraws
ADR 0035's claim that the additive field made mixed versions safe.

Covered in `tests/unit/external-settings-change.test.ts` by `keeps a grant
unauthorized after a stale save restores it` — which drives the interleaving
through a real gateway — plus `writes the union back when the adopted file
forgot a revocation`, the two that hold the reporting boundary when that write
fails, and `writes nothing when the adopted file is not behind this device`,
which holds the read path's no-write property everywhere else.
`tests/unit/agent-grant-revocation-restart.test.ts` runs a real `onload` against
a file carrying both the restored grant and its record, and asks a real gateway.
Union, normalization, the load-path filter, and the fail-closed reading of a
damaged record are covered in `tests/unit/project-weave-settings.test.ts`.
Removing the record, the merge, the load filter, or the fail-closed reading
fails these tests.
