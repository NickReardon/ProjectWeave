# Project Weave Agent Guide

## Start here

Project Weave is a Markdown-first Obsidian project workbench. Before changing
code or product behavior, read these files in order:

1. `CURRENT-DESIGN.md` for the authoritative product-contract reading order
   and precedence rules.
2. `README.md` for implemented behavior, setup, commands, and manual checks.
3. `docs/CURRENT_WORK.md` for the active working-tree handoff and validation
   status.
4. `docs/ARCHITECTURE.md` for dependency direction and implemented boundaries.
5. The owning document under `docs/design/` and any relevant record under
   `docs/decisions/`.
6. Nearby source, tests, and fixtures for the behavior being changed.

When documents conflict, follow the precedence defined in
`CURRENT-DESIGN.md`. Implementation-status claims belong in `README.md` and
`docs/CURRENT_WORK.md`, not in older planning documents.

## Repository map

- `src/domain/`: entity contracts, parsing, validation, and domain rules.
- `src/indexing/`: immutable snapshots, indexing, readiness, and publication.
- `src/application/`: project-scoped queries and UI-independent projections.
- `src/ports/`: narrow core-facing interfaces.
- `src/adapters/obsidian/`: Obsidian-specific vault and link integration.
- `src/ui/`: Obsidian views, modals, and settings surfaces.
- `tests/`: unit, application, integration, helpers, and fixture-vault coverage.
- `templates/default/`: built-in Markdown templates.
- `docs/design/`: normative feature behavior, subject to the current-design
  precedence rules.
- `docs/decisions/`: accepted architectural and product decisions.
- `scripts/`: version, build-output, export, and ZIP tooling.

## Engineering constraints

- Markdown in the user's vault is canonical. Passive indexing, plugin load,
  settings changes, and navigation must not modify vault content.
- Keep dependencies pointing inward. Domain, indexing, and application code
  must not import Obsidian, Node, Electron, UI modules, or future transport
  adapters.
- Keep Obsidian API usage in the Obsidian adapter, entry point, or UI layer.
- Preserve project-scoped queries, bounded results, deterministic ordering,
  immutable snapshot semantics, and explicit diagnostics.
- Do not introduce a generic write-capable vault port. Future writes must pass
  through typed template, proposal, validation, and write-coordination
  services described by the design contracts.
- Do not silently repair invalid notes, mirror derivable relationships, or
  persist derived index/view state as project data.
- Keep the core plugin mobile-compatible. Desktop-only agent transport belongs
  behind a conditional adapter.
- Treat product terms, frontmatter fields, controlled values, diagnostic codes,
  and persisted workspace state as compatibility surfaces.

## Working safely

- Inspect the working tree before editing and preserve unrelated or
  user-authored changes. Do not assume the current branch is clean.
- Do not edit or commit generated `node_modules/`, `dist/`, `export/`,
  `coverage/`, or log output.
- Prefer the smallest change that follows neighboring patterns. Update focused
  tests and fixtures with behavior changes.
- Record material architectural or product choices in a concise ADR using
  `docs/decisions/0000-template.md`. Preserve superseded decisions as history.
- Update `docs/CURRENT_WORK.md` when the active slice, validation status,
  remaining manual checks, or next decision point changes.
- Update `README.md` and `docs/ARCHITECTURE.md` when implemented or released
  boundaries change. Do not use `docs/PROJECT_PLAN.md` as current guidance; it
  is retained as a historical bootstrap plan.
- Do not commit, push, release, or change versions unless the user explicitly
  requests it.

## Validation

Node.js 22 or newer is required. From a clean dependency install, use:

```shell
npm ci
npm run check
```

`npm run check` is the complete automated gate: synchronized versions,
formatting, lint, TypeScript, Vitest and Node tests, production bundle, and
release inventory. Use narrower commands while iterating, but run the complete
gate before handoff when practical.

Obsidian UI, workspace restoration, responsive behavior, and live vault-event
behavior still require the focused manual checks documented in `README.md` and
`docs/CURRENT_WORK.md`. Report automated and manual verification separately.
