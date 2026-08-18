---
type: task
title: Decide how the Epic roadmap is rendered
project: '[[Projects/Weave/Project]]'
status: backlog
category: loose-end
priority: normal
rank: 600
created: 2026-08-16
---

# Decide how the Epic roadmap is rendered

## Summary

The roadmap tables in the project note are hand-maintained. Their status columns
are gone — Epic frontmatter owns that — but slice order and Epic dependencies
are still typed by hand. Decide what renders them instead. Deferred
deliberately; no option is blocked and the tables are correct meanwhile.

## Options

- **An Obsidian Base.** Zero code, works today, and queries the Epic frontmatter
  directly. A `.base` file is a view rather than state, so it does not conflict
  with the Markdown-is-canonical invariant.
- **Project Weave's own Epic roadmap view.** The product's own job, and the
  honest dogfooding answer — the Projects and epics spec already specifies an Epic view. Needs
  [[Tasks/Add Epic roadmap graph fields]] first, since Epic `rank` and
  `depends_on` are unparsed, which is exactly why the order is manual.
- **Leave it manual.** Viable while the list is nine rows and rarely reordered.

## Constraints already checked

- `manifest.json` sets `minAppVersion: 1.8.0`, and Bases needs 1.9+. This gates
  shipping a Base to users, not using one in this vault, which is the
  maintainer's own.
- `scripts/diagnostics.mjs` only reads `.md`, so a `.base` file is invisible to
  the diagnostics gate and cannot break it.
- Reaching for a Base is itself a signal: whatever it would render is a view
  Project Weave does not offer yet.

## Decision

An Obsidian Base renders the roadmap, for now.

It queries the Epic frontmatter that is already authored — `rank`,
`depends_on`, `milestone` — so the ordering stops being retyped by hand. A
`.base` file is a view rather than state, so it does not compete with the
Markdown-is-canonical invariant, and `scripts/diagnostics.mjs` only reads `.md`,
so it cannot affect the gate.

`minAppVersion: 1.8.0` against Bases needing 1.9+ gates shipping a Base to
users, not using one in this vault, which is the maintainer's own. That is why
this is reversible rather than a commitment.

It stays a stopgap on purpose. Reaching for a Base is itself the signal the
task already names: whatever it renders is a view Project Weave does not offer
yet. Weave's own Epic roadmap view remains the honest answer, and additional
dashboard pages can grow from it later. This decision buys that time without
paying for hand-maintained tables meanwhile — a cost that just came due when
the roadmap went from twelve Epics to thirteen by hand.

## Acceptance criteria

- One mechanism is chosen and the hand-maintained tables are removed or
  explicitly kept with a stated reason.
- If Weave renders it, the Projects and epics spec's Epic view covers roadmap ordering.

## What remains

The decision is made; building it is not. A `.base` file has to exist, query
Epic `rank`, `depends_on`, and `milestone`, and the hand-maintained roadmap
table in [[Projects/Weave/Project]] has to be removed once the Base renders the
same information — otherwise the project note carries two answers to the same
question, which is the failure this decision was meant to end.

Note that the Base reads properties the Epic model still cannot; see
[[Tasks/Add Epic roadmap graph fields]]. That gap is the reason a Base is a
stopgap rather than the answer, and it does not block one.
