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

Organization is the next goal, and the roadmap now says so. Three Epics carry
it: [[Epics/Epic-dogfood-vault-migration]] relocates every document into the
vault, [[Epics/Epic-project-structure-and-contracts]] lets a project describe
its own folders and contracts, and [[Epics/Epic-typed-document-catalog]] makes
the plugin recognize the documents in them. They ranked 10000 through 12000 —
last in the milestone — which put Project Weave's own structure behind every
feature that would be authored against it. They now rank 3200 through 3600,
directly after the active Epics.

Relocation leads because it is unblocked. Its dependency on the typed document
catalog was dropped by
[ADR 0029](decisions/0029-hold-every-project-document-in-the-vault.md), and its
dependency on project structure went with
[[Tasks/Create the dogfood document tree]], which configures a folder map and
belongs to that Epic. What is left is moving files, migrating the links and
tooling paths that point at them, and proving the result — none of which waits
on a build.

Two tasks were missing and now exist:
[[Tasks/Migrate document links and tooling paths]] owns the citation churn so
the move is not judged by it, and
[[Tasks/Retire the old document directories]] removes the routing pointers once
nothing depends on them.

No document has moved yet. This is planning, not migration.

## Verified

The agent grant redesign is built and released: creation in a modal with
labeled fields, a settings entry that lists grants and what each permits, an
explicit read scope rather than one inferred from a blank field, local
resolution gating creation, and a complete `mcpServers` entry on the clipboard.
Grants remain immutable and the persisted shape is unchanged.

The documentation link gate skips git-ignored files. BRAT writes an update log
of `[[date]]` entries into whatever vault it is installed in, which is tool
output rather than a project document.
[[Tasks/Gate documentation links and naming]] is done.

## Next

Prerelease `0.6.1-beta.32112484849` is the only published release; the
mis-numbered `0.7.0-beta` releases are drafted rather than deleted, so BRAT
resolves the correct build and the action stays reversible.

What remains needs Obsidian: install that prerelease through BRAT into a clean
vault, run the companion against a real MCP client, and record the result on
[[Tasks/Accept the BRAT preview and optional companion setup]]. The grant
dialog and grant list have still not been seen at narrow width.

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
- "Backlog" means both a stored status and a condition derived from sprint
  membership. They coincide only because sprints do not exist yet.
- `docs/decisions/` contains two records numbered `0025` and no `0027`; see
  [[Tasks/Resolve the duplicate 0025 decision record numbers]], now part of the
  relocation Epic since moved decision records need unique identifiers.
- The roadmap table in [[Projects/Weave/Project]] is still hand-maintained.
  [[Tasks/Decide how the Epic roadmap is rendered]] settled that a Base renders
  it; building it has not happened, and this re-ranking was retyped by hand.
- Full mobile check 11a through 11g remains outstanding.
