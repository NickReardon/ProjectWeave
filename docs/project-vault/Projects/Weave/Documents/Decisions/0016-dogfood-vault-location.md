---
type: decision
id: '0016'
area: dogfooding
status: accepted
canonical: false
affects: ['0015']
---

# ADR 0016: Locate the dogfood vault at `docs/project-vault/`

- Status: accepted
- Date: 2026-08-07
- Owners: core

## Context

[ADR 0015](0015-track-project-state-in-weave-itself.md) proposes replacing
`docs/CURRENT_WORK.md`'s task-shaped content — manual checks, loose ends, the
next decision point — with Project Weave's own notes, and names three blocking
preconditions. It explicitly defers the third, where the vault lives, to its
own decision: `test-vault/` cannot hold it, because it is git-ignored and the
seeder resets it to the committed fixture on every run. Anything written there
by hand disappears the next time a manual check needs a clean vault.

The remaining candidates are a vault folder committed to this repository, or a
wholly separate vault repository. A separate repository adds a second clone, a
second remote, and a second place to keep in sync with this one for no
corresponding benefit — nothing about the vault's content needs an independent
release cycle, access model, or history from the plugin it dogfoods. A
committed folder inside this repository keeps the state next to the code it
describes and versions both together, at the cost of a vault's worth of
Markdown living alongside source.

## Decision

The dogfood vault is `docs/project-vault/`, committed to this repository.

- It is nested under `docs/`, alongside the other authoritative project
  documents (`docs/spec/`, `docs/decisions/`), rather than at the repository
  root — the root is reserved for source and tooling, not vault content.
- Its Markdown content — project notes, task notes, and any local templates —
  is git-tracked like any other document in this repository.
- `docs/project-vault/.obsidian/` (workspace layout, appearance, installed
  community plugins) is **not** committed. It is local machine state, no more
  portable than any other editor's window layout, and would drift immediately
  between contributors. It is added to `.gitignore` alongside the existing
  `test-vault/` and `.project-weave-test-vault` entries.
- A developer indexes `docs/project-vault/` as a project root in their own
  local Obsidian, the same way they already index `test-vault/` for manual
  checks, and installs the built plugin into it the same way.

This settles ADR 0015's precondition 3. Preconditions 1 and 2 — the typed
mutation/proposal kernel and typed task editing — have not landed. The
migration this ADR unblocks proceeds anyway: task notes are created through
Project Weave's existing create-only write path, and status transitions are
hand-edited frontmatter until typed editing exists. This is a deliberate,
temporary cost, not a reproduction of the maintenance burden ADR 0015 removes:
`CURRENT_WORK.md` also required hand-editing prose to record the same
information, in a form nothing could query. Automating status transitions away
from hand-editing is tracked as follow-up work in ADR 0015.

## Alternatives considered

- **A separate vault repository:** rejected. It buys independent versioning
  and access control that nothing about this vault's content needs, at the
  cost of a second clone and a second place for state to drift out of sync
  with the plugin it tracks.
- **`test-vault/`:** rejected by ADR 0015 itself — git-ignored and reset by
  the seeder, so it cannot hold state that must survive a manual-check
  session.
- **Repository root** (e.g. `project-vault/`): rejected in favor of nesting
  under `docs/`, to keep the root reserved for source and tooling and group
  the vault with the other documents that describe the project's own state.
- **Committing `.obsidian/`:** rejected. Workspace and appearance state is
  per-machine and would conflict or drift between contributors with no
  benefit to the vault's content.

## Consequences

- Positive: the migration ADR 0015 proposes can proceed now instead of
  waiting on the typed-editing preconditions, using the existing create-only
  write path plus documented hand-editing as an interim step.
- Positive: the vault versions with the code that reads it — a change to task
  frontmatter shape or a diagnostic code is visible in the same history as the
  vault content it affects.
- Negative: `docs/project-vault/` adds a growing set of Markdown files to a
  source repository, distinct in kind from everything else under `docs/`.
  Anyone browsing the repository without Obsidian reads a folder of notes
  rather than a page.
- Negative: hand-editing task status until typed editing lands means the
  dogfood vault's data does not yet exercise the write path it is meant to
  validate for status changes — only for creation. This gap closes when ADR
  0015's preconditions 1 and 2 land.
- Follow-up work: once typed task editing exists, replace the hand-edited
  status transitions with real writes through Project Weave, and revisit
  whether ADR 0015 should move from `proposed` to `accepted` at that point.
