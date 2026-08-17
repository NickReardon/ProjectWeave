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

The responsive agent-grant settings layout, desktop bridge loader, exact
plugin/companion version handshake, and release-bundle regression are
implemented. The complete `npm run check` gate passes with 369 Vitest tests and
59 script tests. Desktop gateway check 17 passes against a real MCP client;
mobile-emulation smoke evidence is recorded separately from full acceptance.

## Next

Publish a new prerelease from the accepted source, then rerun the clean BRAT and
matching-companion acceptance task against those release artifacts.

## Loose ends

- The public prerelease tested during acceptance still contains the broken
  dynamic Node import; only a new prerelease can prove the fix end to end.
- Full mobile check 11a through 11g remains outstanding; the current evidence is
  a successful workbench and gateway-isolation smoke test in mobile emulation.
