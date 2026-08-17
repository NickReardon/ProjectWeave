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

## Acceptance criteria

- One mechanism is chosen and the hand-maintained tables are removed or
  explicitly kept with a stated reason.
- If Weave renders it, the Projects and epics spec's Epic view covers roadmap ordering.
