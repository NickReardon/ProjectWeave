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

Three disjoint workstreams landed on a branch off `main`, then a review round.

The agent grant redesign was audited criterion by criterion against the code
its already-closed member tasks shipped. Most held. What did not: the
responsive rule for the grant surface was deleted along with the inline row it
was written for, and replaced by a comment claiming a stacking no rule
performed. `.setting-item` is a flex row at every desktop width, so neither
grant surface had narrow-width handling while two closed tasks claimed it. The
rule is restored and the rows carry the class it targets.

Three tests passed whether or not their behavior existed, and one case could
not even be expressed: the harness folded an explicit `null` endpoint back into
the enabled default. Each new test was verified by breaking the behavior.

The decision log gained two records. ADR 0033 partially supersedes the one
sentence in ADR 0030 that had the premise backwards. ADR 0034 settles the grant
secret, decidable once the owner-only socket bind removed the premise it was
parked on: the secret stays, because the bind is POSIX-only and nothing in the
Node path binding the Windows pipe can install an owner-only descriptor, and
file modes are per user while grant scope is per grant. A partially superseded
record points nowhere, so the README gained the index of those pointers, and
the `0017` `area` question is settled the other way.

`README.md` gained one `### Starting order and troubleshooting` subsection,
keyed to strings read out of the companion.

Review then found a grant created while the gateway is off copied a blank
`PROJECT_WEAVE_ENDPOINT`, which the companion refuses to start on — and the
configuration is delivered once, so the only repair was revoking the grant. The
endpoint is a pure function of the vault id and is now derived rather than read
from the idle bridge. Both new records also carried decision ids in `affects`,
where the field means specifications, copied from ADR 0015's precedent.

`npm run check` passes: 456 tests and 99 script tests, one skipped. The skip is
the socket-mode assertion, which needs POSIX mode bits and runs in CI on
`ubuntu-latest` rather than on this machine.

## Next

Both agent grant tasks are `review` rather than `done`, waiting only on seeing
the restored narrow-width rule in Obsidian. That is now the cheapest thing
standing between `Epic-agent-grant-lifecycle` and its exit gate, every other
item of which is built and covered.

[[Tasks/Run dogfood migration acceptance gate]] is what is left of the dogfood
Epic and it is manual: browsing the relocated documents in Obsidian, origin
navigation, live refresh, and workspace restoration.

What still needs Obsidian: install prerelease `0.6.1-beta.32112484849` through
BRAT into a clean vault, run the companion against a real MCP client, and
record the result on
[[Tasks/Accept the BRAT preview and optional companion setup]].

## Loose ends

- Two closed tasks asserted a narrow-width criterion that no rule satisfied.
  Neither recorded a verification, which is how it went unnoticed; treat a
  layout criterion as unmet until it has been seen.
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
- Full mobile check 11a through 11g remains outstanding.
