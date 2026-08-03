---
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
