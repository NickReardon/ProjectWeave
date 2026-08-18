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

A design correction, not an implementation: every Project Weave document
belongs in the dogfood vault, and the staged migration that already said so
named the wrong destination for specifications.

[ADR 0029](decisions/0029-hold-every-project-document-in-the-vault.md) records
it. Living specifications move to `Documents/Specifications/` under a
project-defined `specification` kind, not to `Documents/Design/`, which
[ADR 0022](decisions/0022-separate-living-specifications-from-point-in-time-decision-records.md)
defines as the home of point-in-time proposals. Decision records move to
`Documents/Decisions/`. The owning specification and
[[Tasks/Move canonical docs into typed folders]] carry the corrected
destinations.

The same record drops the dogfood migration Epic's dependency on the typed
document catalog. That Epic decides whether the plugin recognizes a document's
kind, not where the document lives, and typed documents are warning-only.

No document has moved yet.

## Verified

The agent grant redesign is built and released. Creation happens in a modal
with labeled fields, the settings entry lists grants and what each permits,
read scope is an explicit choice rather than an inference from a blank field,
local resolution gates creation, and the clipboard carries a complete
`mcpServers` entry with a bracketed placeholder for the companion path. Grants
remain immutable and the persisted shape is unchanged.

The documentation link gate now skips git-ignored files. BRAT writes an update
log of `[[date]]` entries into whatever vault it is installed in, which is tool
output rather than a project document; it is git-ignored and the gate follows
git's answer.

## Next

Prerelease `0.6.1-beta.32112484849` is the only published release. The
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
- Grant creation still generates a secret from unvalidated paths. The agreed
  flow validates first and keeps creation atomic; see
  [[Tasks/Restructure agent grant creation into validate-then-create]].
- Whether the grant secret is load-bearing at all is deliberately unsettled;
  see [[Tasks/Revisit whether the agent grant secret is load-bearing]].
- "Backlog" means both a stored status and a condition derived from sprint
  membership. They coincide only because sprints do not exist yet; collapsing
  them is folded into the planning-periods work.
- `docs/decisions/` contains two records numbered `0025` and no `0027`. The
  naming gate checks specification filenames only.
- Full mobile check 11a through 11g remains outstanding; the current evidence
  is a workbench and gateway-isolation smoke test in mobile emulation.
