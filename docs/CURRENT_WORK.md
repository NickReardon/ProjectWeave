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

`feat/github-prerelease-experience` is pushed with the separated three-file
Obsidian plugin and optional companion outputs, pinned release updater, and
manual BRAT prerelease workflow. Private prerelease `0.7.0-beta.1` targets
`06dbdd0`. Its first updater trial proved the destination stays untouched on a
download failure and exposed that private assets require GitHub's authenticated
release API. The fix is committed and pushed as `a4dc90f`; its real retry
installed the three beta.1 assets into the disposable vault and preserved
`data.json`.

## Verified

`npm run check` passes with separate plugin and companion inventory checks. The
configured test-vault export installs only `main.js`, `manifest.json`, and
`styles.css`; automated updater coverage proves failed downloads leave the
target untouched and successful updates preserve `data.json`.

## Next

1. Decide and record the public license, author/support metadata, and companion
   install location needed by
   [[Tasks/Prepare public preview metadata and optional agent setup]].
2. Merge the workflow-bearing branch when authorized, then exercise the manual
   prerelease workflow from the default branch.
3. Exercise BRAT from a clean disposable vault, then finish recording
   [[Tasks/Accept the BRAT preview and optional companion setup]].

## Loose ends

- `0.7.0-beta.1` was published manually because the prerelease workflow is not
  yet present on the default branch; the workflow itself remains unexercised.
- `docs/IMPLEMENTATION_ORDER.md` remains a compatibility pointer with no inbound
  references and is still a deletion candidate.
