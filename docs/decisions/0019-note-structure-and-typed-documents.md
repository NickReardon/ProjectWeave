---
type: decision
id: "0019"
area: note-structure
status: accepted
canonical: false
affects: ["data-model-and-index", "projects-and-epics", "validation-and-safe-writes", "scheduling-and-milestones", "vault-note-templates", "note-structure-and-dogfood-vault"]
---

# ADR 0019: Configurable project trees and warning-only typed documents

- Status: accepted
- Date: 2026-08-09
- Owners: Project Weave

## Context

Project Weave has a project-owned folder for tasks and project-owned templates,
but the remaining note kinds and design material do not yet have a coherent
home. A rigid migration would overwrite local organization and make ordinary
Markdown unsafe to use.

## Decision

Use a conventional per-project tree with project-relative `weave.folders`
overrides. Materialize folders only during explicit confirmed creation. Keep
work-note contracts opt-in and blocking only for proposals. Represent typed
documents in a separate warning-oriented catalog; never give documents task
readiness or lifecycle semantics. Add Epic rank/dependency/milestone fields and
derive roadmap order and membership. Migrate Project Weave's own vault in
stages, with routing pointers and diagnostics at every boundary.

## Alternatives considered

- **One mandatory global folder layout:** rejected because it would force users
  to reorganize existing vaults.
- **Treat every Markdown document as an entity:** rejected because ordinary
  notes must remain safe and useful without frontmatter.
- **Copy task membership into Epic or milestone notes:** rejected because it
  creates competing canonical state.

## Consequences

- Positive: predictable onboarding, portable project organization, and a safe
  path from ordinary notes to typed documents.
- Negative: folder configuration and document diagnostics add parser and UI
  surface area; migration requires explicit link validation.
- Follow-up work: implement the three dogfood Epics and their acceptance gate.
