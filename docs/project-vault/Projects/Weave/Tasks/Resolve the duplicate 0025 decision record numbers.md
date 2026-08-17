---
type: task
title: Resolve the duplicate 0025 decision record numbers
project: '[[Projects/Weave/Project]]'
status: backlog
category: chore
priority: normal
rank: 5400
created: 2026-08-17
---

# Resolve the duplicate 0025 decision record numbers

## Summary

`docs/decisions/` contains two records numbered `0025`:

- `0025-merge-ready-current-work-and-evergreen-release-docs.md`
- `0025-name-specifications-by-subject.md`

Both are accepted, so neither can simply be renamed: an accepted record is
immutable, and its number is the identifier other documents cite. The collision
was found while numbering a new record, and the next free number was taken as
`0026` rather than reusing either.

The naming gate added by [[Tasks/Gate documentation links and naming]] does not
catch this. That check covers specification filenames and citation style; it has
no rule about decision-record numbering being unique.

## Decision needed

Whether a duplicate number is a defect to correct or a historical fact to leave
alone. Renumbering one record changes an identifier that may already be cited
from specifications, other records, or commit messages, and the immutability
rule in `docs/decisions/README.md` exists precisely to stop that kind of edit.
Leaving it means the directory has an ambiguous citation target forever.

## Acceptance criteria

- It is stated whether `0025` is corrected or accepted as historical.
- If corrected, every existing citation of the renumbered record is updated in
  the same change, and the rationale is recorded.
- If accepted, the reason is written down so the next reader does not re-open it.
- The gate rejects a *new* duplicate decision number either way, so the
  situation cannot recur.

## Notes

The gate rule is cheap and worth adding regardless of how the existing
collision is settled: it is a uniqueness check over the numeric prefixes of
`docs/decisions/*.md`, in the same script that already checks specification
filenames.
