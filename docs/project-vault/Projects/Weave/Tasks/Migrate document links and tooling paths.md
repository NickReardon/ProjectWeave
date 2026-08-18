---
type: task
title: Migrate document links and tooling paths
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-dogfood-vault-migration]]'
status: backlog
category: enhancement
priority: high
rank: 2800
milestone: '[[Milestones/v1 release]]'
created: 2026-08-18
---

# Migrate document links and tooling paths

## Summary

Moving the specifications and decision records into the vault is a small change
next to repointing everything that cites them. This task owns that half, so the
relocation task is not judged by a diff dominated by path churn.

## What points at the old tree

- **Vault notes that escape the vault.** Epic notes cite specifications as
  `../../../../spec/<name>.md`, which is why the split is worth ending: these
  become ordinary wikilinks that Obsidian resolves.
- **`scripts/verify-doc-links.mjs`.** `SPEC_PREFIX` and `PROJECT_VAULT_PREFIX`
  encode the two trees as separate namespaces. Once there is one tree, the
  specification naming rule applies inside the vault instead.
- **The routers.** `AGENTS.md`, `docs/AGENTS.md`, and the generated `CLAUDE.md`
  projections carry the authority table and its paths. Regenerate with
  `./agents link` rather than editing generated files.
- **`docs/spec/README.md` and `docs/decisions/README.md`**, which index their
  own directories.
- **`README.md` and `docs/ARCHITECTURE.md`.**
- **`docs/project-vault/Projects/Weave/Project.md`**, whose reading map answers
  "what should be true?" with a `docs/spec/` path.

## Acceptance criteria

- No vault note reaches a document by climbing out of the vault.
- `npm run docs:links` passes with the gate's prefixes updated to one tree, and
  still fails a deliberately broken link.
- The routers name the new locations, and `./agents doctor` passes.
- Generated context files are regenerated rather than hand-edited.

## Notes

Sequenced with [[Tasks/Move canonical docs into typed folders]]; the two land
together or the link gate fails in between.
