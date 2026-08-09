---
type: task
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Slice-2-shared-reads-agent]]'
status: backlog
category: loose-end
rank: 4000
milestone: '[[Milestones/v1 release]]'
---

# Give search strategy a runtime caller

The whitespace-token and subsequence task-search strategies are implemented
and tested but have no runtime caller; the workbench always uses the
substring default. Reaching them needs either a changed default or a
persisted user setting, and the latter is a compatibility surface.
