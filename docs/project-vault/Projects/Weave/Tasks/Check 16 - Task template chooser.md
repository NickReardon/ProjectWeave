---
type: task
project: '[[Projects/Weave/Project]]'
status: todo
category: manual-check
rank: 800
---

# Check 16 - Task template chooser

Procedure: `docs/development/testing.md`, check 16.

New and unrun. Put a `task/bug.md` under the template library folder, confirm
it appears in the create-task modal's **Template** chooser, that selecting it
changes the previewed bytes, that a project mapping for the same variant wins
over it, that a deliberately broken one shows its diagnostic and refuses
rather than falling back, and that **Packaged minimal** always renders the
packaged template. With only one variant, no chooser should appear at all.

Blocks desktop acceptance.
