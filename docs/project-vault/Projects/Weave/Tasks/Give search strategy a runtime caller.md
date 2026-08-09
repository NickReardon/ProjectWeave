---
type: task
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Slice-2-shared-reads-agent]]'
status: done
category: loose-end
rank: 4000
milestone: '[[Milestones/v1 release]]'
---

# Give search strategy a runtime caller

The shared query API exposes the substring, whitespace-token, and subsequence
strategies through an explicit per-request `mode`. The workbench keeps its
substring behavior without adding a persisted compatibility surface, while
agent and future callers can select the other strategies deliberately.
