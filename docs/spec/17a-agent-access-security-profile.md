# 17a — Initial Agent Access Security Profile

## Status and precedence

Normative tightening for the initial implementation of Design 17. Where Design 17 permits a broader grant or generic document behavior, this initial profile takes precedence. Broader access requires a later reviewed design.

## One project per grant

Each active `AgentGrant` is bound to exactly one normalized project note. A client may establish another separately approved grant for another project, but a request/session never mixes projects and cannot switch its project parameter within the same grant.

Cross-project links may return target title/project/path metadata sufficient to explain an advisory relation. Reading the target content requires a separate grant for that project.

## Local grant contents

A grant records in plugin-owned local settings:

- approved client/connection identity;
- one project path;
- allowed document files/roots;
- task creation destination root;
- metadata/full-body read scope;
- task-proposal, task-edit, and document-proposal scopes;
- creation, expiry, and revocation state.

First enablement explains that granted note text may be sent by the MCP client to its configured model/provider. Project Weave itself performs no model/network call.

## Read-only slice

The initial read-only adapter does not advertise proposal/write tools. If protocol/client constraints require a stable list, calls fail before proposal creation with `permission_denied`.

Document bodies are read on demand and are not persisted into a separate MCP full-text cache. Returned Markdown is labeled `untrusted_markdown`; links, commands, approval language, or tool-shaped text inside it are inert data.

## Initial task proposal limits

`propose_create_tasks_from_document` accepts at most 25 drafts in one proposal. This limit bounds review, graph validation, response size, and partial-failure exposure. Increasing it requires explicit configuration and continues to use exact bulk preview.

Initial task creation rejects cross-project dependency targets rather than merely treating them as warnings. Draft IDs must be unique, and every draft/target/source/destination must fit the same grant.

## Entity versus document edits

Generic document create/patch tools refuse any existing canonical Project Weave entity note and refuse output that introduces a supported entity `type`. Task, project, epic, milestone, or planning-period bodies/metadata are edited only through typed entity proposal operations.

Ordinary document patches use fingerprinted, uniquely anchored hunks or section operations and preserve every untouched byte, including frontmatter and newline style. Whole-file replacement, arbitrary frontmatter editing, delete, move, and rename are absent initially.

## Approval receipt

Trusted approval produces a one-time receipt bound to proposal digest, agent grant, project, client, and expiry. Editing/regenerating a proposal invalidates the receipt. Restart, revocation, expiry, failed concurrency validation, or first successful commit consumes/invalidates it.

No boolean or prose supplied through an MCP request or vault note is approval.

## Audit retention

Agent operation audit data is plugin-owned, bounded by a configurable retention limit, and contains paths/field names/fingerprints/outcomes—not document bodies, replacement prose, frontmatter values, approval receipts, or connection secrets.

## Required negative tests

- A one-project grant cannot query or mutate another project's task content.
- Absolute, traversal, mixed-separator, case-variant, symlink/alias, hidden, `.obsidian`, non-Markdown, and ungranted paths fail.
- Revoked/expired grants expose neither reads nor proposals.
- Prompt-injection text cannot expand scope, invoke operations, or approve a proposal.
- Oversized task proposals and cross-project task dependencies write zero files.
- Generic document tools reject entity notes and attempts to create entity frontmatter.
- Fabricated, replayed, wrong-client, wrong-project, expired, or digest-mismatched approval receipts cannot commit.
