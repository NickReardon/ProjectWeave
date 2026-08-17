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

`feat/github-prerelease-experience` carries the separated three-file Obsidian
plugin and optional companion outputs, a pinned GitHub-release updater for an
exact environment-configured plugin folder, and the manual BRAT prerelease
workflow. It is not pushed or merged. No GitHub tag or release exists for this
work.

## Verified

`npm run check` passes with separate plugin and companion inventory checks. The
configured test-vault export installs only `main.js`, `manifest.json`, and
`styles.css`; automated updater coverage proves failed downloads leave the
target untouched and successful updates preserve `data.json`.

## Next

1. Decide and record the public license, author/support metadata, and companion
   install location needed by
   [[Tasks/Prepare public preview metadata and optional agent setup]].
2. Push this branch and run one explicitly authorized disposable prerelease to
   finish [[Tasks/Automate the BRAT prerelease channel]].
3. Use that real release to exercise BRAT and the pinned updater from clean
   disposable vaults, then record
   [[Tasks/Accept the BRAT preview and optional companion setup]].

## Loose ends

- The preview workflow exists locally but is intentionally unproven against a
  real GitHub release because publishing needs an explicit release decision.
- `docs/IMPLEMENTATION_ORDER.md` remains a compatibility pointer with no inbound
  references and is still a deletion candidate.
