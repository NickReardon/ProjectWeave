---
type: task
title: Gate documentation links and naming
project: '[[Projects/Weave/Project]]'
status: backlog
category: chore
priority: high
rank: 700
origin: '[[Documents/Design/Documentation authority and document lifecycle]]'
created: 2026-08-16
---

# Gate documentation links and naming

## Summary

Two large renames landed this session — Epic notes and specifications — and both
were verified by hand-written one-off shell sweeps. Nothing in `npm run check`
verifies that a relative Markdown link resolves, so the next rename that misses a
reference produces a broken link that passes the gate.

The renames also had to be undone conceptually more than once: the specification
citation style changed from "Design NN" to "Spec NN" and then to subject names,
and nothing prevents a numeric name reappearing.

## Acceptance criteria

- The gate fails on a relative Markdown link in `docs/` that does not resolve,
  including vault wikilinks to Epics, Tasks, Milestones, and Documents.
- The gate fails on a specification filename carrying a numeric prefix, and on a
  surviving `Spec NN` or `Design NN` citation outside `docs/archive/`.
- `docs/archive/` is exempt; it is historical and its links point at documents
  that have moved on.
- Failures name the file, the line, and the unresolved target.

## Validation

Node script tests covering a resolving link, a broken relative link, a broken
wikilink, a numeric specification filename, and an archive file that is
correctly ignored.

## Notes

Worth scoping small. The check is a file-exists test over extracted link
targets, not a Markdown parser, and it should stay fast enough to run in the
ordinary gate rather than becoming a separate job.
