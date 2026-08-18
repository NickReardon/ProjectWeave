---
type: decision
id: '0029'
area: dogfooding
status: accepted
canonical: false
affects: ['0016', '0019', '0022']
---

# ADR 0029: Hold every project document in the dogfood vault

- Status: accepted
- Date: 2026-08-18
- Owners: core

Once this record is accepted, its body is not edited. A decision that changes
is superseded by a new record; see [`README.md`](README.md).

## Context

Project Weave's own documents are split. Work notes — the project, its Epics,
tasks, and milestones — live in the dogfood vault at `docs/project-vault/`,
while the living specifications and the decision log live beside it at
`docs/spec/` and `docs/decisions/`. [ADR 0016](0016-dogfood-vault-location.md)
placed the vault "alongside the other authoritative project documents", which
described the split without settling whether it should persist.

The split is visible in the documents themselves. A vault note that cites a
specification has to climb out of the vault to reach it, producing links such
as `../../../../spec/note-structure-and-dogfood-vault.md` in Epic notes. Those
are ordinary relative paths rather than vault links, so Obsidian cannot follow
them as it follows every other link in the vault, and the documentation link
gate has to treat the two trees as separate namespaces to check them at all.

[Note structure and dogfood vault](../spec/note-structure-and-dogfood-vault.md)
already stages a migration that moves specifications and ADRs into typed
document folders. Two things about that plan are now wrong.

First, it names `Documents/Design` as the destination for specifications.
[ADR 0022](0022-separate-living-specifications-from-point-in-time-decision-records.md)
was written afterwards and defines a design document as a proposal — the input
to a change, which stops being consulted once the work lands. Filing the living
behavior contract in the folder reserved for point-in-time proposals would
recreate, in the vault, the exact inversion ADR 0022 exists to end.

Second, the migration sits behind two unbuilt Epics because the vault tree it
targets is one the plugin does not yet parse. That dependency is real for
recognizing typed documents, and not real for the location of the files.

## Decision

Every Project Weave document lives in the dogfood vault. `docs/spec/` and
`docs/decisions/` stop being document locations.

- **Living specifications move to `Documents/Specifications/`**, under a
  project-defined document kind `specification`, not to `Documents/Design/`.
  The folder is named for the lifecycle its contents have, which is what
  ADR 0022 made the deciding property.
- **Decision records move to `Documents/Decisions/`**, the built-in kind that
  already carries a controlled status and a monotonic identifier.
- **Design notes keep `Documents/Design/`** and keep meaning proposals.
- **Relocating a document does not depend on the plugin parsing it.** Typed
  documents are warning-only and untyped Markdown is unaffected, so the files
  move under the current plugin, and recognizing them stays with the typed
  document catalog.
- **Authority does not move with the files.** A specification is canonical
  because it is living and owns its facts, not because of the folder it sits
  in. The ownership rules in ADR 0022 are unchanged by this record.

## Alternatives considered

- **Leave specifications at `docs/spec/`, move only the ADRs:** rejected. It
  keeps two document trees and the escaping relative links, and it splits the
  behavior contract from the work notes that cite it — the condition that
  prompted this record.
- **File specifications under `Documents/References/`:** rejected. References
  are supporting material consulted from outside; specifications are the
  contract the project is measured against, and burying them among references
  understates that.
- **Reuse `Documents/Design/` as the migration currently says:** rejected as
  contradicting ADR 0022, which defines design documents as proposals.
- **Wait for the typed document catalog and project folder contracts:**
  rejected as sequencing. Those Epics decide whether the plugin understands the
  documents, not where they live, and holding the move behind them keeps the
  escaping links for no gain.

## Consequences

- Positive: one document tree, so every citation between a work note and a
  specification is an ordinary vault link that Obsidian resolves.
- Positive: the dogfood vault finally exercises the document model this project
  specifies, which is the point of dogfooding it.
- Negative: a large mechanical change. Every inbound path — the routers, the
  README, the link gate's prefixes, and the Epic citations — moves at once, and
  the diff is dominated by path churn rather than meaning.
- Negative: `docs/spec/NN` citation habits and any external bookmark to a
  specification path break. Routing pointers at the old locations cover this
  until the links are migrated, as the staged migration already requires.
- Follow-up work: the specification tree change is owned by
  [Note structure and dogfood vault](../spec/note-structure-and-dogfood-vault.md);
  `specification` needs a kind and folder definition there, and the
  dogfood migration Epic's tasks name the corrected destination.
