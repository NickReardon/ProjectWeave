---
type: task
title: Settle the atomicity claim when grant rollback itself fails
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-agent-grant-lifecycle]]'
status: done
category: loose-end
priority: normal
rank: 5850
milestone: '[[Milestones/v1 release]]'
created: 2026-08-23
---

# Settle the atomicity claim when grant rollback itself fails

Grant creation and configuration delivery are atomic by rolling back: if the
clipboard write fails, the grant is removed. One step out, the guarantee was
weaker than
[[Documents/Specifications/agent-access-and-mcp|Agent access and MCP]] stated,
which claimed no reachable state has a grant existing without its secret
captured. The rollback is a save, and a save can fail.

Settled by softening the claim, the cheaper of the two options this note
offered, after review found a case where the exception was not merely reachable
but silent. `#commitSettings` abandoned its write once the plugin was unloaded
and resolved as though it had written, so a rollback running after unload
removed nothing while the modal reported that the grant was not kept — a stored,
authorized grant, described as gone, with its secret never delivered.

`#commitSettings` now throws instead of resolving, since after unload it can no
longer know that the settings it would derive a payload from still describe the
file. The modal distinguishes a failed copy from a failed rollback and names the
surviving grant with instructions to revoke it. The specification and the
modal's own contract both name the double-failure case where they state the
guarantee. `onload` tolerates the new rejection for the one write it makes,
rather than reporting a load failure when the vault closed during load.

Covered by `refuses a write it can no longer make rather than resolving as if it
had` in `tests/unit/external-settings-change.test.ts` and `says the grant
survived when the rollback save fails too` in
`tests/ui/agent-grant-creation-modal.test.ts`; both fail when the mechanism is
removed.
