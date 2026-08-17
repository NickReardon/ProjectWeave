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

Five changes land together: the documentation link and naming gate, one-surface
ownership for the workbench and workflow specifications, the MCP client
configuration documentation, indexed-project and folder suggestion for the agent
grant fields, and connect-time verification of the companion gateway handshake.

The complete `npm run check` gate passes on the integrated result. The companion
now carries protocol-level tests that drive it over stdio with fake credentials,
so its failure modes are covered without a vault, a grant, or a published
release.

## Next

Prerelease `0.7.0-beta.32068417927` is published from the merged source. Its
manifest names that version, the companion checksum verifies, and the plugin
bundle carries the lazy `require("node:net")` rather than the dynamic import
that failed the previous acceptance. Probing the published companion with fake
credentials returns the actionable gateway message and never answers
`initialize`.

What remains is the part that needs Obsidian: install the prerelease through
BRAT into a clean vault, run the companion against a real MCP client, and look
at the agent grant row at narrow width, since its responsive fix was reasoned
from the stylesheet rather than observed. Record the result on
[[Tasks/Accept the BRAT preview and optional companion setup]].

## Loose ends

- The companion now requires the gateway to be reachable when the client
  launches it, so Obsidian must be running first. That ordering is undocumented;
  see [[Tasks/Document the companion launch ordering requirement]].
- The agent gateway socket takes its mode from the process umask, so on Linux
  and macOS another user may be able to open it. See
  [[Tasks/Restrict the agent gateway socket to its owner]].
- Grant creation still generates a secret from unvalidated paths. The agreed
  flow validates first and keeps creation atomic; see
  [[Tasks/Restructure agent grant creation into validate-then-create]].
- Whether the grant secret is load-bearing at all is deliberately unsettled; see
  [[Tasks/Revisit whether the agent grant secret is load-bearing]].
- "Backlog" means both a stored status and a condition derived from sprint
  membership. They coincide only because sprints do not exist yet; collapsing
  them is folded into the planning-periods work.
- `docs/decisions/` contains two records numbered `0025`. Pre-existing, and not
  caught by the new naming gate, which checks specification filenames only.
- The public prerelease still contains the broken dynamic Node import; only a
  new prerelease can prove the fix end to end.
- Full mobile check 11a through 11g remains outstanding; the current evidence is
  a workbench and gateway-isolation smoke test in mobile emulation.
