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

The duplicate `0025` decision-record id is corrected rather than grandfathered.
The record cited by number elsewhere kept `0025`; the uncited one — [ADR 0032,
formerly 0025](project-vault/Projects/Weave/Documents/Decisions/0032-merge-ready-current-work-and-evergreen-release-docs.md)
— was renumbered, its decision text untouched. `Documents/Decisions/README.md`
now permits that one narrow edit — a colliding `id`, never a record's content,
only when nothing cites it numerically — so `scripts/verify-doc-links.mjs`
could drop the hardcoded two-file exception it used to carry: decision-id
uniqueness now has no exceptions at all. [[Tasks/Resolve the duplicate 0025
decision record numbers]] records the corrected outcome.

The document reorganization landed as
[ADR 0029](project-vault/Projects/Weave/Documents/Decisions/0029-hold-every-project-document-in-the-vault.md):
every Project Weave document lives in the dogfood vault, `docs/spec/`,
`docs/decisions/`, `docs/development/`, and `docs/archive/` are gone, and
[[Epics/Epic-dogfood-vault-migration]] is done except its manual acceptance
check (see Next). [[Epics/Epic-documentation-authority]] now owns the
documentation work under
[ADR 0031](project-vault/Projects/Weave/Documents/Decisions/0031-give-the-documentation-system-an-owning-epic.md).

`npm run check` passes. Vault diagnostics report zero findings across 177 notes.

## Next

[[Tasks/Run dogfood migration acceptance gate]] is what is left of the Epic and
it is manual: browsing the relocated documents in Obsidian, origin navigation,
live refresh, and workspace restoration against the migrated vault.

What still needs Obsidian: install prerelease `0.6.1-beta.32112484849` through
BRAT into a clean vault, run the companion against a real MCP client, and record
the result on [[Tasks/Accept the BRAT preview and optional companion setup]].
The grant dialog and grant list have still not been seen at narrow width.

## Loose ends

- Accepted records still name `docs/spec/` in prose, and ADR 0026 renders a
  retired path as link text. Immutable bodies; every target resolves.
- The companion requires the gateway to be reachable when the client launches
  it, so Obsidian must be running first; see
  [[Tasks/Document the companion launch ordering requirement]].
- The agent gateway socket takes its mode from the process umask; see
  [[Tasks/Restrict the agent gateway socket to its owner]].
- Grant creation still generates a secret from unvalidated paths; see
  [[Tasks/Restructure agent grant creation into validate-then-create]].
- [[Epics/Epic-agent-grant-lifecycle]] is still `planned` though its work
  shipped; the status looks stale.
- `0017` is the only accepted record carrying no `area`.
- Full mobile check 11a through 11g remains outstanding.
