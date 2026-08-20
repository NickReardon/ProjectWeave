---
type: task
title: Move canonical docs into typed folders
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-dogfood-vault-migration]]'
status: done
priority: high
created: 2026-08-09
---

# Move canonical docs into typed folders

## Summary

Move the living specifications and the decision log into the dogfood vault so
that `docs/spec/` and `docs/decisions/` stop being document locations. Content
is preserved, typed metadata is added, and links are updated in the same change.

## Destinations

| Source | Destination | `document_kind` |
| --- | --- | --- |
| `docs/spec/` | `Documents/Specifications/` | `specification` |
| `docs/decisions/` | `Documents/Decisions/` | `decision` |

Specifications do **not** go to `Documents/Design/`, which this task said until
[[Documents/Decisions/0029-hold-every-project-document-in-the-vault|ADR 0029]]
corrected it. A design document is a proposal; a specification is a living
contract, and filing one under the other is the ownership inversion
[[Documents/Decisions/0022-separate-living-specifications-from-point-in-time-decision-records|ADR 0022]]
exists to prevent.

## Inbound paths that move with the files

The content move is small next to the citations pointing at it. Each of these
resolves to the old tree today:

- Vault notes that escape the vault to cite a specification, in the form
  `../../../../spec/<name>.md`. These become ordinary vault links, which is the
  main gain.
- `scripts/verify-doc-links.mjs`, whose `SPEC_PREFIX` and vault prefix encode
  the split as two namespaces.
- The routers: `AGENTS.md`, `docs/AGENTS.md`, and the generated `CLAUDE.md`
  projections, plus `docs/spec/README.md` and `docs/decisions/README.md`.
- `README.md` and `docs/ARCHITECTURE.md`.

## Acceptance criteria

- There is one canonical copy of each specification and decision record, in the
  vault.
- No vault note cites a document by climbing out of the vault.
- Links and origin references resolve from the new locations, and
  `npm run docs:links` passes.
- Old locations remain only as short non-authoritative routing pointers until
  retired.
- `npm run diagnostics:check` reports no unexpected diagnostics once the moved
  documents are inside the scanned vault.

## Notes

Sequencing is settled by ADR 0029: relocating a document does not depend on the
plugin recognizing its kind, because typed documents are warning-only and
untyped Markdown is unaffected. The move therefore runs ahead of
[[Epics/Epic-typed-document-catalog]] rather than behind it.

## Validation

Check link resolution, duplicate canonical documents, and warning diagnostics
after each category.
