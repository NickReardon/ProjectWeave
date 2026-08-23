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

Three disjoint workstreams landed on a branch off `main`, each recorded on its
own task notes.

The agent grant redesign was audited criterion by criterion against the code
that the already-closed member tasks shipped. Most of it held. What did not:
the responsive rule for the grant surface was deleted along with the inline row
it was written for, and replaced by a comment claiming the modal stacks label
and control per field — which no rule performed. Obsidian's `.setting-item` is
a flex row at every desktop width, so the dialog and the grant list had no
narrow-width handling at all while two closed tasks claimed the criterion. The
rule is restored and the rows carry the class the stylesheet targets.

Three tests were passing whether or not the behavior existed, and the case for
resolving with the gateway disabled could not even be expressed: the harness
folded an explicit `null` endpoint back into the enabled default. Each new test
was verified by breaking the behavior and watching it fail.

The decision log gained two records. ADR 0033 partially supersedes the one
sentence in ADR 0030 that had the premise backwards: project creation already
failed closed, while task creation read an ambiguous key as absent. ADR 0034
settles the grant secret, which became decidable when the owner-only socket
bind landed and removed the premise the question was parked on. The secret
stays: a Windows named pipe has no mode bits, so the fix is POSIX-only, and
file modes are per user while grant scope is per grant.

Because a partially superseded record is not edited, it points nowhere, so the
README gained the index of those pointers. The `0017` `area` question is
settled the other way — frontmatter is part of the record, nothing reads
`area`, and adding it would be a violation that fixes nothing.

`README.md` gained one `### Starting order and troubleshooting` subsection with
the client configuration material, keyed to strings read out of the companion.

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
