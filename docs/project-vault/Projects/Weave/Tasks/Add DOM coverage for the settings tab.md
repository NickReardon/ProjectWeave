---
type: task
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-template-catalog]]'
status: backlog
category: loose-end
rank: 3600
milestone: '[[Milestones/v1 release]]'
---

# Add DOM coverage for the settings tab

The settings tab still has no DOM coverage, so the failure notice that task
category add/remove now surfaces is unverified by any automated check. It is
reachable only when persisting settings rejects, which the manual checks do
not provoke either.
