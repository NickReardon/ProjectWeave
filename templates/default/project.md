---
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
