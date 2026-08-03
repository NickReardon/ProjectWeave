# ADR 0005: Use project-owned referenced Markdown templates for note creation

- Status: accepted
- Date: 2026-08-02
- Owners: Project Weave

## Context

A solo developer or small team needs consistent task, epic, milestone, planning-period, and design-document structure without hard-coding one workflow into the plugin. External agents must create notes using the same conventions as the UI rather than inventing Markdown/frontmatter layouts.

## Decision

Projects reference ordinary replaceable Markdown template notes by kind and optional variant. All UI and agent creation operations resolve through one Template Service before proposal validation. New-project scaffolding can materialize editable templates; packaged minimal templates remain a non-writing fallback for projects without overrides.

Templates affect future creation only. Existing notes are never automatically synchronized or reformatted when a template changes.

## Alternatives considered

- **Hard-code every generated note:** rejected because projects need different bodies, optional fields, terminology, and design practices.
- **Let agents generate complete Markdown freely:** rejected because UI/agent output would diverge and agents could bypass invariant fields.
- **Use only local plugin settings:** rejected because template choices would not travel with the project or small team.
- **Reapply templates to existing notes:** rejected because it risks destructive rewrites and confuses template defaults with canonical current content.
- **Execute a general scripting template engine:** rejected because it adds security, determinism, mobile, and support complexity.

## Consequences

- Positive: one portable creation format is shared across UI, agents, and collaborators.
- Positive: projects can remain minimal or adopt specialized task/design variants.
- Positive: changing future structure does not migrate historical notes.
- Negative: template parsing, variable typing, preview, and validation become core application services.
- Negative: template references and fingerprints become inputs to every creation proposal.
- Follow-up: ship starter templates and a Validate Project Templates command with the first creation vertical slice.
