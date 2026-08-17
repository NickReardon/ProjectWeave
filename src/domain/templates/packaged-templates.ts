import type { TemplateSource } from './model';

/**
 * Stable selector for the packaged minimal templates. the Vault note templates spec lets an agent
 * or a repair action name `builtin:minimal` explicitly instead of silently
 * falling back to it.
 */
export const PACKAGED_MINIMAL_TEMPLATE_ID = 'builtin:minimal';

/**
 * The packaged minimal task template. It is an immutable plugin asset used
 * when the vault library has no default task template, so creation never
 * requires a passive setup write.
 *
 * The content is embedded rather than read at runtime: the domain layer has no
 * filesystem access, and the released plugin ships only `main.js`,
 * `manifest.json`, and `styles.css`. `tests/unit/packaged-templates.test.ts`
 * keeps this copy byte-identical to `templates/default/task.md`, which is also
 * the editable starter that project scaffolding will copy.
 */
export const PACKAGED_MINIMAL_TASK_TEMPLATE: TemplateSource = {
  path: `${PACKAGED_MINIMAL_TEMPLATE_ID}/task`,
  content: `---
weave_template: true
template_schema: 1
template_for: task
template_name: default
template_description: Standard implementation task
template_inputs:
  summary:
    type: markdown
    required: false
  acceptance_criteria:
    type: markdown
    required: false
type: task
title: "{{title}}"
project: "{{project_link}}"
status: "{{status}}"
epic:
milestone:
sprint:
owner:
category:
priority:
points:
rank: "{{rank}}"
due_date:
depends_on: "{{dependency_links}}"
origin: "{{origin_link}}"
created: "{{date}}"
---
# {{title}}
{{#if summary}}

## Summary

{{summary}}
{{/if}}
{{#if acceptance_criteria}}

## Acceptance criteria

{{acceptance_criteria}}
{{/if}}

## Notes
`,
};

/** The packaged minimal template source file, relative to the repository. */
export const PACKAGED_MINIMAL_TASK_TEMPLATE_FILE = 'templates/default/task.md';

/**
 * The packaged minimal project template, on the same terms as the task one: an
 * immutable plugin asset, embedded rather than read at runtime, and kept
 * byte-identical to `templates/default/project.md` by
 * `tests/unit/packaged-templates.test.ts`.
 *
 * A project note is what every other kind hangs off, so this is the one
 * template a vault with nothing in it still needs.
 */
export const PACKAGED_MINIMAL_PROJECT_TEMPLATE: TemplateSource = {
  path: `${PACKAGED_MINIMAL_TEMPLATE_ID}/project`,
  content: `---
weave_template: true
template_schema: 1
template_for: project
template_name: default
template_description: Minimal long-running project
template_inputs:
  summary:
    type: markdown
    required: false
type: project
title: "{{title}}"
status: planned
created: "{{date}}"
---
# {{title}}

{{#if summary}}
## Summary

{{summary}}
{{/if}}

## Goal


## Scope

### In scope

-

### Out of scope

-

## Current focus


## Design index

-
`,
};

/** The packaged minimal project template source file, relative to the repository. */
export const PACKAGED_MINIMAL_PROJECT_TEMPLATE_FILE =
  'templates/default/project.md';

/** Packaged starter for the future epic creation flow. */
export const PACKAGED_MINIMAL_EPIC_TEMPLATE: TemplateSource = {
  path: `${PACKAGED_MINIMAL_TEMPLATE_ID}/epic`,
  content: `---
weave_template: true
template_schema: 1
template_for: epic
template_name: default
template_description: Substantial project outcome or system
template_inputs:
  outcome:
    type: markdown
    required: false
type: epic
title: "{{title}}"
project: "{{project_link}}"
status: planned
owner: "{{owner}}"
origin: "{{origin_link}}"
created: "{{date}}"
---
# {{title}}

{{#if outcome}}
## Outcome

{{outcome}}
{{/if}}

## Scope


## Completion conditions

- [ ]

## Notes
`,
};

export const PACKAGED_MINIMAL_EPIC_TEMPLATE_FILE = 'templates/default/epic.md';

/** Packaged starter for the future milestone creation flow. */
export const PACKAGED_MINIMAL_MILESTONE_TEMPLATE: TemplateSource = {
  path: `${PACKAGED_MINIMAL_TEMPLATE_ID}/milestone`,
  content: `---
weave_template: true
template_schema: 1
template_for: milestone
template_name: default
template_description: Dated project outcome, demo, or release
template_inputs:
  outcome:
    type: markdown
    required: false
type: milestone
title: "{{title}}"
project: "{{project_link}}"
status: planned
due_date: "{{due_date}}"
owner: "{{owner}}"
origin: "{{origin_link}}"
created: "{{date}}"
---
# {{title}}

{{#if outcome}}
## Outcome

{{outcome}}
{{/if}}

## Success conditions

- [ ]

## Included work

Task membership is derived from task milestone links.

## Review
`,
};

export const PACKAGED_MINIMAL_MILESTONE_TEMPLATE_FILE =
  'templates/default/milestone.md';

/** Packaged starter for the future planning-period creation flow. */
export const PACKAGED_MINIMAL_PLANNING_PERIOD_TEMPLATE: TemplateSource = {
  path: `${PACKAGED_MINIMAL_TEMPLATE_ID}/planning_period`,
  content: `---
weave_template: true
template_schema: 1
template_for: planning_period
template_name: default
template_description: Optional sprint, cycle, or planning period
template_inputs:
  review:
    type: markdown
    required: false
type: sprint
title: "{{title}}"
scope: project
project: "{{project_link}}"
status: planned
goal: "{{goal}}"
start_date: "{{start_date}}"
end_date: "{{end_date}}"
---
# {{title}}

## Goal

{{goal}}

## Plan

Task membership is derived from task planning-period links.

{{#if review}}
## Review

{{review}}
{{/if}}

## Retrospective
`,
};

export const PACKAGED_MINIMAL_PLANNING_PERIOD_TEMPLATE_FILE =
  'templates/default/planning-period.md';

/** Packaged starter for the future ordinary-document creation flow. */
export const PACKAGED_MINIMAL_DOCUMENT_TEMPLATE: TemplateSource = {
  path: `${PACKAGED_MINIMAL_TEMPLATE_ID}/document`,
  content: `---
weave_template: true
template_schema: 1
template_for: document
template_name: default
template_description: General project document
template_inputs:
  summary:
    type: markdown
    required: false
type: document
title: "{{title}}"
project: "{{project_link}}"
created: "{{date}}"
---
# {{title}}

{{#if summary}}
## Summary

{{summary}}
{{/if}}

## Details


## Decisions

-

## Open questions

- [ ]

## References

-
`,
};

export const PACKAGED_MINIMAL_DOCUMENT_TEMPLATE_FILE =
  'templates/default/document.md';

/** Packaged named document variant for game and system designs. */
export const PACKAGED_DESIGN_DOCUMENT_TEMPLATE: TemplateSource = {
  path: `${PACKAGED_MINIMAL_TEMPLATE_ID}/document/design`,
  content: `---
weave_template: true
template_schema: 1
template_for: document
template_name: design
template_description: Game or system design document
template_inputs:
  summary:
    type: markdown
    required: false
type: design
title: "{{title}}"
project: "{{project_link}}"
created: "{{date}}"
---
# {{title}}

{{#if summary}}
## Summary

{{summary}}
{{/if}}

## Goals

-

## Non-goals

-

## Player or user experience


## Requirements


## Design


## Edge cases


## Open questions

- [ ]

## Related work

Related tasks are derived from task origin links; this document does not maintain a mirrored task list.
`,
};

export const PACKAGED_DESIGN_DOCUMENT_TEMPLATE_FILE =
  'templates/default/design.md';

export interface PackagedStarterTemplate {
  readonly kind: string;
  readonly variant: string;
  readonly source: TemplateSource;
  readonly file: string;
}

/**
 * Complete immutable starter set. Future creation services can select from
 * this catalog without reading repository files or inventing their own copy.
 */
export const PACKAGED_STARTER_TEMPLATES = [
  {
    kind: 'task',
    variant: 'default',
    source: PACKAGED_MINIMAL_TASK_TEMPLATE,
    file: PACKAGED_MINIMAL_TASK_TEMPLATE_FILE,
  },
  {
    kind: 'project',
    variant: 'default',
    source: PACKAGED_MINIMAL_PROJECT_TEMPLATE,
    file: PACKAGED_MINIMAL_PROJECT_TEMPLATE_FILE,
  },
  {
    kind: 'epic',
    variant: 'default',
    source: PACKAGED_MINIMAL_EPIC_TEMPLATE,
    file: PACKAGED_MINIMAL_EPIC_TEMPLATE_FILE,
  },
  {
    kind: 'milestone',
    variant: 'default',
    source: PACKAGED_MINIMAL_MILESTONE_TEMPLATE,
    file: PACKAGED_MINIMAL_MILESTONE_TEMPLATE_FILE,
  },
  {
    kind: 'planning_period',
    variant: 'default',
    source: PACKAGED_MINIMAL_PLANNING_PERIOD_TEMPLATE,
    file: PACKAGED_MINIMAL_PLANNING_PERIOD_TEMPLATE_FILE,
  },
  {
    kind: 'document',
    variant: 'default',
    source: PACKAGED_MINIMAL_DOCUMENT_TEMPLATE,
    file: PACKAGED_MINIMAL_DOCUMENT_TEMPLATE_FILE,
  },
  {
    kind: 'document',
    variant: 'design',
    source: PACKAGED_DESIGN_DOCUMENT_TEMPLATE,
    file: PACKAGED_DESIGN_DOCUMENT_TEMPLATE_FILE,
  },
] as const satisfies readonly PackagedStarterTemplate[];
