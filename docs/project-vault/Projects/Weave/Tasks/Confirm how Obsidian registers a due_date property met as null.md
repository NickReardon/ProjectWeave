---
type: task
project: '[[Projects/Weave/Project]]'
status: backlog
category: loose-end
rank: 4500
---

# Confirm how Obsidian registers a due_date property met as null

Obsidian keeps property types in `.obsidian/types.json`, keyed by property
name for the whole vault and independent of any note's value. The configured
test vault already registers `due_date` as `date` and `points` as `number`,
so the nulls ADR 0010 writes render with the right editor there, and a null
cannot downgrade an existing registration. Project Weave must not write that
file, and Obsidian's public API exposes no way to.

Unconfirmed: what a vault that meets `due_date` as null before any real date
registers it as. Reseeding the disposable test vault doesn't reach it — the
fixture dates three tasks, so Obsidian always meets a real date first.
Answering it needs a vault seeded without the dated tasks.
