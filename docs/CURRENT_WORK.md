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

A documentation-model overhaul, uncommitted, across 132 paths and five decision
records:

- **0021** — the MCP companion ships as an optional release asset, not a fourth
  plugin file. Predates this work; docs only, tooling not yet changed.
- **0022, 0023** — specifications are living and own current behavior; decision
  records are immutable once accepted. One owner per fact. `CURRENT_WORK.md`
  became this file, and the accumulated gate log moved to the archive.
- **0024** — roadmap order comes from milestone and rank, not filenames. Epic
  notes renamed and ranked; milestone `due_date` became optional.
- **0025** — specifications are named by subject, not numbered. 20 files
  renamed, ~190 references rewritten.

## Verified

`npm run check` passes end to end: 34 Vitest files with 368 tests, 36 script
tests, a clean dogfood diagnostics run over 79 notes, the production build, and
release-inventory verification. `agents doctor` resolves all 11 pointers.

## Next

1. **Bump the version before committing.** `milestone.due_date.missing` is no
   longer emitted and a required frontmatter field became optional — a
   compatibility surface moved while records stayed at 0.5.6. `version:check`
   only proves `package.json` and `manifest.json` agree, so it cannot catch this.
2. **Commit.** The prerelease work (0021) is separable; the rest interlocks,
   because 0025 supersedes part of 0022 and 0024's edits sit in files 0022
   rewrote. Two commits is the safe split.
3. Run Check 17, the desktop read-only agent gateway, and record the outcome on
   its task note and the shared-reads Epic.
4. [[Tasks/Gate documentation links and naming]] — the gate went green this
   session with a broken wikilink in the tree. Both large renames were verified
   by hand-written sweeps.

## Loose end

`docs/IMPLEMENTATION_ORDER.md` is a compatibility pointer with no inbound
references, and it now states two things that are false. It is a deletion
candidate awaiting a decision.
