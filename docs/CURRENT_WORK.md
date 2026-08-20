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

Six commits land together, all documentation and tooling; no product behavior
changes.

Two designs are landed and unbuilt. [ADR 0029](decisions/0029-hold-every-project-document-in-the-vault.md)
settles where every project document lives and drops relocation's dependency on
the plugin recognizing document kinds, and the organization Epics move from
10000 through 12000 to 3200 through 3600, in front of the features that would be
authored against them. [ADR 0030](decisions/0030-one-creation-pipeline-with-a-spec-per-note-kind.md)
settles that note creation becomes one pipeline with a declarative spec per kind
rather than the ladder it currently builds twice;
[[Epics/Epic-creation-pipeline]] carries it at rank 5500 with four tasks, and
[[Epics/Epic-long-project-org]] now declares it a prerequisite instead of
planning to build that ladder three more times.

The documentation gate gained three rules. It skips git-ignored files, so tool
output written into the dogfood vault is not judged as a project document. It
enforces decision record identity from the frontmatter: `type: decision` makes a
note a record, its `id` is the identifier, and the filename number and heading
are conveniences that must agree with it. Records are found by frontmatter
rather than by directory, which keeps the rule working once the log moves into
the vault. Two accepted records, `0017` and `0019`, declared no `id` at all and
now do, and `docs/decisions/README.md` owns numbering.

`0025` is accepted as historical rather than corrected: renumbering either
record would edit an accepted record and break the identifier it is cited by.
The pair is grandfathered, so a third record declaring `0025` still fails.

`npm run check` passes. Node script tests went 77 to 87 and vault diagnostics
report zero findings.

## Next

Relocation is next and unblocked: [[Epics/Epic-dogfood-vault-migration]] at rank
3200, six open tasks, none of which waits on a build.
[[Tasks/Move canonical docs into typed folders]] leads, then
[[Tasks/Move validation and historical material]],
[[Tasks/Migrate document links and tooling paths]] for the citation churn,
[[Tasks/Retire the old document directories]], and
[[Tasks/Run dogfood migration acceptance gate]]. The gate's `SPEC_PREFIX` is one
of the tooling paths that moves with it; decision records no longer need one.

What still needs Obsidian: install prerelease `0.6.1-beta.32112484849` through
BRAT into a clean vault, run the companion against a real MCP client, and record
the result on [[Tasks/Accept the BRAT preview and optional companion setup]].
The mis-numbered `0.7.0-beta` releases stay drafted rather than deleted, so BRAT
resolves the correct build and the action stays reversible. The grant dialog and
grant list have still not been seen at narrow width.

## Loose ends

- The companion requires the gateway to be reachable when the client launches
  it, so Obsidian must be running first. That ordering is undocumented; see
  [[Tasks/Document the companion launch ordering requirement]].
- The agent gateway socket takes its mode from the process umask, so on Linux
  and macOS another user may be able to open it. See
  [[Tasks/Restrict the agent gateway socket to its owner]].
- Grant creation still generates a secret from unvalidated paths; see
  [[Tasks/Restructure agent grant creation into validate-then-create]].
- Whether the grant secret is load-bearing at all is deliberately unsettled;
  see [[Tasks/Revisit whether the agent grant secret is load-bearing]].
- Whether creation form fields are declared alongside the kind spec is
  deliberately unsettled until two more kinds exist; see
  [[Tasks/Revisit declared creation fields after two more kinds]].
- [[Epics/Epic-agent-grant-lifecycle]] is still `planned` though five of its
  seven tasks are done and its work shipped; the status looks stale.
- `0017` is the only accepted record carrying no `area`.
- Full mobile check 11a through 11g remains outstanding.
