---
type: roadmap
status: current
canonical: false
---

# Project Weave Approved-v1 Implementation Order

## Purpose and authority

This document orders the remaining approved v1 work from the implementation
state recorded in [README](../README.md) and
[Current Work](CURRENT_WORK.md). It is a derived delivery roadmap, not a
product contract. [`docs/spec/`](spec/README.md) is the canonical statement of
intended behavior; every slice below remains governed by the specifications and
decision records it cites, and this document never overrides them.

Commit history remains the record of what has landed. `CURRENT_WORK.md` remains
the authority for validation evidence, outstanding manual checks, known loose
ends, and the immediate next decision. When this roadmap and current state
diverge, update the state documents rather than treating an old roadmap step as
unimplemented.

## Current starting point

The following foundations already exist and are not future roadmap work:

- asynchronous, non-writing indexing and immutable project-scoped read
  publications;
- the persistent Project Workbench, Ready Now, All Tasks, diagnostics, bounded
  paging, and project switching;
- deterministic task and project renderers with kind-owned creation profiles;
- create-only, fingerprinted task and project proposals, exact previews, and
  commits that refuse overwrite or stale inputs;
- task and project target allocation under project-owned folders;
- vault-wide task-template discovery, project/vault/plugin precedence, and a
  task-template chooser with explicit packaged-minimal selection.

The current write boundary creates one task or project note. It cannot edit,
move, rename, delete, or commit a multi-file proposal. The remaining approved
v1 work therefore starts by accepting the existing creation flow and finishing
the template catalog experience before introducing any edit path.

## Sequencing rules

1. Finish and accept an existing write boundary before placing another write
   boundary on top of it.
2. Put domain rules in shared application services before adding view-specific
   or agent-specific callers.
3. Deliver the read-only agent boundary before broad write automation, but
   implement agent writes only after the equivalent human workflow is stable.
4. Add optional process features through progressive disclosure. A project
   must remain useful without owners, estimates, epics, milestones, or planning
   periods.
5. Keep every operational list explicitly project-scoped, bounded, and
   deterministically ordered.
6. Introduce multi-file work only after preflight, deterministic write order,
   and truthful partial-success reporting exist.
7. Keep the core plugin mobile-compatible. Desktop-only transport must remain
   conditional and optional.

## 1. Accept creation and complete the template catalog

First close the existing desktop acceptance debt in `CURRENT_WORK.md`: due
states, degenerate workbench states, the two focus-style fixes, project
creation, and task-template selection. Record defects before layering more
creation behavior over the same runtime.

Then finish ADR 0013 in this order:

1. Add **Add Template** as a previewed create-only operation. It chooses a kind
   and variant, copies a plugin/minimal starting point into the configured
   library, refuses collisions, commits one file, and opens the created note.
2. ~~Resolve `project/default` through the vault catalog before the packaged
   project default.~~ Landed: a broken configured winner fails closed, an
   absent vault candidate falls through, and the commit re-reads the vault
   template by fingerprint. Only its manual acceptance in step 4 remains.
3. Update Design 18 to match the layered catalog and kind-owned
   creation-profile precedence, then accept ADR 0013.
4. Complete manual acceptance for adding/selecting a task variant, project
   override precedence, invalid-template refusal, project-default creation,
   and fingerprint refusal after an open template changes.

Do not add the remaining entity kinds in this slice. Template discovery makes
a kind available to future creation services; it does not make that kind
creatable by itself.

Governing documents:

- [Design 18 — Project-Owned Note Templates](spec/18-project-note-templates.md)
- [ADR 0013 — Layered Note-Template Catalog](decisions/0013-resolve-templates-from-a-vault-template-folder.md)
- [Manual Checks](development/testing.md)

Exit gate: the complete automated gate passes, checks 5, 11, 15, 16 and the
focus checks have recorded outcomes, ADR 0013 is accepted, and task/project
catalog behavior is accepted in Obsidian.

## 2. Stabilize shared reads and deliver Agent Slice A

Expand the existing application query boundary before creating new views or
agent tools:

- add bounded project, entity, and ordinary-Markdown search;
- add explicit note/section reads with fingerprints, byte/line limits, and
  continuation;
- retain immutable note metadata, headings, reverse origins, and bounded
  searchable text without exposing full bodies by default;
- add related-work, dependency-sequence, diagnostics, Action Context, and
  Creation Context queries;
- return schema version, project reference, index revision/freshness, stable
  codes, and cursor metadata consistently;
- make new UI projections consume these services rather than reconstructing
  rules in views.

Implement Agent Slice A over those services. Record a transport ADR selecting
an authenticated loopback-only desktop bridge and companion, loaded
conditionally so mobile and ordinary plugin startup do not depend on it. The
gateway is disabled by default. Each local grant binds one client to one
project, permitted document roots, body-read scope, expiry, and revocation.
The adapter advertises bounded read tools only; proposal tools are absent.

Governing documents:

- [Design 02 — Data Model and Index](spec/02-data-model-and-index.md)
- [Design 17 — Agent Access and MCP](spec/17-agent-access-and-mcp.md)
- [Design 17 — Initial Security Profile](spec/17-agent-access-and-mcp.md#initial-security-profile)

Exit gate: UI and adapter contract tests return equivalent project context,
focus, related work, sequence, diagnostics, and action availability; one grant
cannot read another project; disabling/unloading the gateway leaves no
listener or write capability.

## 3. Build the typed mutation and proposal kernel

Create the shared foundation required by every existing-note and multi-file
operation:

- a source-preserving Markdown/frontmatter patcher that retains unknown keys,
  untouched body bytes, key order, and newline style;
- typed domain operations that produce exact before/after content, affected
  fingerprints, diagnostics, warnings, postconditions, and deterministic write
  order;
- proposal lifecycle states, opaque expiring handles, cancellation, and exact
  operation reports;
- a coordinator-only existing-note write port that can compare-and-replace
  approved Markdown but cannot delete, move, rename, or bypass validation;
- complete multi-file preflight followed by deterministic writes, stopping on
  failure and reporting written and unwritten paths without claiming
  transactionality;
- one-use approval receipts bound to proposal digest, project, client/grant,
  and expiry for later agent callers.

The UI and future adapter receive proposal/application services, never the
write port. No generic file or arbitrary-frontmatter operation becomes public.

Governing documents:

- [Design 10 — Validation and Safe Writes](spec/10-validation-and-safe-writes.md)
- [Design 03 — Task Management](spec/03-task-management.md)
- [ADR 0009 — Create-Only Write Boundary](decisions/0009-create-only-write-boundary.md)
- [Design 17 — Proposal Lifecycle](spec/17-agent-access-and-mcp.md#proposal-lifecycle)

Exit gate: single- and multi-file proposals abort before writing when any
preflight input changed; injected runtime failures produce exact partial
reports; unknown Markdown survives supported edits; replayed or mismatched
approval receipts cannot commit.

## 4. Complete task execution, Board, and My Work

Build all task mutations through the kernel and expose them through one
preview-first task editor:

- edit title/body and set or clear supported typed fields while preserving
  unrelated Markdown;
- Add to Board, Return to Backlog, every supported status transition,
  completion timestamps, reopening, and completion history;
- add/remove dependencies with self-edge, target-kind, project, and cycle
  validation;
- midpoint rank insertion, drag/keyboard reorder through one application
  operation, and explicit previewed project rank rebalance;
- priority, owner, due date, epic, milestone, points, and planning-period fields
  without requiring unused properties;
- project lifecycle and optional workflow-policy editing;
- action-context reasons for advisory/enforced blockers and enabled project
  policies.

Replace the interim workbench task presentation with the three primary
destinations while preserving current project selection, Ready Now, paging,
filters, and diagnostics:

- **Plan** initially provides ranked backlog and dependency sequence;
- **Board** provides bounded `todo`, `in-progress`, and recent `done` columns,
  revealing `waiting` and `review` when configured or used;
- **My Work** uses local `my_owner_name` for Ready, In Progress,
  Waiting/Review, Blocked, and Due groups, with an all-project-work fallback
  when owners are unused.

Same-project declared dependencies are enforced by default unless the project
explicitly selects advisory mode. Cross-project dependencies remain advisory.
Rank expresses preference; dependencies express prerequisites and are never
inferred from rank.

Governing documents:

- [Product Brief v1](spec/00-product-brief.md)
- [Design 03 — Task Management](spec/03-task-management.md)
- [Design 05 — Dependencies and Iterations](spec/05-dependencies-and-iterations.md)
- [Design 09 — Project Workbench](spec/09-project-workbench.md)
- [Design 15 — Scheduling and Milestones](spec/15-scheduling-and-milestones.md)
- [Design 16 — Streamlined Workflow](spec/16-streamlined-long-project-workflow.md)

Exit gate: a project with only project/task/status data can move work from
backlog through board completion and reopening; optional fields cause no
missing-field warnings; all list surfaces remain bounded and project-isolated.

## 5. Complete design-to-task planning and Agent Slice B

Add the document and proposal capabilities that complete the primary product
loop:

- record a target-path ADR using project-local `Documents/`, `Epics/`,
  `Milestones/`, and `Planning Periods/` folders, collision-safe title
  filenames, and the existing no-overwrite convention;
- create `Documents/<Title>.md` through `document/default` or a named variant
  such as `document/design`;
- implement **Plan From Current Design**, note/heading outline selection,
  reverse-related work, Create Task From Current Heading, and editable task
  drafts;
- let one bulk draft proposal edit titles, optional fields, board/backlog
  placement, order, origins, and dependencies between drafts or existing
  tasks;
- allocate every path/rank visibly and validate the complete proposed graph;
  any collision or cycle prevents every write;
- leave the source design byte-for-byte unchanged.

Expose the same service as Agent Slice B with the initial security profile's limit of
25 drafts. Add the Obsidian Approval Inbox, exact multi-file review, one-use
approval, proposal polling, cancellation, expiry, and conflict results. Agent
requests select a template kind/variant and typed inputs; they cannot submit a
supposedly final raw entity note.

Governing documents:

- [Design 07 — Document Provenance](spec/07-document-provenance.md)
- [Design 10 — Validation and Safe Writes](spec/10-validation-and-safe-writes.md)
- [Design 16 — Plan View](spec/16-streamlined-long-project-workflow.md#plan-view)
- [Design 17 — Agent Slice B](spec/17-agent-access-and-mcp.md#agent-slice-b--propose-tasks-from-a-document)
- [Design 18 — Project-Owned Templates](spec/18-project-note-templates.md)

Exit gate: design note to editable linked drafts to ranked backlog works in the
UI and through an approved agent proposal; source changes invalidate an open
proposal and rejection writes nothing.

## 6. Add long-project organization

Add one kind at a time, each with a domain creation profile, catalog-backed
renderer, allocator, proposal, preview, safe commit, typed edit operations,
commands, UI projection, and focused acceptance:

1. **Epic:** project-scoped lifecycle, owner/origin, derived task membership,
   progress, and unfinished-work warnings.
2. **Milestone:** required due date, lifecycle and achievement history,
   overdue derivation, project-consistent task membership, progress, and
   unfinished-work warnings.
3. **Task iteration:** Create Next Iteration through the task creation pipeline,
   preserving the iteration root/number contract while leaving owner and
   planning period unset unless selected.

Optional Epic and Milestone perspectives appear only when used or requested.
Completing or cancelling a container never changes its tasks. Relationships
remain derived from task links rather than mirrored arrays.

Governing documents:

- [Design 04 — Projects and Epics](spec/04-projects-and-epics.md)
- [Design 05 — Dependencies and Iterations](spec/05-dependencies-and-iterations.md)
- [Design 15 — Scheduling and Milestones](spec/15-scheduling-and-milestones.md)
- [Design 18 — Project-Owned Templates](spec/18-project-note-templates.md)

Exit gate: every new kind produces a valid note from a body-focused template,
preserves project consistency through edits, and remains invisible as process
ceremony in projects that do not use it.

## 7. Add optional planning periods and Agent Slice C

Implement project-scoped planning periods as canonical `type: sprint` notes.
The configurable Sprint/Cycle/Period label changes UI wording only.

- create and edit planned periods with goal and optional dates;
- assign/reassign eligible tasks from backlog or board;
- activate with required goal/dates, overlap validation, and an immutable
  aggregate commitment snapshot;
- close or cancel with one explicit outcome per assigned task, history
  append, and deterministic multi-file reporting;
- report estimated task count, unestimated count, and point totals without
  treating partial totals as complete;
- enforce owner/estimate/WIP policies only when enabled.

After all typed task operations stabilize, expose Agent Slice C through the
same Action Context and proposal services: task body/field edits, status,
rank, dependencies, epic/milestone, owner, priority/due date, points, planning
period, and iteration operations. Generic document tools cannot alter entity
frontmatter.

Governing documents:

- [Design 05 — Dependencies and Iterations](spec/05-dependencies-and-iterations.md)
- [Design 06 — Sprints](spec/06-sprints.md), limited by later
  single-project-first precedence
- [Design 16 — Optional Planning Periods](spec/16-streamlined-long-project-workflow.md#optional-planning-periods-and-estimates)
- [Design 17 — Agent Slice C](spec/17-agent-access-and-mcp.md#agent-slice-c--typed-task-editing)

Exit gate: no period is required to use the board; activation/close conflicts
cannot overwrite external edits; UI and agent operations return equivalent
changes, diagnostics, and postconditions.

## 8. Add controlled documents and Agent Slice D

Build one shared document patch engine for previewed ordinary-Markdown
operations inside permitted project roots:

- create a new document with collision refusal;
- replace or append beneath one uniquely resolved heading;
- insert a new section at a reviewed location;
- preserve frontmatter, newline style, and every untouched byte;
- reject ambiguous anchors, hidden/config paths, binaries, and paths outside
  the normalized allowlist.

Expose those operations through Agent Slice D with exact diffs, fingerprints,
approval, and audit outcomes. Initial document operations exclude whole-file
replacement, arbitrary frontmatter mutation, delete, move, and rename.
Canonical entity notes and marked template notes are refused by generic
document tools; their content changes remain typed operations.

Governing documents:

- [Design 17 — Agent Slice D](spec/17-agent-access-and-mcp.md#agent-slice-d--controlled-document-writes)
- [Design 17 — Initial Security Profile](spec/17-agent-access-and-mcp.md#initial-security-profile)
- [Design 18 — Project-Owned Templates](spec/18-project-note-templates.md)

Exit gate: every allowed patch produces an exact reviewed diff and preserves
untouched bytes; all entity, template, path, and approval bypass attempts fail
before writing.

## 9. Stabilize schemas, ship Agent Slice E, and accept v1

Freeze and version the compatibility surfaces only after their callers are
complete:

- application DTO schemas, cursors, entity references, proposal states, and
  MCP tool schemas;
- frontmatter fields, controlled values, diagnostics, action/reason codes, and
  template catalog keys;
- persisted workspace/settings state, including owner identity and local
  agent grants;
- bounded audit retention without note bodies, secrets, approval receipts, or
  replacement prose.

Ship the focused Project Weave skill after schemas stabilize. It teaches
explicit project selection, capabilities and policies, backlog versus board,
rank versus dependency, optional planning periods/points, bounded reads, and
query–propose–review–commit behavior. It does not replace live validation or
grant enforcement.

Add a 10,000-task fixture with documents, epics, milestones, and planning
periods. Record benchmark trends for full indexing, one-note updates, queries,
sequence calculation, and bounded rendering. Complete desktop, narrow-layout,
keyboard, touch, theme, pop-out, workspace restoration, live-event, conflict,
and mobile checks before claiming support.

Governing documents:

- [Design 12 — Plugin Experience](spec/12-plugin-experience.md)
- [Design 13 — Quality and Release](spec/13-quality-and-release.md)
- [Design 17 — Project Weave Skill](spec/17-agent-access-and-mcp.md#project-weave-skill)
- [Manual Checks](development/testing.md)
- [Plugin Release and Testing](development/release.md)

Exit gate: `npm run check` passes from a clean install, the export inventory is
exact, required manual checks are recorded, mobile compatibility is confirmed,
and the complete product-brief success criteria work without requiring
optional process configuration.

## Cross-cutting validation and delivery

Every slice follows the repository workflow in `AGENTS.md`:

- work on a short-lived branch and keep commits small and independently valid;
- add focused domain/application/UI/adapter tests with behavior changes;
- keep implementation status in `README.md`, implemented boundaries in
  `ARCHITECTURE.md`, and non-Git handoff state in `CURRENT_WORK.md`;
- run narrow checks while iterating and `npm run check` before handoff;
- report automated checks separately from manual Obsidian verification;
- size any release version by capability/compatibility impact, with completed
  feature slices taking a pre-1.0 minor increment;
- do not merge, push, version, release, or publish without explicit approval.

At minimum, regression coverage across the roadmap includes:

- full/incremental index equivalence and project isolation;
- deterministic ordering, cursor bounds, and no all-results DOM rendering;
- exact preview bytes, stale fingerprints, collisions, dependency cycles, and
  partial injected failures;
- unknown-field/body/newline preservation for every supported edit;
- disabled gateway, scope traversal, case/path/symlink aliases, revocation,
  oversized proposals, prompt-injection text, and approval replay;
- byte-for-byte non-writing lifecycle, settings, indexing, navigation, and
  view behavior.

## Deferred beyond this roadmap

Approved v1 does not include portfolio boards or planning periods, combined
workload/health, hard cross-project blockers, remote/public MCP, OAuth, team
accounts, embedded model runtime, unattended mutation, automatic AI task
generation, recurring tasks, Gantt/time tracking, or Community publication.
Those candidates require their documented triggers and separate reviewed
designs; they must not delay or complicate the single-project-first v1 loop.
