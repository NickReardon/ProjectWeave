---
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
