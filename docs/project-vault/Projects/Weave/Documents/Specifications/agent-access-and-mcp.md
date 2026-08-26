---
type: spec
area: agent-access
status: current
canonical: true
related_decisions: ["0004", "0018", "0021"]
---

# Agent Access and MCP Adapter

## Scope

Agent access is staged and optional. This document extends the single-project
workflow with agent access; it does not make MCP, networking, or an agent
runtime a requirement for the core plugin, and the plugin is fully usable
without any of them.

Which slices are built is tracked by the Epic notes in
[`../../Epics/`](../../Epics/), and the resulting capability is
described in [`README.md`](../../../../../../README.md). Neither is recorded here.

## Goal

Allow a developer to connect an external agent to one permitted Project Weave project so the agent can:

1. read project context, tasks, designs, relationships, diagnostics, and order of operations;
2. propose new tasks from a selected document or heading;
3. later propose task edits and controlled ordinary-Markdown edits;
4. obtain trusted, current Project Weave decisions instead of reconstructing domain rules;
5. commit only through the same validated proposal/write system as the UI.

## Non-goals for the initial adapter

- Embedded model/provider or conversational UI.
- Agent access on mobile.
- Remote/public MCP endpoint.
- Portfolio queries or cross-project planning.
- Direct filesystem, arbitrary frontmatter, deletion, move, rename, binary, or `.obsidian` access.
- Unattended/background content mutation.
- Automatic task regeneration when a design changes.

## Architecture

```text
Obsidian UI / commands ─┐
Tests / fixture adapter ├─> tool-neutral application API
Agent gateway / MCP ────┘       │
                                ├─ query services -> immutable index
                                ├─ action context -> domain policies
                                └─ proposal service -> write coordinator
                                                        │
                                                        └─ Obsidian Vault/FileManager
```

The MCP adapter translates schemas only. It contains no entity parsing, readiness, rank, cycle, option eligibility, validation, or write logic. The external companion never writes vault files directly.

## Tool-neutral application ports

Implementation names may vary, but the core must expose these responsibilities independently of Obsidian views and MCP:

```ts
interface ProjectQueryService {
  listPermittedProjects(input: ListProjectsInput): Promise<Page<ProjectSummary>>;
  getProjectContext(input: ProjectContextInput): Promise<QueryResult<ProjectContext>>;
}

interface SearchService {
  search(input: SearchInput): Promise<Page<SearchHit>>;
  readNote(input: ReadNoteInput): Promise<QueryResult<NoteRead>>;
}

interface WorkQueryService {
  getTaskContext(input: TaskContextInput): Promise<QueryResult<TaskContext>>;
  getRelatedWork(input: RelatedWorkInput): Promise<Page<RelatedWork>>;
  getFocus(input: FocusInput): Promise<QueryResult<FocusResult>>;
  getSequence(input: SequenceInput): Promise<QueryResult<SequenceResult>>;
  getActionContext(input: ActionContextInput): Promise<QueryResult<ActionContext>>;
  getCreationContext(input: CreationContextInput): Promise<QueryResult<CreationContext>>;
}

interface ProposalService {
  propose(input: DomainOperation): Promise<Proposal>;
  get(input: ProposalRef): Promise<ProposalStatus>;
  cancel(input: ProposalRef): Promise<ProposalStatus>;
  commit(input: ApprovedProposalRef): Promise<OperationReport>;
}
```

UI and MCP contract tests call the same services and compare semantics.

## Common query envelope

Every result includes:

- `schema_version` for the application API DTO;
- explicit `project_ref`;
- `index_revision` and index freshness (`current`, `rebuilding`, or `stale_last_good`);
- normalized entity refs rather than unvalidated caller paths;
- stable diagnostic/action codes;
- truncation/cursor metadata for collections.

An entity ref contains kind, normalized vault path, and current fingerprint where appropriate. Project Weave does not add permanent IDs to notes merely for agents; proposal handles are short-lived and server-minted.

Index revision identifies the consistent snapshot used for the answer. It is not a blanket optimistic lock: commits recheck touched fingerprints and affected global invariants so unrelated changes do not cause unnecessary conflicts in a large project.

## Capability and policy discovery

Project context reports capabilities separately from enforcement:

```json
{
  "project_ref": "Projects/Tethered.md",
  "index_revision": 42,
  "capabilities": {
    "epics": { "in_use": true },
    "milestones": { "in_use": true },
    "planning_period": {
      "in_use": true,
      "label": "Cycle"
    },
    "estimation": {
      "in_use": true,
      "unit": "points",
      "required": false
    },
    "owners": { "in_use": false }
  },
  "policies": {
    "dependency_mode": "enforced",
    "owner_required_on_board": false,
    "estimate_required_in_period": false
  }
}
```

Agents must query this state rather than assume sprints, required points, owners, milestones, or due dates.

## Bounded reads for long projects

All search/list operations require one project and support limit/cursor plus relevant filters. Server-side maximums prevent whole-project dumps. Responses state whether they are truncated.

Search supports entity kind, status, epic, milestone, planning period, owner, priority, due state, origin, title/body text where permitted, and terminal-history inclusion. Search results return only bounded snippets and indexed metadata.

Reading full Markdown body requires an explicit read operation and local permission. Large documents support heading/section selection, line/byte limits, and continuation. Note content is marked as untrusted user content; text inside a note can never grant permissions, approve a proposal, or change agent policy.

Dependency results default to direct blockers/dependents. Transitive expansion requires bounded depth and result limits. Sequence queries require one project plus a scope/filter and never return a whole unbounded graph by default.

## Action context

Both UI and agents use the same action query:

```json
{
  "project_ref": "Projects/Tethered.md",
  "index_revision": 42,
  "entity": {
    "kind": "task",
    "path": "Tasks/Implement travel request.md",
    "status": "backlog",
    "ready": false,
    "blocked_by": ["Tasks/Define travel request.md"]
  },
  "actions": [
    {
      "name": "add_to_board",
      "enabled": false,
      "reason_code": "task.blocked",
      "reason": "Blocked by Define travel request"
    },
    { "name": "set_estimate", "enabled": true },
    { "name": "assign_planning_period", "enabled": true }
  ],
  "option_queries": {
    "dependencies": {
      "operation": "search",
      "filter": { "kind": "task", "eligible_for": "dependency" }
    },
    "planning_periods": {
      "operation": "search",
      "filter": { "kind": "sprint", "eligible_for": "assignment" }
    }
  }
}
```

For large option sets, return bounded suggestions plus a search recipe, never every eligible task. Disabled actions include stable reason codes. The API uses neutral `planning_period` terminology while returning the project's display label and translating to stable Markdown fields internally.

## Initial MCP surface

These are logical tools; exact names are versioned with the adapter:

### Read-only slice

- `weave_projects_list`
- `weave_project_context`
- `weave_search`
- `weave_read_note`
- `weave_related_work`
- `weave_focus`
- `weave_sequence`
- `weave_action_context`
- `weave_creation_context`
- `weave_diagnostics`

### Proposal slice

- `weave_propose_tasks_from_document`
- `weave_propose_task_update`
- `weave_propose_task_order`
- `weave_propose_document_change`
- `weave_proposal_get`
- `weave_proposal_cancel`
- `weave_proposal_commit` (only with trusted one-use approval)

The adapter may return links to protected read-only resources for note sections or proposal diffs. It must not expose an enumerable resource containing every vault note.

## Agent Slice A — read-only behavior

The local gateway is disabled by default. Enabling it requires a local access
grant for exactly one project and optional content roots. The agent can then:

- identify permitted projects;
- read project workflow/capability context;
- search entity metadata and permitted documents;
- read exact selected documents/sections;
- inspect tasks and their Markdown bodies;
- query related tasks for a design note/heading;
- query Ready Now, My Work (when a local owner is supplied), blockers, dependents, and derived sequence;
- retrieve validation diagnostics and available actions.

Read-only mode registers and advertises only the ten read tools above. There is
no write/proposal operation in the companion or local bridge inventory.

## Agent Slice B — propose tasks from a document

### Input

```json
{
  "project_ref": "Projects/Tethered.md",
  "source": {
    "note_ref": "Design/Travel.md",
    "heading": "Requirements",
    "fingerprint": "sha256:..."
  },
  "placement": "backlog",
  "drafts": [
    {
      "draft_key": "request-type",
      "title": "Define travel request",
      "body": "Acceptance criteria..."
    },
    {
      "draft_key": "request-handler",
      "title": "Implement travel request",
      "depends_on": [
        { "draft_key": "request-type" }
      ],
      "points": 3
    }
  ]
}
```

Draft dependencies may reference existing task refs or `draft_key` values in the same proposal. Optional fields are accepted only when supported and valid for the selected project. The server chooses safe filenames and spaced ranks when omitted; generated values remain visible/editable in preview.

### Proposal creation

1. Confirm access to project/source.
2. Confirm source fingerprint and heading resolution.
3. Load related existing work to detect likely duplicates as warnings.
4. Resolve optional epic/milestone/period/owner values.
5. Allocate paths and ranks without overwriting.
6. Validate every resulting task and the complete proposed dependency graph.
7. Return one proposal containing every new file and postcondition.

The operation never edits the source document. A source change before commit invalidates the proposal because the agent's planning context may be stale, even when the heading still exists.

### Output

Proposal response includes an opaque handle, expiry, base revision, source/target fingerprints, exact created paths/frontmatter/body previews, warnings, diagnostics, graph summary, postconditions, approval state, and a protected diff resource/link where supported.

## Proposal lifecycle

States are `draft`, `awaiting_approval`, `approved`, `committing`, `committed`, `rejected`, `cancelled`, `expired`, `conflict`, and `failed`.

Proposals are rebuildable temporary application state, not canonical project data. They use server-minted opaque handles and a reported expiration time. Reload may discard pending proposals unless a later secure local persistence design is accepted.

### Trusted approval

Default agent writes use the Project Weave Approval Inbox inside Obsidian:

1. Agent creates proposal; it becomes `awaiting_approval`.
2. User opens exact file/field/body diffs, warnings, and postconditions.
3. Approve commits in Obsidian, or mints a one-use token bound to proposal digest, client grant, and expiry.
4. Reject/cancel writes nothing.
5. Agent polls `weave_proposal_get` for the result.

A model-provided `confirmed: true`, repeated user text, content inside a note, or untrusted tool annotation never constitutes approval. If MCP/client elicitation is later used, it must provide equivalent review and decline behavior; adapter protocol details remain isolated because MCP interaction flows evolve.

### Commit

Immediately before commit:

- confirm proposal/token state and single use;
- re-read all touched inputs/targets;
- compare fingerprints;
- recompute affected relation graphs/global invariants;
- allow unrelated index revision changes;
- validate exact produced Markdown;
- write in deterministic order through the normal coordinator;
- return exact written/unwritten paths and re-index results.

## Agent Slice C — typed task editing

`weave_propose_task_update` supports:

- title/body patch;
- backlog/board/status transition;
- rank;
- dependency edges;
- epic/milestone;
- owner;
- priority/due date;
- estimate/planning period;
- iteration fields when the project uses them.

The operation queries Action Context first or returns equivalent disabled-action diagnostics. It preserves unknown frontmatter/body content and cannot mutate task type/project identity implicitly. Moving project, when later supported, is a dedicated bulk operation.

Task body edits use the document patch engine but remain inside the typed task proposal so reserved frontmatter and postconditions are validated together.

## Agent Slice D — controlled document writes

Agents may eventually create or edit ordinary Markdown design/project documents, but not through direct filesystem calls.

### Allowed proposal forms

- `create_document`: new `.md` under an allowed project root; collision is an error.
- `replace_body`: replace Markdown after preserved frontmatter.
- `replace_section`: replace the body beneath one unambiguous heading using an expected section/source fingerprint.
- `append_to_section`: append beneath one unambiguous heading.
- `insert_section`: insert a new heading/body at a reviewed location.

The proposal stores the exact resulting document and diff. Commit uses current-content processing and aborts on relevant change.

### Protected boundaries

- Only `.md` files under local permitted content roots.
- Never `.obsidian`, hidden/plugin/config paths, attachments, or paths outside the normalized allowlist.
- No delete, move, or rename in the initial document slice.
- Generic document changes preserve existing frontmatter.
- Project Weave entity notes (`project`, `task`, `epic`, `milestone`, `sprint`) cannot have reserved frontmatter changed through document tools.
- Generic project configuration/security changes are excluded.
- Symlink/path-alias escapes and Windows case/path normalization are rejected.

Creating a design document may include a small validated metadata block such as title/project linkage; arbitrary frontmatter creation requires a later explicit design.

## Access and privacy

Agent access grants are local plugin settings, not synced vault content. A grant binds:

- permitted client/connection;
- permitted project refs;
- permitted normalized content roots;
- metadata-only versus full-body reads;
- read, task-proposal, task-edit, and document-proposal scopes;
- creation/expiry/revocation timestamps.

The default is disabled with no listener/bridge. Revocation invalidates outstanding connection/approval credentials. Plugin settings, caches, `.obsidian`, and unrelated projects are never exposed.

Search/read responses should minimize data. Logs record operation/client/path/field/error metadata and omit note bodies by default. Agents are not automatically assigned as task owners and MCP client identity is not treated as a team member identity.

Remote HTTP access is deferred. If introduced, it requires a separate authentication/authorization design and protocol-conformant token validation rather than reusing local bridge secrets.

## Desktop bridge and mobile boundary

The transport is a stdio MCP companion connected to a bridge inside the plugin over authenticated local IPC: a named pipe on Windows, a Unix domain socket elsewhere. ADR 0018 records the choice and its rationale. Requirements:

- bind only locally, and open no TCP port;
- bind the Unix-domain socket file owner-only (mode 0600) so only the user
  running Obsidian can open it; a named pipe on Windows has no mode bits and
  is unaffected;
- authenticate every companion connection to one vault grant, because the
  pipe or socket is reachable by other local processes run by that same
  user and is not itself authentication;
- expose the application API, not filesystem primitives;
- execute writes inside Obsidian;
- close/revoke on plugin unload or grant disable;
- conditionally load desktop facilities so core plugin startup/mobile do not depend on them;
- keep `isDesktopOnly: false` for the core v1 plugin;
- offer neither gateway enablement nor grant creation in settings when the
  plugin is not running on the desktop, because agent access on mobile is a
  non-goal above: a toggle there is inert, and creation is worse than inert,
  since there is no endpoint to name and a grant's configuration is delivered
  exactly once. Grants already created on a desktop stay listed and revocable
  on every platform, so a credential can always be withdrawn from the device
  in hand;
- pin the MCP protocol revision and SDK to exact tested versions rather than ranges, so a protocol revision never changes underneath a tested adapter. The adapter targets MCP revision `2025-06-18`, using the official TypeScript SDK. Proposal handles stay independent of transport sessions, so a version bump is an isolated, testable change.

The companion may start in any working directory, on any volume, with no relationship on disk to the vault it reaches. Nothing about agent access depends on the repository and the vault sharing a location.

A companion that independently parses and directly edits the vault is not acceptable.

### Startup handshake and failure guidance

Missing, stale, incompatible, revoked, and removed companions fail with
actionable guidance and never affect core plugin use. This applies from the
moment the companion process starts, not only once an agent issues its first
real request:

- Required companion configuration (`PROJECT_WEAVE_ENDPOINT`,
  `PROJECT_WEAVE_GRANT_ID`, `PROJECT_WEAVE_GRANT_SECRET`) is resolved inside
  the async entry point, never at module load. A missing or blank variable
  prints one actionable line naming every missing variable together to
  stderr and exits non-zero; it never surfaces as an unhandled stack trace.
- Before serving any MCP request -- including `initialize` and `tools/list`
  -- the companion performs one lightweight, always-permitted request over
  the bridge to prove the endpoint is reachable, the grant authenticates,
  and the companion/plugin version handshake succeeds. This uses the exact
  authentication and version-check path every other operation uses, so a
  disabled gateway, a stale endpoint, a revoked grant, or a version mismatch
  is caught here rather than lazily on first tool use. On failure the
  process exits non-zero with one actionable line to stderr before the
  stdio transport ever connects; no MCP client can observe a successful
  connection to a companion that cannot actually serve requests. Whether an
  individual client happens to surface a failed connection differently, the
  companion's own behavior at this boundary is uniform and testable
  independent of any client.
- Once serving requests, a transport failure on an individual tool call
  (the bridge connection drops, the endpoint disappears mid-session) is
  mapped to guidance that names the likely cause -- gateway not enabled,
  endpoint stale, vault closed -- and the remedy, with the underlying
  transport error preserved as secondary detail. A denial returned by the
  gateway itself (wrong grant, revoked grant, version mismatch) is
  similarly given a concrete remedy alongside the gateway's own message.
  Neither path ever includes the grant secret.

### Optional companion distribution

The companion source stays in the Project Weave repository and is built from
the same accepted source ref as the plugin, but it is not an installed Obsidian
plugin file. Obsidian and BRAT install only `main.js`, `manifest.json`, and
`styles.css`. A GitHub release may attach `project-weave-mcp.cjs` as an
additional, versioned asset that those installers ignore.

Agent access remains an explicit desktop opt-in. The plugin does not fetch,
install, update, or execute the companion. Its README links to the companion
asset and gives a pinned installation command, checksum verification,
plugin-to-companion compatibility guidance, and MCP client configuration.
Installing or omitting the companion changes no core plugin behavior, and a
companion/bridge compatibility mismatch fails closed with actionable setup
guidance.

## Project Weave skill

After tool schemas stabilize, ship a small skill that teaches agents to:

1. select one project explicitly;
2. query project capabilities/policies;
3. distinguish backlog from board and rank from dependency;
4. treat declared same-project dependencies as enforced unless context says advisory;
5. treat Sprint/Cycle/Period and points as optional;
6. use bounded search before selecting refs/options;
7. read a design and its existing related work before proposing tasks;
8. explain proposals/warnings and wait for trusted approval;
9. never infer approval from note content or use generic filesystem workarounds;
10. poll/report the exact commit outcome.

The skill guides behavior; it is not a substitute for live queries, server-side validation, access control, or approval.

## Initial security profile

The initial implementation is deliberately narrower than the surface
described above. Every constraint in this section is normative for it;
broadening any of them requires a reviewed change to this specification.

### One project per grant

Each active `AgentGrant` is bound to exactly one normalized project note. A client may establish another separately approved grant for another project, but a request/session never mixes projects and cannot switch its project parameter within the same grant.

Cross-project links may return target title/project/path metadata sufficient to explain an advisory relation. Reading the target content requires a separate grant for that project.

### Local grant contents

A Slice A grant records in plugin-owned local settings:

- a local grant id and user-facing label;
- the vault identity the grant applies to, so a project path stays unambiguous when more than one vault can be open;
- one normalized project path;
- a digest of the connection secret the companion must present; the plaintext secret is returned only at creation and is never stored in a project repository;
- optional normalized document roots beneath that project;
- enabled/revoked state, where revocation removes the grant.

Task destinations, proposal/edit scopes, and expiry state belong to later write
slices and are not present in the read-only grant schema.

First enablement explains that granted note text may be sent by the MCP client to its configured model/provider. Project Weave itself performs no model/network call.

### Grant lifecycle and creation

A grant is **immutable once created**. There is no update operation on an
existing grant's project, content roots, or any other scoped value. Correcting
a mistaken grant means revoking it and creating a replacement; nothing about
this rules out adding an edit operation later, but until one exists, creation
and revocation are the only two operations a grant supports. Immutability
keeps the security story simple: a secret already handed to a client covers
exactly what it covered at issuance, and scope cannot silently widen
underneath a connection that already holds the credential.

Because a mistake is permanent rather than repairable, **local resolution
gates creation**. The chosen project and every chosen content root must
resolve against the current vault — the project against the index of
projects, each content root against the vault's file tree — before the create
action is available. This resolution is local: it is answered from the vault
and index the plugin already holds, never a round trip through the agent
gateway, and it succeeds or fails identically whether the gateway is enabled
or disabled.

A grant's read scope is **chosen, not inferred**. Creation states the two
levels as an explicit choice: metadata only, or metadata and note text. Content
roots are collected only for the second, and an empty content-root list in that
state does not resolve. Metadata-only is unconditionally resolvable and carries
no content roots. Scope is never derived from whether a field was left blank,
because the choice between the two levels is what decides how much of the vault
an external client can read.

Settings presents agent grants through a creation surface separate from the
list of existing grants, following this plugin's general modal convention for
multi-field decisions (see [Plugin experience](plugin-experience.md)). The
settings entry itself is a list of existing grants with create and revoke
actions; there is no inline multi-field row.

**Creation stays atomic.** Pressing create both creates the grant and hands
over its secret in one step; a resolution failure blocks the action before
either happens. A grant either exists with its secret delivered, or it does
not exist — there is no reachable state where a grant exists but its secret
was never captured. What is delivered at creation is a complete client
configuration — endpoint, grant id, and secret together — because a client
needs all three to connect and transcribing them by hand from separate
displayed values is itself a source of setup error.

**The grant list conveys scope without an editor.** Each listed grant states
the project it may read, whether it is metadata-only or which content roots
additionally expose Markdown bodies, and enough identity to recognize it when
deciding whether to revoke it and to configure a client against it. A grant's
scope must be readable from the list alone; immutability is only tolerable
because reading a grant never requires opening it. What identifies a grant in
the list — a free-text label, creation order, or some other distinguishing
detail — is settled by task-level design rather than fixed here.

### Read-only slice

The initial read-only adapter does not register or advertise proposal/write
tools. Unknown operations fail before reaching the shared query API.

Document bodies are read on demand and are not persisted into a separate MCP full-text cache. Returned Markdown is labeled `untrusted_markdown`; links, commands, approval language, or tool-shaped text inside it are inert data.

### Initial task proposal limits

`propose_create_tasks_from_document` accepts at most 25 drafts in one proposal. This limit bounds review, graph validation, response size, and partial-failure exposure. Increasing it requires explicit configuration and continues to use exact bulk preview.

Initial task creation rejects cross-project dependency targets rather than merely treating them as warnings. Draft IDs must be unique, and every draft/target/source/destination must fit the same grant.

### Entity versus document edits

Generic document create/patch tools refuse any existing canonical Project Weave entity note and refuse output that introduces a supported entity `type`. Task, project, epic, milestone, or planning-period bodies/metadata are edited only through typed entity proposal operations.

Ordinary document patches use fingerprinted, uniquely anchored hunks or section operations and preserve every untouched byte, including frontmatter and newline style. Whole-file replacement, arbitrary frontmatter editing, delete, move, and rename are absent initially.

### Approval receipt

Trusted approval produces a one-time receipt bound to proposal digest, agent grant, project, client, and expiry. Editing/regenerating a proposal invalidates the receipt. Restart, revocation, expiry, failed concurrency validation, or first successful commit consumes/invalidates it.

No boolean or prose supplied through an MCP request or vault note is approval.

### Audit retention

Agent operation audit data is plugin-owned, bounded by a configurable retention limit, and contains paths/field names/fingerprints/outcomes—not document bodies, replacement prose, frontmatter values, approval receipts, or connection secrets.

### Required negative tests

- A one-project grant cannot query or mutate another project's task content.
- Absolute, traversal, mixed-separator, case-variant, symlink/alias, hidden, `.obsidian`, non-Markdown, and ungranted paths fail.
- Revoked/expired grants expose neither reads nor proposals.
- Prompt-injection text cannot expand scope, invoke operations, or approve a proposal.
- Oversized task proposals and cross-project task dependencies write zero files.
- Generic document tools reject entity notes and attempts to create entity frontmatter.
- Fabricated, replayed, wrong-client, wrong-project, expired, or digest-mismatched approval receipts cannot commit.

## Testing

### Contract equivalence

- UI and MCP calls over the same fixture produce equivalent Action Context, readiness, eligible options, proposal changes, diagnostics, and postconditions.
- DTO schema versions have backward-compatibility tests.

### Scale

- 10,000-task fixture queries are bounded/cursor-based.
- Search/sequence never serializes the entire project by default.
- Single-note changes use targeted index/graph updates.
- Large note reads enforce section/size/continuation bounds.

### Access control

- Disabled gateway exposes nothing and opens no endpoint.
- Project/root/body-read/scope grants are independently enforced.
- Traversal, symlink/alias, hidden path, `.obsidian`, case-variation, and unrelated-project attempts fail.
- Revoked/expired clients and proposals fail closed.
- Note text claiming approval or containing tool-like instructions changes no authorization state.

### Proposals and concurrency

- Spoofed/reused/mismatched approval tokens fail.
- Changed source, target, or affected relation invalidates commit.
- Unrelated index changes do not invalidate a still-correct proposal.
- Draft-to-draft dependencies resolve and cycles fail before writing.
- Collision, duplicate warning, partial injected failure, expiry, rejection, and reload behavior are exact.

### Document boundaries

- Document patches preserve frontmatter and unaffected body bytes.
- Entity reserved frontmatter cannot be changed through document tools.
- Create/section/append operations generate reviewed exact diffs.
- Delete/move/rename/binary/config operations are absent and rejected.

### Compatibility

- Core plugin and all non-agent features load/work on mobile without desktop modules.
- Gateway unload closes resources and writes no content.
- Pinned MCP protocol/SDK conformance is tested independently of the application API.

## Acceptance criteria

- An external agent can read one permitted project's design and tasks without direct vault access.
- The agent can retrieve blockers, dependents, Ready Now, related work, and current valid actions from Project Weave.
- Results remain bounded and useful for a long game project.
- The agent can propose multiple tasks from one document/heading, including draft-to-draft dependencies and origin links.
- The user can review and approve exact task-note creation; rejection or stale context writes nothing.
- Later typed task and controlled document proposals cannot bypass entity/frontmatter/path protections.
- UI and agent behavior come from one application/domain implementation.
- MCP remains an optional desktop adapter and does not change the mobile/core product contract.

## Protocol references

MCP distinguishes application-controlled resources, user-controlled prompts, and model-controlled tools; the adapter may use all three but treats tool invocations as untrusted until Project Weave authorization and validation succeed: [MCP server primitives](https://modelcontextprotocol.io/specification/2025-06-18/server/index) and [tools](https://modelcontextprotocol.io/specification/2025-06-18/server/tools).

MCP version/interaction details are isolated because official revisions and elicitation/task flows evolve. Pin the implementation to a tested stable SDK/protocol and keep application proposal handles independent of transport sessions: [MCP versioning](https://modelcontextprotocol.io/docs/learn/versioning).
