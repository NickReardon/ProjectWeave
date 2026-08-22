---
type: spec
area: migration
status: current
canonical: true
related_decisions: []
---

# Legacy Migration

## Goal

Recognize legacy `pm-task` notes without mutating them and migrate the Tethered vault incrementally, exactly once per selected note, with complete dependency reconciliation and audit evidence.

## Scope boundary

Migration operates in the separate user vault/repository and specifically on the approved migration branch. Project Weave's own repository contains migration logic and fixtures, not the user's task data. Running the plugin, opening a legacy note, or upgrading never starts migration.

## Legacy compatibility mode

When enabled in settings, `type: pm-task` notes are indexed as `legacy_task` read-only records. They may appear in a migration inventory and optional legacy sections, but all normal mutation commands are disabled with an explanation. They are not counted as canonical `task` notes.

## Batch selection

The user explicitly selects a small set of related legacy tasks. The preview expands the selection to referenced legacy dependency IDs only for resolution checking; it does not silently add those notes to the write batch.

## Mapping preview

For every selected note, show:

- source path and intended in-place target path;
- old field, raw value, mapped field, and mapped value;
- legacy ID to canonical wiki-link resolutions;
- preserved body/acceptance-criteria indication;
- warnings, unresolved decisions, and validation errors;
- proposed resulting frontmatter diff.

The preview is exportable as Markdown/JSON evidence without writing content.

## Required mappings

- `type` becomes `task`.
- Project, status, owner, points, dates, priority, URLs, and meaningful metadata map only through an explicit versioned mapping table.
- Legacy dependency IDs become wiki links to exactly resolved task notes.
- Bodies and acceptance criteria are preserved byte-for-byte unless a separately previewed body transformation is explicitly approved.
- Existing canonical notes are never duplicated.

Unknown legacy fields are preserved by default and reported. Dropping a field requires a documented mapping rule and visible preview.

## Legacy blocked decision

Each `blocked` status requires one explicit choice:

- `waiting` when blocked by a person/event not represented as a task;
- `todo` when readiness should be derived from resolved dependencies;
- unresolved, which fails preflight and leaves the note unchanged.

No batch-level default may hide this choice.

## Preflight

The entire batch fails before writing if:

- any referenced legacy ID is missing or ambiguous;
- a mapping decision is unresolved;
- a target would not validate as a canonical task;
- dependencies introduce a same-project cycle;
- a selected note changed since preview;
- output paths collide or counts do not reconcile.

## Commit and recovery

Conversion edits selected notes in place in deterministic order and records exact outcomes. On partial runtime failure, stop and emit a reconciliation report. Re-running classifies already valid `type: task` outputs as already migrated only when their fingerprint/output matches the proposal; it never creates a second note.

After each accepted batch, the operator validates in Obsidian and commits the vault branch before selecting another batch.

## Final reconciliation

Before retiring the legacy board/Project Manager:

1. Reconcile all 126 expected tasks by source and canonical path.
2. Compare pre/post counts and status distribution with documented mappings.
3. Verify every dependency edge and broken-link count.
4. Verify bodies, acceptance criteria, URLs, dates, priority, and preserved metadata.
5. Confirm no writable legacy notes remain unintentionally.
6. Perform manual workflow tests in Obsidian.
7. Preserve mapping reports, commits, and legacy evidence until acceptance.

Retiring the old board representation and disabling Project Manager are explicit operator actions outside automatic migration. Deleting the old plugin/evidence is excluded.

## Acceptance criteria

- Compatibility mode never writes legacy records.
- Preview identifies every proposed path and field change.
- Unresolved IDs or blocked-status choices prevent all batch writes.
- Migration is in-place, preserves bodies/meaningful metadata, and creates no duplicates.
- Interrupted batches produce enough information to reconcile and safely retry.
- Final reconciliation accounts for all 126 tasks and dependency edges before retirement.
