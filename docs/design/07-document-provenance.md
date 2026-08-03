# 07 — Document Provenance

## Goal

Connect execution work to the note or exact heading that motivated it without modifying source documents or storing duplicate backlinks.

## Origin field

Tasks and epics MAY contain one `origin` wiki link. Supported targets are a Markdown note or heading subpath, for example `[[Level Transition and Travel#Requirements]]`. Block and paragraph references are out of scope for v1.

The index stores the authored link, resolved file path, optional normalized heading, and resolution status. A missing note or heading is a warning: the entity remains usable and the link remains untouched.

## Create from current note or heading

The command requires an active Markdown editor. It derives origin as follows:

1. If the cursor or selection is under a heading, use the nearest preceding heading and create a heading link.
2. If the document has no headings or the user chooses note-level origin, use the note link.
3. If a selection spans more than one heading, ask the user to select the intended heading or use note level.

The task form opens with origin prefilled and editable. No task is created until the normal create flow is confirmed. The source note is never edited.

## Reverse provenance

For a source note, Project Weave derives linked tasks and epics from the index. A contextual panel or command groups them by exact heading and note-level origin, showing project, status, epic, sprint, and readiness. Reverse relationships are not inserted into source Markdown.

## Heading changes

When a heading is renamed manually, Obsidian may leave heading links unresolved. Project Weave reports the broken heading and offers navigation to the containing note; it does not guess a replacement or rewrite the entity automatically. Any future repair command must preview the exact link change.

## Privacy and display

Indexing stores only path/heading identifiers needed for lookup. Diagnostics and logs do not copy source paragraph text. UI may display the heading label but does not scrape the full section into task cards.

## Acceptance criteria

- Create From Current Heading selects the nearest valid heading and stores one wiki link.
- Note-level creation works when no heading exists.
- Source-note bytes are unchanged by creation, editing, indexing, and reverse lookup.
- Broken note and heading targets are distinguishable warnings.
- Renaming or deleting an origin never deletes or blocks its tasks/epics.
- Reverse provenance results equal a full scan of entity origin fields.
