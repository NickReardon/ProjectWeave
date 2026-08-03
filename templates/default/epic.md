---
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
