---
type: task
title: Give template rung resolution one owner
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-creation-pipeline]]'
status: done
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

> **Superseded by the Outcome.** The second and third criteria below rest on a
> premise that turned out to be backwards: project creation already failed
> closed, and task creation was the deficient path. They are left as written
> because they are what the work was scoped from; the Outcome records what was
> actually true and what shipped.

- One implementation of the rung ladder resolves templates for every kind.
- The fail-closed behavior ADR 0013 specifies applies to project creation, and
  a test proves the rung that project creation previously skipped.
- No behavior change for task creation.

## Notes

`byteLength` and `lineCount` move in the same spirit but belong with
[[Tasks/Collapse the two creation ladders into one pipeline]], which is where a
shared home for them appears.

## Outcome

`TaskTemplateResolver` generalized into `src/application/template-resolver.ts`
as `TemplateResolver`, taking a `kind` and a diagnostic path instead of
assuming task. `TaskCreationProposalService` and
`ProjectCreationProposalService` both construct and call it;
`ProjectCreationProposalService.#selectTemplate` and its private
candidate-merging are gone.

The premise above named the wrong side. Reading both implementations closely,
and confirming it by running each against a case-colliding vault default,
showed the opposite: `ProjectCreationProposalService` already ran its
candidates through `mergeTemplateCatalog`/`variantsForKind` and failed closed
on a collision. `TaskTemplateResolver` read the library through
`VaultTemplateLibrary.load()` directly, which omits a colliding key from
`list().entries` and reports it in `.ambiguous` instead — so `load()` returned
null, and the `default` branch read that as "nothing configured" and silently
returned the packaged template with no diagnostic. That is exactly the silent
fall-through ADR 0013 forbids, and it was the task path skipping it, not
project's. Unifying on the catalog-based approach carries project's stricter
check into the one resolver, so a colliding `task/default` and a colliding
`project/default` now fail the same way: `template.library.ambiguous`, no
selection, no packaged fallback.

`tests/application/template-resolver.test.ts` (renamed from
`task-template-resolver.test.ts`) keeps every prior task-path assertion,
adjusted only for the new `(kind, path, variant?)` signature, and adds
matching ambiguous-default cases for both `task` and `project`. The existing
`tests/application/project-creation-preview.test.ts` collision test still
passes unchanged. `docs/ARCHITECTURE.md` and the Vault note templates spec
were updated to describe one resolver rather than two.
