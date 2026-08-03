---
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
