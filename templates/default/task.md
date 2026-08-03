---
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
epic: "{{epic_link}}"
milestone: "{{milestone_link}}"
sprint: "{{planning_period_link}}"
owner: "{{owner}}"
priority: "{{priority}}"
points: "{{points}}"
rank: "{{rank}}"
due_date: "{{due_date}}"
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
