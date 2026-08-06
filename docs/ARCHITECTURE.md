# Architecture

## Status

The implemented slices implement the shared core and persistent project
workbench described by Designs 01, 02, 09, 16, and 17. ADRs 0006 and 0007
record the platform baseline and workspace-view decisions. The deterministic
task-template renderer, project template resolver, and exact task-creation
proposal builder implement the first non-writing creation path from Plan
Addendum 005, Design 18, Design 10, and ADR 0005.

## Dependency direction

```text
Obsidian workspace view, commands, and modal
  -> stable read publications
      -> workbench projection or application query API
      -> immutable index snapshot
          -> Markdown parser and domain rules

Obsidian Vault and MetadataCache
  -> persisted project-root scope
      -> read-only VaultReader and LinkResolver ports
      -> index coordinator and builder

task creation preview command and modal
  -> task creation commit service
      -> create-only NoteWriter port
  -> task creation preview service
      -> task target-path and rank allocation
          -> shared vault path safety and filename derivation
      -> task creation proposal service
      -> project task-template resolver
          -> read-only VaultReader and LinkResolver ports
      -> creation context, template source, and invariants
          -> task template renderer
              -> template parser and Markdown parser
```

Allocation sits beside the proposal service rather than inside it: the preview
service allocates a path and rank, then proposes. The proposal service's input
contract is unchanged and it remains the authority on target collisions. The
preview surface reads and renders only; no write-capable port exists for it to
call.

Dependencies point inward. Domain, indexing, and application modules do not
import Obsidian, Node, Electron, views, or future MCP code.

## Implemented boundaries

- **Domain:** supported entities, controlled values, diagnostics, wiki-link
  parsing, template exclusion, workflow defaults, and readiness concepts live
  under src/domain. src/domain/vault-path holds the single path-safety gate
  shared by template rendering and target allocation, plus title-to-filename
  derivation. It rejects unsafe or unnormalized paths rather than repairing
  them, so a caller's mistake cannot silently move a write.
- **Templates:** src/domain/templates parses a Markdown template into reserved
  metadata, declared typed inputs, frontmatter properties, and a body, then
  renders one task note from an injected creation context. Rendering is a pure
  function of its request: it reads no clock, environment, network, or file.
  Precedence runs template static values, context defaults and explicit typed
  inputs, then the entity-type and selected-project invariant overlay. The
  packaged minimal task and project templates are embedded as plugin assets,
  and every rendered note is re-parsed with the ordinary entity parser before
  it is returned. The renderer produces content only; it has no write capability and
  no proposal, path-allocation, or template-map resolution behavior; those
  concerns stay in application services. A project renderer sits beside the task
  one on the same terms and with the smaller context a project carries — no
  project relation, rank, or dependencies. What the two share — declared inputs,
  clock variables, the precedence rewrite, the invariant overlay, and the
  target-path guard — lives in src/domain/templates/creation-context; what makes
  a kind a kind stays in its own renderer.
- **Indexing:** IndexBuilder deterministically publishes a complete immutable
  snapshot. IndexCoordinator owns asynchronous rebuilds, coalesced targeted
  reads, revisions, stale-last-good state, and unload cancellation.
- **Application:** ProjectWeaveQueryApi returns schema-versioned, explicitly
  project-scoped, bounded DTOs for project context, task context, and Ready Now.
  ProjectWeaveReadSource publishes snapshot-bound query APIs across replaceable
  indexing runtimes. The pure Project Workbench projection derives all visible
  counts, selection states, bounded project and unassigned diagnostics, Ready
  ordering, and bounded task results filtered by status, text, priority, epic,
  milestone, owner, and due state from one publication. The UI injects its
  current local calendar date; application filtering does not read a clock.
  Task results remain project-scoped and deterministically order canonical
  status, explicit rank, priority, then normalized path. Diagnostic details
  preserve severity, code, field, recovery guidance, and related-note paths for
  exact read-only
  navigation. Unassigned diagnostics cover malformed entities and unresolved
  ownership without guessing from folder layout.
- **Creation proposals:** TaskTemplateResolver reads project-owned task
  mappings through the existing read-only ports, resolves default/named
  variants, and fails closed on explicit reference errors.
  TaskCreationProposalService renders one exact create proposal with
  fingerprints, target-absence and index-freshness preconditions, exact
  frontmatter/content, and expected postconditions. Neither service can write.
- **Creation allocation:** src/application/task-creation-allocator derives a
  task's target path from the folder holding its project note, honors an
  optional subfolder, sanitizes the title into a filename, and suggests the
  first free name; it allocates rank one 1000-gap past the project's largest
  existing rank. Both allocators are pure and bounded, returning diagnostics
  rather than throwing. Suggesting a free path is not reserving one:
  TaskCreationProposalService remains the authority on target collisions. ADR
  0008 records the folder, filename, collision, and rank rules.
  src/application/project-creation-allocator does the same for a project note,
  which lands at `<root>/<Title>/Project.md` per ADR 0012. Its collision unit is
  the folder rather than the note, because ADR 0008 derives a project's task
  folder from where its project note sits.
- **Task search:** the workbench projection matches search text through the
  `TaskSearchMatcher` contract in src/application/task-search, defaulting to
  the literal case-insensitive substring behavior. A caller may inject another
  strategy, including one backed by Obsidian, which application code cannot
  import itself. Whitespace-token and subsequence strategies ship beside the
  default behind a named registry, but only the default has a runtime caller;
  a persisted user choice is additive and not built. The projection filters on
  match scores without ordering by them, so relevance ranking remains a sort
  change rather than a matcher change. The contract sees only what
  `TaskSearchCandidate` carries, so
  matching note bodies would be a snapshot decision rather than a matcher
  change — indexing discards content after parsing.
- **Creation commit:** NoteCreationCommitService is the only path to a vault
  write. It re-reads the proposal's read set and compares fingerprints,
  re-checks target absence, re-validates the produced note in memory, then
  writes once, per the single-file sequence in design 10. It writes the
  proposal's own bytes rather than re-rendering, so a confirmed preview cannot
  become a different note. A packaged template is exempt from the re-read: it
  ships in the plugin build and has no vault note behind it. Every failure
  reports that the vault is unchanged.
- **Creation preview:** TaskCreationPreviewService composes allocation with the
  proposal service into one reviewable result, keeping the chosen path and rank
  visible even when the proposal fails. Its operation id is derived from the
  index revision and target rather than generated, so a preview is
  reproducible. The UI injects the civil clock; the service reads none.
- **UI:** the Project Workbench and note-diagnostic banner consume the stable
  read publication. The banner mounts through public Markdown view containers,
  refreshes on workspace and index publications, and never edits Markdown. The
  task creation preview modal renders a proposal and offers no confirm action,
  because no coordinator exists to commit one; it discards in-flight previews
  on close so a late response cannot repaint a dismissed draft.
- **Ports:** VaultReader has read/list methods only. LinkResolver isolates
  Obsidian link semantics. NoteWriter is the sole write-capable port and
  exposes exactly one operation, create-a-note-that-does-not-exist; it cannot
  express overwrite, move, or delete, and only the commit service may use it.
- **Adapters:** src/adapters/obsidian is the only vault/API integration. It uses
  Vault.cachedRead, MetadataCache link resolution, and TFile metadata, and
  filters paths before content reads. ObsidianNoteWriter creates through
  Vault.create and Vault.createFolder, never the filesystem, and refuses any
  path that is not a safe normalized Markdown path inside the configured
  project roots. Parent folders are created only as part of a confirmed
  creation that needs them.
- **Entry point/UI:** src/main.ts registers the persistent workbench before
  layout restoration, defers indexing until layout readiness, registers managed
  scope-aware vault events, owns runtime replacement after a scope change, and
  exposes ribbon, command, settings, workbench, and compact Ready Now entry
  points. The workbench stores only its selected project path in Obsidian
  workspace state; All Tasks filters are transient UI inputs to the pure
  publication projection and do not persist derived task-list state.

## Lifecycle and safety

Plugin load constructs services and commands but does not scan synchronously.
After layout readiness it registers events and starts an asynchronous full
read of configured project roots. Create/modify/delete/rename events are
filtered against the active scope and coalesced; an ordinary update rereads
only affected notes and rebuilds derived projections from cached sources.
Changing roots persists settings before atomically replacing the reader and
coordinator. One plugin-lifetime read source binds the replacement before the
old coordinator is disposed, publishes an empty rebuilding snapshot
immediately, and prevents callbacks from a retired runtime reaching open views.
Unload cancels pending publication and timers and disposes view subscriptions.
None of these paths has access to a write-capable vault port.

Content-changing work will enter through separate typed Template, Proposal, and
Write Coordinator services. Views and future agent adapters must call those
services rather than acquire generic file mutation access. Template rendering,
project task-template resolution, and one-file task proposal construction are
implemented. The proposal carries the read set and exact output a future
coordinator must recheck after confirmation. No write coordinator or runtime
caller exists, so nothing in the current plugin can commit a proposed note.

## Release boundary

The repository contains source, tests, fixtures, and design material. The
installable dist directory contains exactly main.js, manifest.json, and
styles.css. The core plugin remains mobile-compatible; desktop-only agent
transport must be conditionally isolated in a later adapter.

The package.json version is canonical and is synchronized explicitly to the
lockfile, Obsidian manifest, and versions.json. The ignored export directory
contains a directly installable project-weave folder and a versioned ZIP; both
are derived only from the verified dist inventory.

## Decision records

Material choices should be recorded in `docs/decisions/` using the template in `0000-template.md`. Keep each record concise and preserve superseded decisions for context.
