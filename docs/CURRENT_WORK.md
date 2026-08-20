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

A second design has landed, in front of the organization slice in cost terms
rather than in rank. Note creation is built twice — allocate, propose, preview,
once for tasks and once for projects — and
[ADR 0030](decisions/0030-one-creation-pipeline-with-a-spec-per-note-kind.md)
settles that it becomes one pipeline with a small declarative spec per kind.
Commit is already shared; the duplication is entirely upstream of it.

[[Epics/Epic-creation-pipeline]] carries it, ranked 5500, and pairs it with
lifting a testable workspace out of `src/main.ts` — the two meet because the
pipeline replaces the entry point's two creation openers. Four tasks:
[[Tasks/Extract agent grant minting and containment into a pure module]] first
because it is the one untested security boundary,
[[Tasks/Lift a testable workspace out of the plugin entry point]],
[[Tasks/Give template rung resolution one owner]], then
[[Tasks/Collapse the two creation ladders into one pipeline]].

[[Epics/Epic-long-project-org]] now declares this Epic as its prerequisite and
states its plan as one spec per kind rather than a ladder per kind, which is
what made this worth doing before it rather than after.

Organization remains the next goal and is unchanged: relocation
([[Epics/Epic-dogfood-vault-migration]]) leads at 3200, unblocked. No document
has moved yet, and no code has changed for either design. This is still
planning.

## Verified

The agent grant redesign is built and released: creation in a modal with
labeled fields, a settings entry that lists grants and what each permits, an
explicit read scope rather than one inferred from a blank field, local
resolution gating creation, and a complete `mcpServers` entry on the clipboard.
Grants remain immutable and the persisted shape is unchanged.

The documentation link gate skips git-ignored files.
[[Tasks/Gate documentation links and naming]] is done.

## Next

Two designs are now queued ahead of any code, and only one of them is ranked
first. Decide whether relocation or the grant containment extraction starts,
then branch.

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
- `docs/decisions/` contains two records numbered `0025` and no `0027`; see
  [[Tasks/Resolve the duplicate 0025 decision record numbers]], now part of the
  relocation Epic since moved decision records need unique identifiers.
- The roadmap table in [[Projects/Weave/Project]] is still hand-maintained.
  [[Tasks/Decide how the Epic roadmap is rendered]] settled that a Base renders
  it; building it has not happened, and this Epic's row was typed by hand.
- Full mobile check 11a through 11g remains outstanding.
