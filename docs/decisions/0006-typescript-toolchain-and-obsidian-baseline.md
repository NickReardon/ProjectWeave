---
type: decision
id: "0006"
area: toolchain
status: accepted
canonical: false
affects: ["01", "12", "13"]
---

# ADR 0006: Use a mobile-safe TypeScript core and Obsidian 1.8 baseline

- Status: accepted
- Date: 2026-08-02
- Owners: Project Weave

## Context

Implementation needs a reproducible Obsidian plugin toolchain, a minimum supported app version, and a boundary that lets UI, tests, and later agent adapters share domain behavior. The core plugin must remain mobile-compatible and lifecycle indexing must never write vault content.

## Decision

- Implement the plugin in strict TypeScript with pure domain/application modules and explicit read-only vault/link-resolution ports.
- Bundle with esbuild using the official Obsidian sample-plugin pattern, externalizing Obsidian, Electron, CodeMirror, Lezer, and Node built-ins.
- Use Vitest for pure and adapter-contract tests, ESLint for static analysis, and Prettier for deterministic source formatting.
- Require Node.js 22 or newer for development and CI.
- Set `minAppVersion` to Obsidian 1.8.0 for the first development release and test that version plus current stable before public release.
- Keep `isDesktopOnly: false`; runtime code in the core plugin may not import Node or Electron APIs.
- Produce release artifacts only in `dist/`, whose exact inventory is `main.js`, `manifest.json`, and `styles.css`.

## Alternatives considered

- **Put domain rules directly in Obsidian views:** rejected because tests and future agent adapters would duplicate or bypass policy.
- **Use Node filesystem APIs for indexing:** rejected because it would violate the public Vault API and mobile boundary.
- **Target only the newest Obsidian release:** rejected because the initial slice uses long-standing public APIs and does not need to exclude otherwise compatible installations.
- **Add MCP transport now:** deferred until the read/query application contract works and the desktop bridge/SDK decision is made separately.

## Consequences

- Positive: parsing, readiness, ordering, and queries run without Obsidian and can be tested deterministically.
- Positive: the first plugin path is read-only and mobile-safe.
- Negative: Obsidian link resolution and vault events require small adapters and contract tests.
- Follow-up: validate the chosen minimum on a disposable Obsidian 1.8 fixture before the first release; raise it explicitly if a required API proves newer.
