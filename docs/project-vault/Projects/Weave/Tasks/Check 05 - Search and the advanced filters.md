---
type: task
project: '[[Projects/Weave/Project]]'
status: waiting
category: manual-check
rank: 1400
---

# Check 05 - Search and the advanced filters

Procedure: [[Documents/References/testing]], check 5.

Passed in a session against the installed 0.4.1 build for search plus all
four due-date states (past due, due today, future, undated) and the category
filter.

Outstanding: the category vocabulary part. Configure `bug` and `chore` under
**Settings → Task categories**, set a task to `feature`, confirm
`task.category.invalid` names the allowed values while the note is left
unchanged, confirm the selector still offers a declared-but-unused value and
an undeclared one in use, then clear the list and watch the diagnostic go.
Unrun against any build — it's also the only runtime path of ADR 0014 with no
manual confirmation.
