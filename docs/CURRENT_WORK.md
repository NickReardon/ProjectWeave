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

Three disjoint workstreams landed off `main`, then five review rounds. The grant
redesign was audited against the code its closed member tasks shipped: the
responsive rule had been deleted with the inline row it was written for, so
neither surface had narrow-width handling while two closed tasks claimed it.

One defect ran through the creation path. A grant created while the gateway was
off copied a blank `PROJECT_WEAVE_ENDPOINT`, which the companion refuses to
start on, and the configuration is delivered once; the endpoint is now derived
from the vault id. Gateway and creation are desktop-gated, since mobile could
mint a grant with no endpoint at all.

Keeping revoke available there had to then be made true. A plugin read
`data.json` only at load, so a grant revoked on one device kept authorizing on
another until Obsidian restarted. `onExternalSettingsChange` adopts the rewritten
file, reconciles every setting carrying a side effect, refuses a payload missing
the identity its grants are bound to, and never writes. Serializing it was not
enough: every local updater built its payload from the
grant list it read at call time, so a save begun first finished last and wrote a
withdrawn grant back. Every settings write now shares one queue with adoption and
reconciles the file first. That queue also ran past `onunload`; adoption, the
assignment, and runtime installation now abort.

The endpoint could not bind on macOS at all: `sun_path` stops at 104 bytes and
`TMPDIR` spends 49, so the vault id spelled in full came to 105. It is folded to
a 16-character FNV-1a token — not a digest, since `node:crypto` is absent on
mobile and the release gate refuses it — leaving 84. Four socket tests shared
the defect, which is why nothing caught it; a new test binds the derived
endpoint rather than reasoning about its length.

`npm run check` passes in full on macOS for the first time: 483 tests and 99
script tests, none skipped, plus the release verification.

## Next

Both agent grant tasks are `review`, waiting only on seeing the restored
narrow-width rule in Obsidian — the last thing between
`Epic-agent-grant-lifecycle` and its exit gate.

[[Tasks/Run dogfood migration acceptance gate]] is what is left of that Epic and
is manual: browsing relocated documents, origin navigation, live refresh, and
workspace restoration.

What still needs Obsidian: install prerelease `0.6.1-beta.32112484849` through
BRAT into a clean vault, run the companion against a real MCP client, and record
it on [[Tasks/Accept the BRAT preview and optional companion setup]]. A prerelease
client configuration carries the old endpoint and must be repointed at what
settings now shows; the grant and its secret are unaffected.

## Loose ends

- The companion says to enable "Agent Access", the section heading rather than
  the toggle; see
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
  and the unload abort is covered at the settings boundary; see
  [[Tasks/Lift a testable workspace out of the plugin entry point]].
- Full mobile check 11a through 11g remains outstanding.
