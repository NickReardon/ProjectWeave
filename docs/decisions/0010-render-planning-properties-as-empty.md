# ADR 0010: Render the planning properties even when unset

- Status: accepted
- Date: 2026-08-05
- Owners: Project Weave

## Context

Design 18 says a frontmatter placeholder whose known optional variable is unset
omits the property entirely. Applied to the packaged task template, that means a
created task carries only the fields the creation context happened to supply.
Every planning field the template declares — `epic`, `milestone`, `sprint`,
`owner`, `priority`, `points`, `due_date` — disappears from a note created
without one.

Two costs follow. The user cannot see a task's available shape while editing it,
so filling in a due date means knowing the field name and typing it by hand.
Worse, Obsidian learns properties from the notes in a vault: if no note ever
carries `due_date`, the property picker never suggests it. During manual check 5
this made the due-state filters effectively unreachable — the field appeared not
to exist.

The omission rule is still right for properties whose absence carries meaning.
It is wrong for the planning fields, whose absence just means "not set yet".

## Decision

In the packaged task template, declare the seven planning properties as static
properties with an empty value rather than as placeholders. A static empty value
renders as `key: null`, and `applyContextPrecedence` already rewrites a
context-owned static into its placeholder whenever the creation context supplies
a value. A set field therefore renders its value exactly as before, and an unset
one renders `null` instead of vanishing.

`rank`, `depends_on`, and `origin` stay placeholders and keep the omission
behavior. `rank` is always allocated, so it is never null in practice. For
`depends_on` and `origin`, absence and an explicit null are not obviously the
same thing to the dependency and origin parsers, and nothing needs the change.

The general rule in design 18 is unchanged: this is a choice about what the
packaged template declares, not about how the renderer treats placeholders.

## Alternatives considered

- **Change the renderer to emit null for every unset optional placeholder:**
  rejected. It rewrites a normative rule for every template, including
  user-authored ones, to solve a problem with one packaged template.
- **Add the fields to the fixture vault instead:** rejected as insufficient. It
  would teach Obsidian the properties in the test vault only, and would leave
  real created tasks just as bare.
- **Collect the planning fields in the create-task modal:** rejected for now.
  It is a larger change to a UI surface, and it would still leave a task bare
  wherever the user skipped a field.

## Consequences

- Positive: a created task shows its full planning shape in Obsidian's property
  editor, and the properties become discoverable in the picker vault-wide.
- Negative: the rendered bytes of every created task change, so manual checks 12
  and 13 need re-running against a build that includes this.
- Negative: `key: null` is more frontmatter noise in a note that uses none of it.
- Follow-up work: none required. If the modal later collects planning fields,
  this decision still holds for the fields it does not collect.
