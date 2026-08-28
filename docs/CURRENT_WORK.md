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

Three disjoint workstreams landed off `main`, then eight review rounds, all on agent
access. The client endpoint is derived from the vault id rather than read from a running
socket — folded to a token, since in full it could not bind on macOS — so a grant created
while the gateway is off still carries a launchable configuration; `README.md` documents
the repointing preview installs need.

Revocation across devices then had to be made true. A plugin read `data.json`
only at load, so a grant revoked elsewhere kept authorizing until Obsidian
restarted. `onExternalSettingsChange` adopts the rewritten file and reconciles
every setting carrying a side effect; every write shares that queue, reconciles
the file first, and stops at `onunload`.

Stopping there was silent: grant creation's rollback removed nothing and still
reported the grant as not kept, while it was stored and authorized with its
secret undelivered. `#commitSettings` throws rather than resolving, `onload`
stops before registering anything if the vault closed during its first write,
and the modal distinguishes a failed copy from a failed rollback; the
specification guarantees the reporting, not all-or-nothing delivery.

The queue orders every writer this plugin controls, not sync, so a revocation
landing between a local write's read and that write was overwritten and never
observed. `loadData`/`saveData` have no compare-and-swap, so revocation stopped
depending on a grant's absence:
[[Documents/Decisions/0035-record-grant-revocations-as-tombstones|ADR 0035]] is
accepted and built. Revoking records the id; every path that reads settings
drops a grant carrying a recorded one, load included, or a restart restores the
credential. Recorded ids merge as a union, adopting a file that omits one — or that still
carries an entry any of them withdrew — writes the union back, and a failed write costs
durability, not effect. A record present but unreadable serves no grant and keeps the
gateway off, rather than reading as nothing revoked; it also blocks first-load identity
initialization, so it cannot be overwritten before repair. Ids are kept permanently;
bounded retention needs device acknowledgements this plugin does not have.

That record binds only builds that read it, so
[[Documents/Decisions/0036-require-a-revocation-aware-build-on-every-gateway-device|ADR 0036]]
requires a recording build on every device hosting the gateway, withdrawing
ADR 0035's claim that an additive field made mixed versions safe: an older build
serves a restored grant until upgraded, and a `settingsVersion` bump would fail
it closed only by also letting it write defaults over the shared file.

`npm run check` passes in full on macOS: 505 tests and 99 script tests, none
skipped, plus the release verification.

## Next

Both agent grant tasks are `review`, waiting only on seeing the restored
narrow-width rule in Obsidian — the last of `Epic-agent-grant-lifecycle`'s gate.

[[Tasks/Run dogfood migration acceptance gate]] is the manual remainder of that
Epic: relocated documents, origin navigation, live refresh, workspace
restoration.

What still needs Obsidian: install the prerelease through BRAT into a clean
vault, run the companion against a real MCP client, and record it on
[[Tasks/Accept the BRAT preview and optional companion setup]]. A prerelease
configuration carries the old endpoint and must be repointed at what settings
now shows; the grant and its secret are unaffected.

## Loose ends

- The companion says to enable "Agent Access", the section heading rather than
  the toggle; see [[Tasks/Name the agent gateway toggle as the companion messages describe it]].
- ADR 0013 is still `proposed` and ADR 0015 carries a whole-supersession marker
  its superseder describes as partial; see [[Tasks/Reconcile two decision records whose frontmatter contradicts their bodies]].
- Accepted records still name `docs/spec/` in prose; immutable bodies, and every target resolves.
- Three of the six external-settings reconcilers and the bridge serialization
  guard reach services that exist only after `onload`, so no test covers them,
  though the stub workspace now answers enough for `onload` itself to run; see
  [[Tasks/Lift a testable workspace out of the plugin entry point]].
- Full mobile check 11a through 11g remains outstanding.
