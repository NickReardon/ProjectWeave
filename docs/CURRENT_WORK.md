---
type: status
status: current
canonical: false
---

# Project Weave Current Work

## Purpose

The **mid-flight record**: what is in flight on this checkout, what is
verified, and what is next. Rewrite it rather than appending history.

## In flight

None.

## Verified

Four backlog items landed together on a branch off `main`, each recorded on
its own task note.

The agent grant containment rule moved out of the plugin class into a pure
`src/application/agent-grants.ts`, and the gateway's near-duplicate copy was
deleted so mint-time and request-time containment cannot drift. Lifting it
exposed a hole both former copies shared: prefix matching cannot see through
traversal, so `Projects/Game/../Other` starts with `Projects/Game/` and was
accepted as contained. `isWithinContentRoot` now refuses any `.` or `..`
segment rather than resolving it. Nothing reachable changes, because
`normalizeVaultFolderPath` rejects those segments first; the guard is what
keeps the rule true for a caller that skips normalization.

The agent gateway's Unix-domain socket is now bound owner-only, by tightening
`process.umask` across the synchronous span that binds it. The span has to
stay synchronous: umask is process-global, so holding it across an await
would apply it to unrelated files Obsidian wrote while the promise was
pending. Windows named pipes are unaffected.

Template rung resolution has one owner. `TemplateResolver` is generalized
over a kind and `ProjectCreationProposalService`'s private reimplementation
is gone. This reversed the premise it was scoped from: project creation
already failed closed, while **task** creation read an ambiguous key through
`VaultTemplateLibrary.load()`, which reports a case-collision as absent
rather than broken, and silently returned the packaged template. Both kinds
now fail closed identically.

`ObsidianVaultReader.setProjectRoots` was removed as unreachable.
[[Tasks/Give templateClockFromLocalDate a caller]] closed without a change —
`src/main.ts` had already grown two call sites. `Epic-agent-grant-lifecycle`
is `active` rather than `planned`.

`npm run check` passes on the combined batch: 438 tests and 99 script tests,
one skipped. The skip is the new socket-mode assertion, which needs POSIX
mode bits and runs in CI on `ubuntu-latest` rather than on this machine.

## Next

The agent grant redesign is the coherent next slice, and its three tasks are
meant to land as one change rather than three passes over the same control:
[[Tasks/Make the agent grant form explain what it asks for]] owns it, with
[[Tasks/Restructure agent grant creation into validate-then-create]] and the
already-done suggester work underneath it.

[[Tasks/Run dogfood migration acceptance gate]] is what is left of the
dogfood Epic and it is manual: browsing the relocated documents in Obsidian,
origin navigation, live refresh, and workspace restoration.

What still needs Obsidian: install prerelease `0.6.1-beta.32112484849`
through BRAT into a clean vault, run the companion against a real MCP client,
and record the result on
[[Tasks/Accept the BRAT preview and optional companion setup]]. The grant
dialog and grant list have still not been seen at narrow width.

## Loose ends

- ADR 0030 asserts that only the task path implemented ADR 0013's
  fail-closed rule fully. The opposite was true. The record is accepted and
  so immutable; see
  [[Tasks/Supersede the ADR 0030 claim about which path skipped the rung]].
- Accepted records still name `docs/spec/` in prose, and ADR 0026 renders a
  retired path as link text. Immutable bodies; every target resolves.
- The companion requires the gateway to be reachable when the client launches
  it, so Obsidian must be running first; see
  [[Tasks/Document the companion launch ordering requirement]].
- Grant creation still generates a secret from unvalidated paths; see
  [[Tasks/Restructure agent grant creation into validate-then-create]].
- `0017` is the only accepted record carrying no `area`.
- Full mobile check 11a through 11g remains outstanding.
