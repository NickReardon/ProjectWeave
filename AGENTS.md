# Project Weave Agent Guide

## Start here

Project Weave is a Markdown-first Obsidian project workbench. Before changing
code or product behavior, read these files in order:

1. `CURRENT-DESIGN.md` for the one-page map of where each kind of truth lives.
2. `README.md` for implemented behavior, setup, and commands.
3. Recent history on the current branch (`git log --oneline -20`) for what has
   changed and why. History is the primary record of work in progress.
4. `docs/CURRENT_WORK.md` for validation status, outstanding manual checks, and
   the next decision point — the state Git cannot carry.
5. `docs/ARCHITECTURE.md` for dependency direction and implemented boundaries.
6. The owning specification under `docs/spec/` and any relevant record under
   `docs/decisions/`.
7. Nearby source, tests, and fixtures for the behavior being changed.

`docs/spec/` is the single canonical statement of intended behavior; there is
no precedence chain and no document outside it overrides it. When the spec and
the code disagree, that is a defect in one of them — say which, and fix it.
Implementation-status claims belong in `README.md` and `docs/CURRENT_WORK.md`.
Nothing under `docs/archive/` is authoritative; do not cite it as a
requirement.

## Repository map

- `src/domain/`: entity contracts, parsing, validation, and domain rules.
- `src/indexing/`: immutable snapshots, indexing, readiness, and publication.
- `src/application/`: project-scoped queries and UI-independent projections.
- `src/ports/`: narrow core-facing interfaces.
- `src/adapters/obsidian/`: Obsidian-specific vault and link integration.
- `src/ui/`: Obsidian views, modals, and settings surfaces.
- `tests/`: unit, application, integration, helpers, and fixture-vault coverage.
- `templates/default/`: built-in Markdown templates.
- `docs/spec/`: the canonical specification of intended behavior.
- `docs/decisions/`: accepted architectural and product decisions — rationale
  and history, never a source of current behavior.
- `docs/archive/`: superseded plans and briefs, authoritative over nothing.
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
- Do not edit generated `node_modules/`, `dist/`, `export/`, `coverage/`, or
  log output.
- Prefer the smallest change that follows neighboring patterns. Update focused
  tests and fixtures with behavior changes.
- A new product decision updates the owning specification in `docs/spec/`, and
  adds an ADR under `docs/decisions/` when the rationale is worth preserving.
  Never add a document that overrides the spec — no addenda, no plan revisions,
  no second requirements file. If the spec is wrong, change the spec.
- Record material architectural or product choices in a concise ADR using
  `docs/decisions/0000-template.md`. Preserve superseded decisions as history.
- Update `docs/CURRENT_WORK.md` only for state the commit history cannot
  carry: validation evidence, outstanding manual checks, known loose ends, and
  the next decision point. Do not restate what changed — the branch and its
  commits are that record.
- Treat `docs/CURRENT_WORK.md` as the proposed post-merge handoff. Before a
  branch lands, make the file truthful for the resulting `main` state. Never
  record the current branch, current HEAD, branch hygiene, or an instruction to
  merge that branch there; keep pre-merge handoff details in the pull request
  or task conversation. A commit may be named only as immutable validation
  evidence, such as the source commit against which a command passed.
- Update `README.md` and `docs/ARCHITECTURE.md` when implemented or released
  boundaries change. Do not use anything under `docs/archive/` as current
  guidance; it is retained only to preserve decision history.

## Version control

Commit history is the primary record of in-progress work. Keep it granular
enough that prose documentation does not need to restate it.

- Work on a short-lived branch off `main`, named for the slice — for example
  `feat/task-creation`. Do not commit directly to `main`.
- Commit in small, self-contained steps as work lands rather than one large
  commit at the end. Each commit should stand on its own: it builds, it passes
  the checks that were run against it, and it makes one coherent change.
- Write commit subjects that carry intent, not a restatement of the diff. A
  reader should be able to follow the slice from `git log --oneline` alone.
- Keep documentation updates in the same commit as the behavior they describe,
  so history never claims something the code does not do.
- Do not push, merge, release, or change versions unless the user explicitly
  requests it. Committing on a branch does not imply approval for any of these.
- When a version bump is requested, size it by the change, not the commit
  count. Bump the patch (`0.4.0` → `0.4.1`) before exporting a build that
  differs from the last exported one; this is the ordinary increment, and two
  builds that behave differently must never share a version. Bump the minor
  (`0.3.x` → `0.4.0`) when a numbered slice in `docs/IMPLEMENTATION_ORDER.md`
  passes its exit gate, or when a compatibility surface changes — product
  terms, frontmatter fields, controlled values, diagnostic codes, or persisted
  workspace state. Do not claim a minor when work on a chunk begins; the
  version describes what a build contains.
  `docs/development/release.md` holds the full rule.
  Resolve genuine ambiguity upward and say why; a change you can fully describe
  as a fix or a refactor is not ambiguous.

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
behavior still require focused manual checks. `docs/development/testing.md` is the
procedure for running them; `docs/CURRENT_WORK.md` records which have passed
and is authoritative for status. Report automated and manual verification
separately.
