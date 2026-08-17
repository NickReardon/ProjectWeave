---
type: decision
id: "0020"
area: templates
status: accepted
canonical: false
affects: ["vault-note-templates"]
---

# ADR 0020: Defer project-specific template mappings

- Status: accepted
- Date: 2026-08-09
- Owners: Project Weave

## Context

The template catalog originally let a project override shared variants through
nested `weave.templates.<kind>.<variant>` frontmatter. The capability worked,
but its only configuration workflow was manually editing a project note's YAML.
That is too obscure and structural for the streamlined v1 experience, while the
vault template library already provides a visible file-based workflow.

## Decision

V1 resolves templates from the configured vault library and packaged defaults
only. Project-specific template mappings are removed from the runtime and from
acceptance requirements. Unknown project frontmatter remains ordinary preserved
Markdown and does not configure template resolution.

Project-specific selection may return after its ownership, inheritance, and UI
workflow are designed together. Reintroducing the old `weave.templates` shape
is not implied.

## Alternatives considered

- **Keep the resolver but hide the workflow:** rejected because an undocumented
  compatibility surface would still constrain the later design.
- **Keep nested frontmatter as the v1 workflow:** rejected because it asks users
  to maintain implementation-shaped YAML for an ordinary creation preference.
- **Remove project specialization permanently:** rejected because different
  project workflows may still justify it after a better configuration model is
  known.

## Consequences

- Positive: every project has one obvious catalog, edited by adding or changing
  Markdown files in the configured template folder.
- Positive: the chooser, diagnostics, UI, and future agent callers share the
  same effective variants without hidden per-project precedence.
- Negative: two projects in one vault cannot currently specialize the same
  variant differently.
- Follow-up work: design project-specific selection only when a user-facing
  workflow can be accepted without requiring nested frontmatter edits.
