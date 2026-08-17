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

The agent-grant settings form now uses a scoped responsive grid so its three
fields and action button reflow within narrow settings panes instead of
collapsing the description and clipping the button.

## Verified

The scoped settings-tab regression passes, and the complete `npm run check`
gate passes with 368 Vitest tests and 58 script tests.

## Next

Visually confirm the agent-grant form at narrow desktop settings-pane widths.

## Loose ends

- Narrow-width Obsidian layout acceptance is interactive; DOM coverage verifies
  the scoped responsive hook and complete form controls but not rendered CSS.
- BRAT, companion-client, and mobile acceptance remain interactive follow-up
  work; automated evidence does not mark them complete.
