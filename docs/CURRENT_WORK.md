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
formerly
0025](project-vault/Projects/Weave/Documents/Decisions/0032-merge-ready-current-work-and-evergreen-release-docs.md) —
was renumbered, its decision text untouched.
`Documents/Decisions/README.md` now permits that one narrow edit — a colliding
`id`, never a record's content, only when nothing cites it numerically — and
`scripts/verify-doc-links.mjs` dropped the hardcoded two-file exception it used
to carry: decision-id uniqueness now has no exceptions at all. [[Tasks/Resolve
the duplicate 0025 decision record numbers]] records the corrected outcome.

The document reorganization landed, so every Project Weave document now lives
in the dogfood vault as
[ADR 0029](project-vault/Projects/Weave/Documents/Decisions/0029-hold-every-project-document-in-the-vault.md)
settled. Four directories stopped being document locations:

| Was                 | Is                          |
| ------------------- | --------------------------- |
| `docs/spec/`        | `Documents/Specifications/` |
| `docs/decisions/`   | `Documents/Decisions/`      |
| `docs/development/` | `Documents/References/`     |
| `docs/archive/`     | `Archive/Legacy/`           |

Four of [[Epics/Epic-dogfood-vault-migration]]'s tasks are done and only its
manual acceptance check remains.

No vault note reaches a document by climbing out of the vault any more; those
citations are ordinary wikilinks Obsidian resolves. Frontmatter was deliberately
not retyped — specifications keep `type: spec` and records keep `type: decision`
— because relocating a document does not depend on the plugin recognizing its
kind, and the link gate identifies a record by `type: decision`, so retyping
would have silently disabled the decision identity rule. Typing the documents
belongs to [[Epics/Epic-typed-document-catalog]].

The gate moved with the files: one tree rather than two namespaces, and a
wikilink quoted as code is no longer read as a link. Accepted records changed
only where a link target pointed at a retired path.

`npm run check` passes. Vault diagnostics report zero findings across 175
notes, up from 108 now that the documents sit inside the scanned vault.

The routing pointers are gone too, along with `docs/IMPLEMENTATION_ORDER.md`.
Nothing depended on them: repository traffic shows no visit to any document
path, and the two earlier relocations here left no pointers either.

The documentation work also gained the owner it never had.
[[Epics/Epic-documentation-authority]] at rank 3100 adopts six finished tasks
that carried the living-specification and immutable-record model with no `epic`
at all, plus the deferred question of merging specifications into fewer
subsystem documents.
[ADR 0031](project-vault/Projects/Weave/Documents/Decisions/0031-give-the-documentation-system-an-owning-epic.md)
records why a completed slice still needs an Epic: the Epic note is how a slice
is read, so one that does not exist reports as no work at all.

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
