---
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
