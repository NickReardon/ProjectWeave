# ADR 0014: Group tasks with a vault-wide category vocabulary

- Status: accepted
- Date: 2026-08-06
- Owners: Project Weave

## Context

A vault template library (ADR 0013) makes a `bug` task template one file away,
but a task created from it is indistinguishable from any other task the moment
it exists. Rendering strips template-only metadata by design, so nothing on the
created note records which template produced it. Bugs cannot be filtered,
counted, or reviewed as a group.

The obvious-looking fix — a `bug` entity type beside project, epic, task,
milestone, and sprint — is the wrong one. `type` is the closed vocabulary the
whole engine keys on: rank, dependencies, readiness, the board, and the All
Tasks projection all reason about tasks. A bug is work that competes for the
same time and belongs in the same ordered backlog, so a separate type would
either duplicate every one of those behaviors or exclude bugs from them.

What is missing is not a kind. It is a grouping the plugin can filter by.

## Decision

**An optional `category` on tasks**, free-form by default, validated against a
vault-wide vocabulary when one is configured.

**The vocabulary is vault-wide, held in settings.** Not per project. Obsidian
stores property types in `.obsidian/types.json` keyed by property name for the
whole vault, and its property editor suggests values used anywhere in the
vault. A per-project vocabulary would therefore disagree with the suggestions
Obsidian itself offers in the editor next to ours — two different answers to
"what can I put here" for one field. One vault-wide list keeps every surface
consistent.

Storing it in settings satisfies the canonical-Markdown invariant because
losing `data.json` relaxes validation without changing what any note means. A
category that is no longer declared is still the category the note says.

**An empty list means unconstrained.** No configuration, no validation, and
filter options derived from what tasks actually use — the same behavior
`owner` already has. Declaring values turns validation on.

**An undeclared value is reported, never repaired.** `task.category.invalid`
names the allowed values in its recovery guidance, matching how an invalid
`priority` behaves. The task still indexes, still appears, and still carries
its value.

**Matching ignores case.** The configured list keeps the spelling the user
typed, but `Bug` and `bug` are the same category, because Obsidian's own
suggestions do not enforce one spelling.

**The filter offers declared values first, then undeclared values in use.** A
declared category with no tasks is still offered — declaring `spike` before
writing one is how a team says the category exists. An undeclared value in use
stays offered too, so the task carrying the diagnostic remains findable.

**Validation happens in indexing, not in parsing.** The parser reads `category`
as an optional string and knows nothing of settings; the index builder applies
the configured vocabulary. Configuration reaches indexing, and the domain stays
a pure function of the note.

**Templates set it.** The packaged task template declares `category:`, and a
`task/bug.md` template declaring `category: bug` is how choosing a template
assigns one. The task creation profile (ADR 0013) keeps the property visible as
`category: null` when unset, so Obsidian learns it vault-wide.

**No field in the create-task modal.** The template is how a category is
chosen, and adding a control to every task creation for something most tasks
leave unset is the wrong default. Additive later if a caller wants it.

**Creation does not check the vocabulary.** This follows from the two decisions
above and is stated so it is not mistaken for an oversight. The creation path —
resolver, proposal, preview, and commit — never reads the configured list, so a
template declaring `category: spike` against a vocabulary of `bug, chore`
previews cleanly, commits, and is reported only once the index rebuilds. Every
other creation failure is refused before the write; this one is not, because
gating it would mean the write path consults settings that validation
deliberately keeps in indexing, and because a value reported and never repaired
is not a reason to refuse the note that carries it. A vocabulary is guidance
about a vault's taxonomy, not a precondition for creating work.

## Alternatives considered

- **A `bug` entity type:** rejected, per the context above.
- **A closed controlled vocabulary in the domain**, like `priority`: rejected.
  The right taxonomy is discovered by each project, and every later addition
  would be a compatibility change to a controlled value we own.
- **Free-form with no vocabulary at all:** rejected as the only option, though
  it remains the default. Without a declared list there is no protection
  against a typo silently creating a category of one.
- **A per-project vocabulary in `weave.categories`:** rejected for now. It is
  the natural home for project configuration, and `weave.templates` proves the
  pattern works — but Obsidian's vault-wide property suggestions would
  contradict it, and no caller needs it yet. Deferred on the same grounds ADR
  0008 and 0012 deferred their overrides.
- **Obsidian tags in the body:** rejected. Searchable in Obsidian, invisible to
  the workbench's filters, and not part of a note's structured data.

## Consequences

- Positive: bugs, chores, and spikes are filterable as groups, and choosing a
  template is enough to assign one.
- Positive: a vault that wants no taxonomy sees nothing new.
- Negative: created tasks carry another `key: null` line, so the bytes of every
  created task change again. Checks 12 and 13 need re-running, which they
  already did after ADR 0010.
- Negative: `category` becomes a task compatibility surface. The property name
  and the diagnostic code are ours to keep stable; the values are the user's.
- Negative: Obsidian's property editor will still suggest values from other
  vaults' habits and from tasks in any project, since its suggestions are
  vault-wide and unaware of our vocabulary. Only the diagnostic tells the user
  they typed something undeclared.
- Negative: a template whose category is outside the vocabulary creates a task
  that is diagnosed the moment it is indexed, with nothing in the preview
  warning first. The note is correct and the diagnostic is accurate; the cost
  is that the user learns about it after the write rather than before.
