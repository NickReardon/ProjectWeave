---
type: task
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-template-catalog]]'
status: done
category: manual-check
rank: 800
milestone: '[[Milestones/v1 release]]'
---

# Check 16 - Task template chooser

Procedure: `docs/development/testing.md`, check 16.

Accepted in Obsidian after the 0.5.4 template-library merge. The always-visible
chooser, stronger disabled state, friendly **Built-in default** label,
vault-library `bug` variant, selected-template creation, and invalid-template
diagnostics were exercised successfully. With only the packaged default, the
control remains visible but disabled and names the configured library folder.

Project-specific mappings are no longer part of this check; ADR 0020 defers
them until they have a workflow that does not require nested project-note
frontmatter.
