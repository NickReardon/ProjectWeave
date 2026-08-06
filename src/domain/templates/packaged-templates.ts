import type { TemplateSource } from './model';

/**
 * Stable selector for the packaged minimal templates. Design 18 lets an agent
 * or a repair action name `builtin:minimal` explicitly instead of silently
 * falling back to it.
 */
export const PACKAGED_MINIMAL_TEMPLATE_ID = 'builtin:minimal';

/**
 * The packaged minimal task template. It is an immutable plugin asset used
 * when a project references no task template of its own, so creation never
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
