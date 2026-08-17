---
type: status
status: current
canonical: false
---

# Project Weave Current Work

## Purpose

The **mid-flight record**: what is in flight on this checkout, what is verified,
what is next. Rewritten at the end of every change, never appended to. A screen
at most; a stale section is a defect.

Verification and task-state history live in `git log`, which cannot drift from
the commits it describes. Outstanding work lives in `docs/project-vault/`.
Intended behavior lives in `docs/spec/`. See
[ADR 0023](decisions/0023-make-current-work-a-mid-flight-record.md); runs before
`ef1db32` are in [`archive/AUTOMATED-VERIFICATION-LOG.md`](archive/AUTOMATED-VERIFICATION-LOG.md).

## In flight

Nothing. The working tree is clean at 0.6.0.

The documentation-model overhaul landed as two commits on
`feat/multi-file-commit-coordinator`: the optional MCP companion distribution,
then the document model, roadmap ordering, and specification naming. Neither is
pushed or merged.

The branch name predates this work and describes none of it. Worth renaming or
merging before more lands on it.

## Verified

`npm run check` passes: 34 Vitest files with 368 tests, 36 script tests, a clean
dogfood diagnostics run over 79 notes, the production build, and release
inventory verification. `agents doctor` resolves all 11 pointers.

## Next

1. Run Check 17, the desktop read-only agent gateway, and record the outcome on
   its task note and the shared-reads Epic. It is the only task in `todo`.
2. [[Tasks/Gate documentation links and naming]] — nothing verifies that links
   resolve. The gate went green with a broken wikilink during the rename work,
   and both large renames were checked by hand-written sweeps.
3. [[Tasks/Separate plugin and companion release inventories]] — ADR 0021
   changed the specification; the build, export, and verification tooling still
   treats the companion as a fourth plugin file.

## Loose ends

- `docs/IMPLEMENTATION_ORDER.md` is a compatibility pointer with no inbound
  references, and it now states two things that are false. A deletion candidate
  awaiting a decision.
- Milestone `rank` is specified but unparsed, so roadmap order is authored
  rather than derived. [[Tasks/Add Epic roadmap graph fields]] closes it.
