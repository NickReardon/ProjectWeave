---
type: task
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Slice-2-shared-reads-agent]]'
status: done
category: loose-end
rank: 4100
milestone: '[[Milestones/v1 release]]'
---

# Sort search results by match score

The shared search query orders matching results by descending score, then by
stable entity order and path for deterministic ties. Every explicit search
mode therefore affects both matching and useful result ordering.
