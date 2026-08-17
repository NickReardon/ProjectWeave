---
type: task
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-shared-reads-agent]]'
status: done
category: bug
rank: 5100
milestone: '[[Milestones/v1 release]]'
---

# Suggest indexed projects and folders for agent grant fields

The **Create agent grant** row's project path and content roots fields were
plain text inputs with only placeholder hints, while every other vault-path
field in settings offered fuzzy completion through
`AbstractInputSuggest`. A mistyped path in either field produced a grant
that looked fine and failed later during MCP client setup, far from where
the typo was made.

The project path field now suggests only indexed projects, reusing the same
`listProjects` application query the agent gateway already answers
`projects_list` requests with, exposed to settings via
`ProjectWeavePlugin#listIndexedProjects`. This intentionally excludes
non-project notes, since a grant can only be scoped to an indexed project.

The content roots field reuses the existing vault-folder suggestion pattern,
scoped to the comma-separated segment currently being typed; selecting a
suggestion replaces only that segment and preserves the others already
entered, trimmed the same way `#createAgentGrant` parses the field on
submit.

The grant row's responsive layout (`project-weave-agent-grant-setting`, from
the prior narrow-width fix) still applies: the added CSS covers the
`.search-input-container` wrapper `addSearch` renders, alongside the
existing `input`/`button` rules.
