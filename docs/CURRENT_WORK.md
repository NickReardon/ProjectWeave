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

Three disjoint workstreams landed off `main`, then five review rounds.

The grant redesign was audited criterion by criterion against the code its
already-closed member tasks shipped. The responsive rule had been deleted with
the inline row it was written for, so neither surface had narrow-width handling
while two closed tasks claimed it; it is restored.

One defect ran through the creation path. A grant created while the gateway was
off copied a blank `PROJECT_WEAVE_ENDPOINT`, which the companion refuses to
start on, and the configuration is delivered once. The endpoint is a pure
function of the vault id and is now derived rather than read from the idle
bridge. Gateway and creation are also desktop-gated now, since mobile could
mint a grant with no endpoint at all.

Keeping revoke available there had to then be made true. A plugin read
`data.json` only at load, so a grant revoked on one device kept authorizing on
another until Obsidian restarted. `onExternalSettingsChange` adopts the
rewritten file and reconciles every setting carrying a side effect; it refuses
a payload missing the identity its grants are bound to, and never writes.
Serializing those notifications was not enough alone: every local updater built
its payload from the grant list it read at call time, so a save begun before a
revocation was adopted finished after it and wrote the withdrawn grant back.
All settings writes now share one queue with adoption and reconcile the file
before saving. That queue also ran past `onunload`, where an outstanding read could
install a coordinator nothing would dispose; adoption, the settings
assignment, and runtime installation all abort once unloaded.

ADR 0033 partially supersedes the one sentence in ADR 0030 that had the premise
backwards; ADR 0034 keeps the grant secret, since file modes are per user while
grant scope is per grant. The README gained the partial-supersession index and
a starting-order and troubleshooting subsection keyed to companion strings.

`npm run check` passes except the four Unix-domain socket tests, which cannot
bind in this sandbox (`EINVAL`): 477 of 479 tests and 97 of 99 script tests.
Those four, and the socket-mode assertion skipped here, run in CI on Linux.

## Next

Both agent grant tasks are `review` rather than `done`, waiting only on seeing
the restored narrow-width rule in Obsidian — the last thing between
`Epic-agent-grant-lifecycle` and its exit gate.

[[Tasks/Run dogfood migration acceptance gate]] is what is left of the dogfood
Epic and it is manual: browsing the relocated documents, origin navigation,
live refresh, and workspace restoration.

What still needs Obsidian: install prerelease `0.6.1-beta.32112484849` through
BRAT into a clean vault, run the companion against a real MCP client, and record
it on [[Tasks/Accept the BRAT preview and optional companion setup]].

## Loose ends

- The companion tells the user to enable "Agent Access", which is the section
  heading, not the toggle; see
  [[Tasks/Name the agent gateway toggle as the companion messages describe it]].
- The atomicity claim is absolute but has a reachable exception when rollback
  itself fails; see
  [[Tasks/Settle the atomicity claim when grant rollback itself fails]].
- ADR 0013 is still `proposed` and ADR 0015 carries a whole-supersession marker
  its superseder describes as partial; see
  [[Tasks/Reconcile two decision records whose frontmatter contradicts their bodies]].
- Accepted records still name `docs/spec/` in prose, and ADR 0026 renders a
  retired path as link text. Immutable bodies; every target resolves.
- A payload with no vault id is refused rather than repaired, so the id must be
  re-established after a restart; the alternative put a write on a read path.
- Three of the six external-settings reconcilers and the bridge serialization
  guard reach services that exist only after `onload`, so no test covers them,
  and the unload abort is covered at the settings boundary for the same reason;
  see [[Tasks/Lift a testable workspace out of the plugin entry point]].
- Full mobile check 11a through 11g remains outstanding.
