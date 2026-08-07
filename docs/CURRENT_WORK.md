---
type: status
status: current
canonical: false
---

# Project Weave Current Work

## Purpose

This file is the append-only log of automated-verification evidence: what
`npm run check` and `npm run export` confirmed, against which source commit.
It exists because that evidence is a statement about commits that already
happened — turning it into mutable task state would destroy the property that
makes it evidence.

Everything this file used to also carry — operational state, outstanding
manual checks, known loose ends, and the next decision point — now lives in
the dogfood vault at `docs/project-vault/`, tracked as Project Weave's own
project and task notes. See
[ADR 0015](decisions/0015-track-project-state-in-weave-itself.md) for why, and
[ADR 0016](decisions/0016-dogfood-vault-location.md) for where. This file is
operational context, not a product contract; `docs/spec/` is the canonical
statement of intended behavior.

Append an entry here only for a completed `npm run check` or `npm run export`
run, naming the source commit it ran against. Do not record current-branch or
pre-merge state; those details belong in the pull request or task
conversation.

## Automated verification

`npm run check` passed on 2026-08-03 against source commit `45f3efd` using
Node.js 24.11.1:

- version records were synchronized at 0.3.0;
- Prettier, ESLint, and `tsc --noEmit` passed;
- 15 Vitest files passed with 135 tests;
- 9 Node script tests passed;
- the production bundle built successfully;
- the release inventory contained exactly `main.js`, `manifest.json`, and
  `styles.css`, with only the expected Obsidian runtime import.

`npm run export` then produced `export/project-weave` and the 52,574-byte
`export/project-weave-0.3.0.zip`. The configured export hook copied the three
runtime files into the disposable test vault. SHA-256 comparison confirmed
that every installed file matched the export, the installed manifest reported
0.3.0, and the vault's existing `data.json` remained present.

The subsequent release-workflow slice exercised `npm run test-vault:update`,
including its failure path. The task files passed a focused Prettier check, and
ESLint, `tsc --noEmit`, all 135 Vitest tests, all 10 Node script tests, the
production build, and release-inventory verification passed independently.
The aggregate check reached the format gate but was stopped by the unrelated
untracked `CLAUDE.md`; this is not recorded as a complete-gate pass.

On 2026-08-03, the merge-stable handoff workflow was verified against source
commit `018012b`. The current-work guard and focused Prettier check passed, as
did ESLint, `tsc --noEmit`, all 135 Vitest tests, all 13 Node script tests, the
production build, and release-inventory verification. The aggregate
`npm run check` passed its version and current-work gates, then stopped at the
same unrelated untracked `CLAUDE.md` formatting issue.

On 2026-08-03, `npm run check` passed in full against source commit `cd886ba`,
which adds task path and rank allocation: version and current-work gates,
Prettier, ESLint, `tsc --noEmit`, 17 Vitest files with 179 tests, 13 Node
script tests, the production build, and a release inventory of exactly
`main.js`, `manifest.json`, and `styles.css`. This is the first complete-gate
pass recorded here; the earlier runs stopped at the untracked `CLAUDE.md`,
which is now tracked and formatted.

Allocation is confirmed absent from `dist/main.js`, so it is tree-shaken out
and the running plugin is unchanged. The proposal service and its seven tests
were not modified by that slice.

On 2026-08-05, `npm run check` passed in full with UI rendering coverage and
the test-vault seeder in place, using Node.js 24.11.1: 23 Vitest files with 244
tests, 26 Node script tests, the production build, and the same three-file
release inventory. The `obsidian` package ships types only, so the suite
aliases it to a test double and installs Obsidian's `HTMLElement` helpers into
a `happy-dom` environment; `happy-dom` is a development dependency and the
shipped bundle is unchanged. Vitest, ESLint, and Prettier all skip `.claude`
and `test-vault`, so another branch's worktree or an installed build cannot be
counted as this tree's result.

On 2026-08-05, `npm run check` passed in full against source commit `b8eb7bc`
using Node.js 24.11.1: version records synchronized at 0.4.0, the current-work
gate, Prettier, ESLint, `tsc --noEmit`, 23 Vitest files with 249 tests, 28 Node
script tests, the production bundle, and a release inventory of exactly
`main.js`, `manifest.json`, and `styles.css`.

`npm run export` then produced `export/project-weave` and the 67,571-byte
`export/project-weave-0.4.0.zip`, and the configured export hook installed the
three runtime files into the disposable test vault. SHA-256 comparison
confirmed each installed file matched the export, and the installed manifest
reported 0.4.0. Reseeding that vault dated the fixture tasks correctly for the
day it ran; it reported, and left in place, several notes an earlier manual
session created.

On 2026-08-06, `npm run check` passed in full against source commit `8dcfcb0`
using Node.js 24.19.0 — the first complete-gate pass covering project creation,
the vault template catalog and chooser, and task categories: version records
synchronized at 0.4.1, the current-work gate, Prettier, ESLint, `tsc --noEmit`,
28 Vitest files with 324 tests, 28 Node script tests, the production bundle,
and a release inventory of exactly `main.js`, `manifest.json`, and
`styles.css`, with only the expected Obsidian runtime import.

`npm run export` then produced `export/project-weave` and the 71,902-byte
`export/project-weave-0.4.1.zip`, and `npm run test-vault:setup` seeded a fresh
`test-vault/` and installed the three runtime files. SHA-256 comparison
confirmed each installed file matched the export, and the installed manifest
reported 0.4.1. That vault was seeded clean, so unlike the previous one it
carries no notes left behind by an earlier manual session.

A review of the task-category slice against that build produced three findings,
all since addressed: the index-level category diagnostic was folded into an
entity record that the final assembly discards, so the code named a mechanism
that does not carry it; adding or removing a task category was the only
settings control that failed silently, because both handlers omitted the
try/catch every sibling has; and ADR 0014 never stated that the creation path
does not check the vocabulary. The first two were fixed, the third recorded in
the ADR. A further complete `npm run check` passed over all three.

The version then took the minor position for the three feature slices it had
been trailing. `npm run export` produced the 71,895-byte
`export/project-weave-0.5.0.zip`, and `npm run test-vault:update` installed it
into the same seeded vault: SHA-256 comparison confirmed each installed file
matched the export, and the installed manifest reported 0.5.0. That is the
build the outstanding manual checks run against.

Automated validation does not replace the manual Obsidian checks tracked as
tasks in `docs/project-vault/`. The
workbench view now has DOM coverage for the states ordinary use does not reach
— an empty scope, an unavailable restored selection and its recovery, no tasks
versus no filter matches, the 200-result cap in both task sections, paging past
it by page number, and the stale-last-good banner. The create-task modal has coverage for what it shows
before anything is written — the allocated path and rank, subfolder nesting,
the collision notice, a diagnostic instead of a filename — and for closing on a
successful commit against staying open and explaining a refusal. Those tests
drive the real preview service, so an allocation that is correct but never
reaches the user still fails; the commit runner is a double, so nothing writes.

That covers what the UI draws, not how Obsidian behaves: tab reuse, workspace
restoration, live vault events, layout at width, and mobile remain manual by
nature. The settings tab and the note diagnostic banner still have no DOM
coverage. The pure projection covers project isolation, default and terminal
statuses, blocked-task
discoverability, case-insensitive title/path search, all planning-metadata
filters, injected-date due states, deterministic ordering, and the 200-result
cap.
