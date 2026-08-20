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

Two designs are landed and unbuilt, and the first piece of one of them has now
shipped.

[[Epics/Epic-creation-pipeline]] is new, ranked 5500. Note creation is built
twice — allocate, propose, preview, once per kind — and
[ADR 0030](decisions/0030-one-creation-pipeline-with-a-spec-per-note-kind.md)
settles that it becomes one pipeline with a declarative spec per kind. Commit is
already shared, so the duplication is upstream of it. The Epic pairs that with
lifting a testable workspace out of `src/main.ts`. Four tasks, led by
[[Tasks/Extract agent grant minting and containment into a pure module]]
because it is the one untested security boundary.
[[Epics/Epic-long-project-org]] now declares this Epic as its prerequisite.

Organization remains the next goal, and relocation
([[Epics/Epic-dogfood-vault-migration]]) leads at 3200, unblocked. No document
has moved yet, but one of its blockers is gone: decision record numbering is
settled, which moved records need before they can be relocated with unique
identifiers.

## Verified

`0025` is accepted as historical rather than corrected: renumbering either
record would edit an accepted record and break the identifier it is cited by.
`docs/decisions/README.md` owns numbering — never reassigned, never reused, gaps
like the missing `0027` not defects — and `npm run docs:links` now rejects a new
duplicate, grandfathering the pair by filename so a third `0025` still fails.
[[Tasks/Resolve the duplicate 0025 decision record numbers]] is done.

The agent grant redesign is built and released: creation in a modal with
labeled fields, a settings entry that lists grants and what each permits, an
explicit read scope rather than one inferred from a blank field, local
resolution gating creation, and a complete `mcpServers` entry on the clipboard.
Grants remain immutable and the persisted shape is unchanged.

## Next

Relocation is ranked first and is now unblocked in full:
[[Tasks/Move canonical docs into typed folders]] moves `docs/spec/` and
`docs/decisions/` into the vault, and
[[Tasks/Migrate document links and tooling paths]] owns the citation churn that
follows. The gate's `SPEC_PREFIX` and `DECISION_PREFIX` are two of the tooling
paths that move with it.

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
- "Backlog" means both a stored status and a condition derived from sprint
  membership. They coincide only because sprints do not exist yet.
- The roadmap table in [[Projects/Weave/Project]] is still hand-maintained.
  [[Tasks/Decide how the Epic roadmap is rendered]] settled that a Base renders
  it; building it has not happened.
- Full mobile check 11a through 11g remains outstanding.
