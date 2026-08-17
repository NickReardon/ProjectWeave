---
type: decision
id: "0003"
area: dependencies
status: accepted
canonical: false
affects: ["dependencies-and-iterations", "sprints"]
---

# ADR 0003: Enforce declared same-project dependencies by default

- Status: accepted
- Date: 2026-08-02
- Owners: Project Weave

## Context

Project Weave should enforce only the process a project chooses to use. A dependency is not a universally required field, but once a user explicitly records one, it expresses a real prerequisite and defines order of operations.

## Decision

Same-project dependencies are optional but enforced by default when present. A blocked task cannot be started through Project Weave until every hard prerequisite is done. Projects may explicitly select advisory dependency mode. Cross-project dependencies remain advisory in v1.

Planning periods and point estimates remain optional capabilities and do not affect readiness.

## Consequences

- Positive: Ready Now and dependency sequence have dependable meaning.
- Positive: projects that do not use dependencies incur no setup or workflow burden.
- Negative: users wanting informational prerequisite links must opt into advisory mode.
- Follow-up: the project workflow UI must explain enforced versus advisory behavior where the policy is selected.
