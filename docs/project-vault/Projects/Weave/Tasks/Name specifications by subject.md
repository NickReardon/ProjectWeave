---
type: task
title: Name specifications by subject
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-documentation-authority]]'
status: done
category: chore
priority: critical
rank: 400
origin: '[[Documents/Design/Documentation authority and document lifecycle]]'
created: 2026-08-16
---

# Name specifications by subject

## Summary

Specifications were cited two ways at once — "Design NN" in the source comments
and most references, "specification" in the routing tables — and the number
itself carried no meaning once the index stopped treating it as precedence.
Settle on the subject as the name, per
[[Documents/Decisions/0025-name-specifications-by-subject|ADR 0025]].

## Acceptance criteria

- Specification filenames are subject slugs with no numeric prefix, and each
  filename agrees with its document's title.
- Citations name the subject; "Design NN" and "Spec NN" are both retired.
- Headings carry no number.
- `affects:` in decision records lists subject slugs.
- `docs/archive/` is left as written; it is historical and authoritative over
  nothing.
- Every specification link resolves.

## Validation

Search for surviving numeric citations and filenames outside `docs/archive/`,
confirm every specification link resolves, then run the complete gate.

## Outcome

Twenty files renamed, roughly 190 references rewritten — 66 link paths, 102
prose citations, 24 `affects:` entries. `18-project-note-templates.md` became
`vault-note-templates.md`, agreeing with its title for the first time since
ADR 0013.

The bulk rewrite left grammatical artifacts that no formatter or linter detects
— a doubled article, two lowercase bullet starts, one wrongly capitalised
continuation line. They were found by hand-written sweeps and fixed. Nothing
verifies link resolution automatically; that gap is
[[Tasks/Gate documentation links and naming]].
