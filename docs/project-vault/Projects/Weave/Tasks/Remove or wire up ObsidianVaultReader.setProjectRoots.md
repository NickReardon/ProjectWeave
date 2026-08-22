---
type: task
project: '[[Projects/Weave/Project]]'
status: done
category: loose-end
rank: 3100
---

# Remove or wire up ObsidianVaultReader.setProjectRoots

`ObsidianVaultReader.setProjectRoots` is unreachable. Scope changes build a
replacement runtime in `src/main.ts` instead of mutating the reader.

Removed as unreachable rather than wired up: a repo-wide grep found no
callers, and scope changes already run through the `src/main.ts` runtime
instead of mutating the reader.
