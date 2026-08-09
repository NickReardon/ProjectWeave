---
type: decision
status: accepted
canonical: false
---

# ADR 0017: Export configured diagnostics as derived JSON

- Status: accepted
- Date: 2026-08-08
- Owners: Project Weave

## Context

Project Weave already derives diagnostics in every immutable index snapshot.
The dashboard displays them, but an external tool or a CI-like check needs a
stable JSON artifact after the same rebuilds. The export must not become a
second source of project state or a generic vault mutation capability.

## Decision

Add an optional vault-relative **Diagnostics log folder** plugin setting. When
non-empty, the plugin writes exactly `<folder>/diagnostics.json` after each
complete read publication. The report contains index metadata, counts,
project-grouped diagnostics, and unassigned diagnostics, but no note bodies.
The writer is a typed diagnostics-output port and may create only its own
folder/report path. An empty setting disables output; disabling it does not
delete an existing report.

## Alternatives considered

- **Write by default:** rejected because passive indexing should not create
  vault output without an explicit user choice.
- **Per-project frontmatter:** rejected because generated-output configuration
  does not belong in canonical project content and would add a schema field to
  every project.
- **Generic vault writer:** rejected because it would widen the mutation
  surface beyond this one derived report.

## Consequences

- Positive: dashboard/index refreshes and external tooling can consume one
  deterministic, machine-readable report.
- Positive: Markdown remains canonical and report failures do not block reads.
- Negative: a configured folder is an explicit, recurring vault write and may
  create `diagnostics.json` modify events.
- Follow-up work: add report redaction/verbosity controls if export consumers
  need less detail than the current diagnostic contract.
