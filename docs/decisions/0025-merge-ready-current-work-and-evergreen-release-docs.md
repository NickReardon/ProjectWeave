---
type: decision
id: '0025'
area: development
status: accepted
canonical: false
affects: ['quality-and-release', 'development-procedures', 'current-work']
---

# ADR 0025: Require a clean handoff record at merge boundaries

- Status: accepted
- Date: 2026-08-17
- Owners: core

## Context

Branch work needs a useful handoff note, while merged history and evergreen
release instructions must not retain transient publication details. Existing
checks could validate either concern independently but did not enforce the
merge boundary or prevent concrete generated values from returning.

## Decision

Adopt the merge-boundary and evergreen-documentation policy described in
[the release procedure](../development/release.md). Historical task evidence
remains unchanged.

## Alternatives considered

- **Require `None.` on every branch check:** rejected because it prevents useful
  mid-flight notes during implementation.
- **Keep a rotating latest tag and checksum in evergreen docs:** rejected
  because generated values drift after each publication; GitHub Releases and
  the release-owned checksum file are the durable authority.

## Consequences

Draft pull requests and ordinary local checks can preserve mid-flight notes.
Merge boundaries provide a deterministic handoff, and documentation drift is
caught automatically without rewriting historical acceptance evidence.
