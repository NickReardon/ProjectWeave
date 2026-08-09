---
type: task
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Slice-1-template-catalog]]'
status: todo
category: manual-check
rank: 900
milestone: '[[Milestones/v1 release]]'
---

# Check 15 - Create project

Procedure: `docs/development/testing.md`, check 15.

New and unrun. Project creation reaches the vault through the same commit
path task creation does, and has automated coverage, but nothing has
exercised it in Obsidian. Run in a disposable vault: the target path under an
indexed folder, a title matching an existing folder yielding a numbered
folder with a notice, an unusable title yielding a diagnostic, the created
project appearing in the workbench picker after the index refreshes, a task
created in it landing under its own `Tasks` folder, and the **New project**
button on an empty vault's workbench.

Blocks desktop acceptance.
