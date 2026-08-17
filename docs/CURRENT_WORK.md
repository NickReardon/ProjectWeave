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

Nothing. Local and remote `main` now contain the separated plugin and companion
outputs, pinned GitHub-release updater, authenticated private-asset fix,
prerelease workflow, and recorded beta.1 proof.

Private prerelease `0.7.0-beta.1` still targets `06dbdd0`; the authenticated
updater fix landed afterward in `a4dc90f` and passed against those real assets.

## Verified

The complete post-merge `npm run check` passes on local `main`: 368 Vitest tests,
50 script tests, zero diagnostics across 80 dogfood notes, the production build,
and separate plugin and companion inventory verification.

## Next

1. Exercise the manual prerelease workflow from remote `main`, then test BRAT
   from a clean disposable vault and finish recording
   [[Tasks/Accept the BRAT preview and optional companion setup]].
2. Decide and record the public license, author/support metadata, and companion
   install location needed by
   [[Tasks/Prepare public preview metadata and optional agent setup]].

## Loose ends

- `0.7.0-beta.1` was published manually from a commit before the authenticated
  private-asset fix; the workflow itself remains unexercised.
- The repository is private, so beta.1 proves the authenticated path rather than
  the eventual public no-token installation experience.
- `docs/IMPLEMENTATION_ORDER.md` remains a compatibility pointer with no inbound
  references and is still a deletion candidate.
