---
type: task
project: '[[Projects/Weave/Project]]'
status: backlog
category: loose-end
rank: 3100
---

# Remove or wire up ObsidianVaultReader.setProjectRoots

`ObsidianVaultReader.setProjectRoots` is unreachable. Scope changes build a
replacement runtime in `src/main.ts` instead of mutating the reader.
