---
type: task
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Slice-1-template-catalog]]'
status: backlog
category: loose-end
rank: 3500
milestone: '[[Milestones/v1 release]]'
---

# Check category vocabulary before committing a created task

The creation path does not read the category vocabulary, so a template
declaring a category outside it previews cleanly, commits, and is diagnosed
only once the index rebuilds. ADR 0014 states this as a decision and a cost
rather than leaving it to be inferred — it is the one creation outcome
reported after the write rather than refused before it, and no test or
manual check covers it.
