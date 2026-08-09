---
type: task
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Slice-2-shared-reads-agent]]'
status: backlog
category: loose-end
rank: 4100
milestone: '[[Milestones/v1 release]]'
---

# Sort search results by match score

Search match scores are used only to decide whether a task matches, never to
order results. Subsequence matching is therefore filter-only until the
projection sorts by score.
