---
type: task
project: '[[Projects/Weave/Project]]'
status: backlog
category: loose-end
rank: 3200
---

# Wire the merged template-catalog model into a second caller

ADR 0013's vault template library and composite reader have a runtime caller
through task creation, but the merged-catalog model in
`src/application/template-catalog.ts` is still unused — the resolver merges
the two configured sources directly. The catalog type earns its place when a
second kind reads the library.

ADR 0013 stays `proposed` until the normative template contract in Plan
Addendum 005 and Design 18 matches it.
