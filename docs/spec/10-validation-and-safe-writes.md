---
type: spec
area: writes
status: current
canonical: true
related_decisions: ["0009"]
---

# 10 — Validation and Safe Writes

## Goal

Make every Project Weave content edit intentional, explainable, concurrency-aware, and recoverable without silent repair or data loss.

## Validation layers

### Syntax and shape

Validate frontmatter presence/type, scalar versus list shape, controlled values, positive integers, calendar dates, link syntax, normalized target paths, and duplicate list entries.

### Entity relations

Validate required project links; same-project epic membership; sprint scope/membership; task targets for dependencies; origin targets; and iteration root/number coherence.

### Global invariants

Validate same-project dependency cycles, duplicate storage identity, active sprint overlap, project participation, and complete sprint-close outcomes.

### Operation rules

Validate the requested transition itself, such as starting blocked work, changing project while incompatible relations exist, or activating a sprint with missing dates.

## Diagnostic contract

Each issue has:

- stable code;
- severity (`error`, `warning`, `info`);
- affected path and field when known;
- concise message;
- recovery guidance;
- optional related paths.

Errors prevent operations that rely on the invalid state. Warnings require acknowledgement only where a design says so. Diagnostics never change source content.

## Proposal model

All writes are expressed as a proposal containing:

- operation ID and named user action;
- created, modified, and (if ever allowed) moved files;
- before fingerprint for each existing file;
- exact frontmatter changes and human-readable diff summary;
- all validation results;
- deterministic write order;
- expected postconditions.

Single-file form confirmation may combine preview and confirmation. Bulk/migration operations require a dedicated preview listing every path and field change.

## Mutation mechanics

- Use Obsidian's Vault/FileManager APIs rather than direct filesystem access.
- For supported frontmatter fields, prefer the official frontmatter-processing API so body content is preserved.
- Re-read/process the current file at commit time and compare relevant content with the proposal fingerprint.
- Preserve unknown frontmatter keys and Markdown body.
- Do not rewrite a note merely to normalize style or key order.
- Normalize user-configured paths before use.

The official Vault guidance recommends concurrency-safe processing over separate stale reads/writes, and the plugin guidelines prefer frontmatter-specific processing for properties: [Vault API](https://docs.obsidian.md/Plugins/Vault) and [plugin guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines).

## Single-file commit

1. Build and validate proposal.
2. Ask for explicit form confirmation.
3. Confirm target existence/collision expectations.
4. Process the latest content; abort on relevant concurrent change.
5. Re-validate the produced note in memory.
6. Commit once.
7. Report success and navigate only if requested.

## Multi-file commit

1. Build the complete proposal from one index revision.
2. Validate every proposed result and global postcondition.
3. Present exact affected paths and warnings.
4. Require explicit confirmation.
5. Re-read/fingerprint all files; if any changed, write none.
6. Write in deterministic order, recording each outcome durably in memory.
7. Stop at the first unexpected failure.
8. Report written, unchanged, and unwritten paths separately.
9. Re-index and offer reconciliation/retry; never claim rollback unless verified.

V1 does not assume the vault provides an atomic multi-file transaction. Where practical, order writes so intermediate states are understandable, but never misrepresent partial success as all-or-nothing.

## Repairs

There is no silent repair. A repair action is a named command that shows the same proposal/confirmation contract as any other write. Bulk Fix All is out of scope for v1 unless each change is previewable and independently valid.

## Logging and privacy

Operation reports include operation type, timestamps, paths, field names, and errors. Note bodies and sensitive frontmatter values are omitted from logs by default. Users can copy a redacted diagnostic report.

## Acceptance criteria

- Every write path is traceable to a command/UI confirmation.
- Lifecycle and view rendering contain no content-write call sites.
- Unknown keys and bodies survive supported property edits.
- Any changed preflight input aborts a bulk operation before its first write.
- Forced mid-operation failures report exact written/unwritten files.
- Invalid notes are reported but never automatically normalized or repaired.
