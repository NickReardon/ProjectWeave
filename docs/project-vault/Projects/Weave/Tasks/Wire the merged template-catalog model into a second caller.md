---
type: task
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-template-catalog]]'
status: done
category: loose-end
rank: 3200
milestone: '[[Milestones/v1 release]]'
---

# Wire the merged template-catalog model into a second caller

Project creation now selects `project/default` through ADR 0013's merged
catalog before it loads the exact vault path or falls back to the packaged
template. Per-key isolation keeps an ambiguous task variant from disabling
project creation, while an ambiguous or malformed vault `project/default`
still fails closed instead of silently producing different bytes.

ADR 0013 stays `proposed` until the normative template contract in Plan
Addendum 005 and the Vault note templates spec matches it.

## Validation

- Project creation prefers the vault catalog winner and fingerprints its exact
  case-preserved path.
- A case-insensitive `project/default` collision blocks creation with
  `template.library.ambiguous`.
- An ambiguous task key does not poison the independent project key.
- Focused project-creation, vault-library, and packaged-template tests pass.
