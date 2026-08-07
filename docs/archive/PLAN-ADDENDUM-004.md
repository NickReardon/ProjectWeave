# Project Weave Plan Addendum 004

> **Archived and non-authoritative.** This document is history. Current
> behavior is defined in [`docs/spec/`](../spec/README.md); see
> [the archive index](README.md).

## Status

Accepted v1 agent-access direction. This addendum integrates agent use into the single-project-first product plan and supersedes the earlier recommendation to wait until after the entire first vertical slice before implementing any MCP adapter.

## Objective

A developer should be able to use an external agent to understand one Project Weave project, read its tasks and design documents, determine current options and order of operations, and safely propose changes. The first write workflow creates tasks from a document or heading. Later slices add task editing and controlled creation/editing of ordinary Markdown documents.

Project Weave remains fully useful without an agent, MCP, networking, or a desktop companion. Agent access is an optional adapter over the same application services used by the Obsidian UI and tests.

## Architectural requirement now

Before building view-specific logic, define tool-neutral query and operation ports for:

- project context and enabled/used capabilities;
- task/document search and bounded reads;
- task context, related work, readiness, and dependency sequence;
- available actions and searchable options;
- validation diagnostics;
- proposal creation, inspection, cancellation, approval, and commit.

The UI, command palette, automated tests, and future agent adapters must call these services rather than reproduce domain rules.

## Delivery sequence

### Agent Slice A — Read-only project access

Deliver after the in-memory index/query contract exists and before broad write automation.

- Optional local desktop agent gateway, disabled by default.
- Explicit project selection on every material query.
- List permitted projects.
- Search/read permitted Markdown documents and task records.
- Read document outlines and exact requested sections.
- Query task context, related work, blockers, downstream work, Ready Now, and effective sequence.
- Query current actions, feature/policy state, and validation diagnostics.
- Cursor-based bounded results suitable for projects with thousands of tasks.

Exit criteria:

- [ ] An agent can answer what a project is, what a design says, what work is related, and what can happen next without direct filesystem access.
- [ ] Read scope is limited to explicitly permitted projects/content roots.
- [ ] The core plugin remains mobile-compatible and exposes no gateway on mobile.

### Agent Slice B — Create tasks from documents

This is the first agent write slice and shares behavior with Plan From Current Design.

1. Agent reads an explicitly selected design note/heading and related existing work.
2. Agent submits one or more editable task drafts with origin links and optional ranks/dependencies.
3. Project Weave resolves paths/options, validates the complete proposed graph, and returns exact created-file previews.
4. A trusted Project Weave approval UI shows every change.
5. Approval commits through Obsidian Vault/FileManager APIs; rejection/expiry writes nothing.
6. Agent can poll the proposal result and receive created task references.

The source design note remains byte-for-byte unchanged. New tasks default to backlog unless the request explicitly proposes board `todo` status.

Exit criteria:

- [ ] Agent-created task proposals obey the same schema, rank, dependency, project, collision, and safe-write rules as the UI.
- [ ] Drafts may depend on existing tasks or other drafts in the same proposal.
- [ ] A changed source or affected target invalidates approval rather than creating stale tasks.
- [ ] No model-supplied boolean can substitute for trusted approval.

### Agent Slice C — Typed task edits

Add proposal operations for task body/field updates, backlog/board/status moves, ranking, dependencies, epic/milestone, owner, priority, due date, estimate, and planning period.

Task frontmatter is changed only through typed domain operations. Generic document patches cannot alter reserved Project Weave entity fields.

### Agent Slice D — Controlled document creation and editing

Add proposal operations for ordinary Markdown documents inside permitted project roots:

- create a new Markdown document with collision checking;
- replace a document body;
- replace or append beneath an unambiguous heading;
- insert a new section;
- preview exact before/after content and diff.

Initial document operations do not delete, move, rename, modify binary files, access `.obsidian`, or rewrite Project Weave entity frontmatter. Every operation is scoped, fingerprinted, previewed, and approved.

### Agent Slice E — Skill and broader automation

Ship a small Project Weave skill once the read/proposal schemas stabilize. It teaches project selection, backlog versus board, rank versus dependency, optional periods/estimates, bounded search, and query–propose–review–commit behavior.

Time-limited or operation-scoped auto-approval may be evaluated only after audited manual-approval workflows prove safe. A built-in model runtime/conversational UI remains deferred.

## Agent-facing operation boundary

Allowed adapter operations are domain queries, typed task proposals, controlled Markdown proposals, and proposal lifecycle operations. Do not expose direct filesystem access, arbitrary frontmatter mutation, plugin-setting access, deletion, or raw `edit_file`/`write_file` tools.

## Project and access scope

Agent gateway access is local configuration and is never enabled merely by vault content. Local settings choose:

- permitted project notes;
- permitted Markdown content roots;
- read task/document scope;
- allowed proposal categories;
- whether full document bodies may be returned;
- client connection/approval state.

Entity notes belonging to a permitted project and explicitly origin-linked design notes may be included according to those grants. Paths are normalized and hidden/plugin/config folders are always excluded.

## Proposal and approval rules

- Proposals use server-minted opaque handles with explicit expiry.
- A proposal captures base index revision, all relevant fingerprints, exact changes, diagnostics, warnings, and postconditions.
- Index revision is context, not a blanket lock: unrelated project changes do not invalidate a proposal when touched inputs/global constraints remain valid.
- Approval is granted by trusted UI or a supported secure client flow and produces a single-use authorization; the agent cannot self-assert confirmation.
- Commit rechecks current fingerprints and affected invariants.
- Partial failures report written and unwritten files precisely.
- Agent source/client metadata is recorded in a redacted operation report, not silently inserted into project notes.

## Transport boundary

Start with a local desktop adapter. The MCP transport/bridge is replaceable and must not own domain logic or write vault files directly. All writes execute inside the Obsidian application service/vault adapter. Remote HTTP access, OAuth, team identity, and unattended automation are later designs.

## Normative design

Detailed schemas, tool surface, document-write boundary, security model, and tests are defined in [Design 17](../spec/17-agent-access-and-mcp.md).
