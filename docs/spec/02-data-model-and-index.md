---
type: spec
area: data-model
status: current
canonical: true
related_decisions: []
---

# 02 — Data Model and Index

## Goal

Parse canonical Markdown notes into a reliable, rebuildable view of projects, epics, tasks, sprints, relationships, and diagnostics.

## Entity recognition

The Obsidian adapter discovers Markdown only beneath the project roots selected
in local plugin settings. A fresh install defaults to `Projects`; an empty root
list indexes nothing. Matching is path-segment aware, and files outside the
configured roots are not read or diagnosed.

Within that discovery boundary, only Markdown files with a supported top-level
`type` are canonical v1 entities: `project`, `epic`, `task`, `milestone`, and
`sprint`.

Legacy `pm-task` recognition is defined separately and is read-only. Unknown types are ignored. A file with malformed frontmatter that appears intended as an entity is surfaced as a diagnostic rather than silently ignored.

## Identity

The normalized vault path is the storage identity. Display title is `frontmatter.title` when present and valid, otherwise the filename stem. Wiki links are resolved using Obsidian's link resolution semantics from the source note. Ambiguous or unresolved links produce diagnostics.

Renaming a file changes its storage identity. The index follows Obsidian rename events; content-link maintenance is delegated to Obsidian/user settings. Project Weave does not proactively rewrite unrelated notes on rename.

## Parsed records

All records carry:

- `path` and `title`;
- `type` and parsed entity fields;
- raw link text for relation fields;
- resolved relation paths where resolution succeeds;
- a file modification fingerprint;
- zero or more validation diagnostics.

Parsers distinguish missing, malformed, and unsupported values so the UI can give an actionable message.

## Schema summary

### Project

Required: `type: project`. Existing vault fields are preserved. Project title/path is used as the owning relation target.

An optional `weave` mapping carries the project's workflow policy. Every key is
optional and every policy is off or permissive by default, so a project note
that omits `weave` entirely is fully valid:

```yaml
weave:
  dependency_mode: enforced # or `advisory`; default `enforced`
  planning_period_label: sprint # or `cycle`, `period`; default `sprint`
  estimation: null # explicit estimation policy when the project opts in
  owner_required_on_board: false
  estimate_required_in_period: false
```

Enforcement policies are stored in the project note rather than in local
settings so a small team sharing a vault shares the same rules.

### Epic

Required: `type`, `project`, `status`. Supported status: `planned`, `active`, `completed`, `cancelled`. Optional: `title`, `owner`, `origin`, `created`.

### Task

Required: `type`, `project`, `status` — and nothing else. Title falls back to the filename stem. Every other supported field is optional unless an enabled project policy explicitly requires it.

Supported status: `backlog`, `todo`, `in-progress`, `waiting`, `review`, `done`, `cancelled`. A `backlog` task is planned but not on the active board; see [16 — Streamlined long-project workflow](16-streamlined-long-project-workflow.md) for the backlog/board boundary.

Optional: `title`, `epic`, `sprint`, positive integer `points`, `owner`, `depends_on`, `iteration_of`, positive integer `iteration`, `origin`, `priority`, `created`, `sprint_history`. Scheduling fields — `rank`, `due_date`, `milestone`, `completed_at`, and `completion_history` — are specified in [15 — Scheduling and milestones](15-scheduling-and-milestones.md).

### Milestone

Required: `type`, `project`, `status`, `due_date`. Supported status: `planned`, `achieved`, `cancelled`. Field-level behavior and task membership are specified in [15 — Scheduling and milestones](15-scheduling-and-milestones.md).

### Sprint

Required: `type`, `scope`, `status`. Project scope requires exactly one `project`; portfolio scope requires a non-empty unique `projects` list. Supported status: `planned`, `active`, `completed`, `cancelled`. Optional: `title`, `goal`, `start_date`, `end_date`, commitment/outcome fields.

## Index projections

The immutable index snapshot contains:

- entities by path and by type;
- projects to their epics, tasks, and eligible sprints;
- epics to member tasks, derived from task `epic` links;
- sprints to assigned tasks, derived from task `sprint` links;
- forward dependency edges and reverse dependents;
- iteration roots and ordered iteration chains;
- origin note/heading references and reverse provenance lookups;
- readiness and blocker reasons;
- active sprint participation by project;
- diagnostics grouped by severity, path, and code.

## Update algorithm

Full build parses all Markdown candidates inside configured roots, resolves
links after parsing, computes graph-derived values, validates global
invariants, then atomically publishes a snapshot. Incremental updates
replace/remove affected in-scope records and recompute all projections reachable
from changed relation edges. Correctness takes priority over minimal
recomputation; a full rebuild is the fallback when impact cannot be bounded
safely.

Every asynchronous build captures a generation. Results from an older generation are discarded if a newer build has started.

## Diagnostics

Severity levels are `error`, `warning`, and `info`. Codes are stable and machine-testable, for example `task.project.missing`, `dependency.unresolved`, or `sprint.active_overlap`. Each diagnostic includes path, field when applicable, human explanation, and suggested recovery. Diagnostics never mutate the source.

## Acceptance criteria

- Rebuilding from the same vault produces an equivalent snapshot independent of file enumeration order.
- A single malformed note cannot hide valid entities.
- Duplicate titles with explicit paths resolve correctly; ambiguous short links are diagnosed.
- Create, modify, rename, and delete events produce the same result as a fresh full build.
- Derived member lists are never persisted merely to accelerate queries.
- Every controlled value and relation constraint in this document and in the owning feature designs has parser and validator tests.
