---
type: decision
id: '0018'
area: agent-access
status: accepted
canonical: false
affects: ['agent-access-and-mcp', '0004']
---

# ADR 0018: Bridge agent access over a stdio companion and authenticated local IPC

- Status: accepted
- Date: 2026-08-08
- Owners: core

## Context

[ADR 0004](0004-agent-access-as-core-adapter.md) accepted a tool-neutral
application API with a thin MCP adapter over it, and left one item open: select
and record the desktop bridge transport and a pinned MCP protocol and SDK before
implementing the adapter. [Agent access and MCP](../spec/agent-access-and-mcp.md) defers
the same choice, listing what any acceptable transport must do but not which one
to build.

The deployment shape that forces the decision is a project whose code and whose
notes live in different places. A repository at `C:/AI/<name>` needs its agent to
reach that project's notes in a core vault at
`D:/MainObsidianVault/Projects/AI/<name>`, and the agent is required to work
through Project Weave rather than by reading and writing vault files directly.
A project embedded in its own repository, as `docs/project-vault/` is under
[ADR 0016](0016-dogfood-vault-location.md), is the same problem with a different
vault.

Three constraints follow, none of which the Agent access and MCP spec anticipated:

- The agent process starts in an arbitrary working directory, on a different
  drive from the vault, with no relationship to it on disk.
- A grant bound to a project path alone is ambiguous once more than one vault can
  be open. The binding must name a vault and a project.
- One Obsidian instance serves several repositories at once, so the bridge holds
  concurrent grants while each connection stays bound to exactly one project.

Making the notes appear inside the repository instead — junction, symlink,
submodule, nested clone, or a generated copy — was considered and does not apply.
Every such arrangement exists so that something can read the files directly,
which is what agent access through Project Weave is meant to replace, and none of
them carry readiness, validation, or the proposal write path.

## Decision

Agent access uses a stdio MCP companion that connects to a bridge inside the
plugin over authenticated local IPC.

- **Client to companion: stdio.** The MCP client spawns the companion as a child
  process. Stdio is the transport with the broadest client support and needs no
  listening socket of its own. The companion translates schemas and forwards;
  it holds no parsing, readiness, rank, validation, or write logic, per ADR 0004.
- **Companion to plugin: a named pipe on Windows, a Unix domain socket
  elsewhere.** Node's `net` server accepts a path on both. This opens no TCP
  port, which satisfies "bind only locally" without relying on a loopback bind
  being unreachable.
- **The pipe is not the authentication.** Any local process can attempt to open
  it, so every connection presents a grant secret and is rejected before any
  application call if it does not match an active grant.
- **A grant binds a vault and a project.** `AgentGrant` records the vault
  identity alongside the single normalized project path it already carried.
  the Agent access and MCP spec's one-project-per-grant rule is unchanged; the grant simply becomes
  unambiguous when several vaults exist.
- **The grant secret never lives in the repository.** A repository's MCP client
  configuration names the companion and reads the secret from the environment.
  The secret itself is stored with the grant in plugin-owned local settings and
  in the developer's own environment, consistent with the Agent access and MCP spec's rule that
  grants are local settings and not synced vault content.
- **Desktop facilities load conditionally.** The bridge and its `net` usage are
  imported only when the gateway is enabled on desktop. `manifest.json` keeps
  `isDesktopOnly: false` and mobile startup does not reach this code.
- **Protocol and SDK are pinned.** The adapter targets MCP revision `2025-06-18`,
  the revision the Agent access and MCP spec already cites, using the official TypeScript SDK
  (`@modelcontextprotocol/sdk` 1.30.0) and Zod 4.4.3 at exact versions rather
  than ranges, so a protocol revision never changes underneath a tested
  adapter. The agent access and MCP spec requires proposal handles to stay independent of transport
  sessions, so a version bump is an isolated, testable change.

## Alternatives considered

- **Loopback TCP with a bearer token:** rejected. It is the more conventional
  choice and the Agent access and MCP spec names it as acceptable, but it opens a listening port on
  the machine for a purpose that never needs one, and port allocation adds
  discovery state the pipe path does not.
- **An MCP HTTP server hosted inside the plugin:** rejected. It removes the
  companion process, but obliges Project Weave to implement HTTP transport
  security itself, and client support for local HTTP servers is narrower than for
  stdio.
- **Obsidian's Local REST API plugin as the bridge:** rejected. It adds an
  external dependency outside this project's release and security control, and
  exposes filesystem-shaped note operations that the Agent access and MCP spec forbids, which would
  put the plugin's invariants behind a surface Project Weave does not define.
- **An `obsidian://` protocol handler:** rejected. It is fire-and-forget with no
  response, so it cannot serve reads at all, and Project Weave registers no
  protocol handler today.
- **A companion that reads and writes the vault itself:** rejected by ADR 0004
  and restated here, because it duplicates parsing and rules, bypasses the live
  index, and cannot honour the proposal and fingerprint write path.

## Consequences

- Positive: the repository and the vault can sit anywhere on the machine,
  because nothing about the arrangement depends on their relative paths.
- Positive: an embedded project vault and a core vault use one code path,
  differing only in which vault a grant names.
- Positive: no listening TCP port exists, and a disabled gateway creates no
  endpoint of any kind.
- Negative: a companion is a second process to build, version, and distribute
  alongside the plugin, and its protocol version must stay compatible with the
  bridge it talks to.
- Negative: pipe and socket handling differs by platform, so the bridge carries
  platform-specific code and needs coverage on both.
- Negative: developers configure a grant secret in their environment per
  repository, which is setup friction that a vault-local arrangement would not
  have.
- Follow-up: the Agent access and MCP spec's `AgentGrant` gains vault identity. Slice A implements
  the application query surface and transport; proposal capabilities remain a
  later slice.
