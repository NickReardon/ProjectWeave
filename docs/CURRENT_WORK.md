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

[[Tasks/Move canonical docs into typed folders]],
[[Tasks/Move validation and historical material]], and
[[Tasks/Migrate document links and tooling paths]] are done.
[[Epics/Epic-dogfood-vault-migration]] is `active` rather than complete because
two of its tasks remain.

No vault note reaches a document by climbing out of the vault any more; those
citations are ordinary wikilinks Obsidian resolves. Frontmatter was deliberately
not retyped — specifications keep `type: spec` and records keep `type: decision`
— because relocating a document does not depend on the plugin recognizing its
kind, and the link gate identifies a record by `type: decision`, so retyping
would have silently disabled the decision identity rule. Typing the documents
belongs to [[Epics/Epic-typed-document-catalog]].

The gate moved with the files. `verify-doc-links.mjs` now holds one tree rather
than two namespaces, and skips wikilinks quoted as code, which specifications
use to show a reader what a link looks like. `verify-evergreen-docs.mjs`
follows `release.md`. Accepted records changed only where a link target pointed
at a retired path; no record body was reworded.

`npm run check` passes. Vault diagnostics report zero findings across 175
notes, up from 108 now that the documents sit inside the scanned vault.

## Next

Two tasks close the Epic. [[Tasks/Retire the old document directories]] removes
the routing pointers left at `docs/spec/` and `docs/decisions/`, kept separate
on purpose so the pointers outlive the move that created them.
[[Tasks/Run dogfood migration acceptance gate]] is the manual half: browsing
the relocated documents in Obsidian, origin navigation, live refresh, and
workspace restoration against the migrated vault.

What still needs Obsidian: install prerelease `0.6.1-beta.32112484849` through
BRAT into a clean vault, run the companion against a real MCP client, and record
the result on [[Tasks/Accept the BRAT preview and optional companion setup]].
The grant dialog and grant list have still not been seen at narrow width.

## Loose ends

- `docs/IMPLEMENTATION_ORDER.md` is archived material still outside the vault.
  It survives as a compatibility pointer, so it belongs with
  [[Tasks/Retire the old document directories]], not with the move.
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
