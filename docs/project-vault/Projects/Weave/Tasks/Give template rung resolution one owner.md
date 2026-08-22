---
type: task
title: Give template rung resolution one owner
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-creation-pipeline]]'
status: backlog
category: enhancement
priority: high
rank: 6500
milestone: '[[Milestones/v1 release]]'
created: 2026-08-19
---

# Give template rung resolution one owner

## Summary

[[Documents/Decisions/0013-resolve-templates-from-a-vault-template-folder|ADR 0013]]
defines a rung ladder for resolving a template from the vault template folder.
It is implemented twice: once in `TaskTemplateResolver`, and again privately in
`ProjectCreationProposalService.#selectTemplate`, whose own doc comment concedes
it does so "on the same grounds as a task variant".

Two implementations of a fail-closed rule means the rule is only as strong as
the weaker one, and today only the task path implements it fully.

## Solution

Generalize `TaskTemplateResolver` over a template kind and delete the private
reimplementation. This is a prerequisite for
[[Tasks/Collapse the two creation ladders into one pipeline]] rather than part
of it: doing it first keeps that change from carrying two unrelated arguments.

## Acceptance criteria

- One implementation of the rung ladder resolves templates for every kind.
- The fail-closed behavior ADR 0013 specifies applies to project creation, and
  a test proves the rung that project creation previously skipped.
- No behavior change for task creation.

## Notes

`byteLength` and `lineCount` move in the same spirit but belong with
[[Tasks/Collapse the two creation ladders into one pipeline]], which is where a
shared home for them appears.
