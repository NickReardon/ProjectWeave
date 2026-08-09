# Project Weave

**Stack:** TypeScript · Obsidian API · Node.js 22+ · **Ships as:** Community plugin

Markdown-first project workbench for long-lived solo and small-team projects.
This file is the always-loaded router; conditional detail lives beside its owner.

## STRUCTURE

```text
.
├── src/                  # plugin implementation (AGENTS.md)
├── tests/                # automated behavior coverage
├── scripts/              # tooling and release automation (AGENTS.md)
├── templates/default/    # packaged Markdown templates
├── docs/                 # specifications and project records (AGENTS.md)
├── agents / agents.cmd   # cross-platform task entry points
└── manifest.json         # Obsidian compatibility metadata
```

Generated `CLAUDE.md` files project each `AGENTS.md` into tool-specific paths.
Edit the `AGENTS.md` source and run `./agents link` or `.\agents.cmd link`.

## WHERE TO LOOK

| Need                               | Location                      |
| ---------------------------------- | ----------------------------- |
| Current authority map              | `CURRENT-DESIGN.md`           |
| Implemented behavior and setup     | `README.md`                   |
| Recent work                        | `git log --oneline -20`       |
| Product behavior                   | `docs/spec/`                  |
| Architecture boundaries            | `docs/ARCHITECTURE.md`        |
| Decision rationale                 | `docs/decisions/`             |
| Outstanding work and manual checks | `docs/project-vault/`         |
| Automated validation record        | `docs/CURRENT_WORK.md`        |
| Agent tooling                      | `docs/development/agents.md`  |
| Testing procedure                  | `docs/development/testing.md` |
| Release procedure                  | `docs/development/release.md` |

Subtree `AGENTS.md` files provide local conventions when that subtree is touched.

## COMMANDS

`./agents help` lists every verb. On Windows, use `.\agents.cmd help`.

```shell
./agents setup    # install locked dependencies
./agents check    # complete CI-equivalent automated gate
./agents doctor   # audit context cost, pointers, and generated files
./agents link     # regenerate tool-specific context files
```

## CONVENTIONS

- Inspect the working tree first and preserve unrelated changes.
- Work on a short-lived branch from `main`; keep commits small and coherent.
- Keep one owner per fact and link to it from routers.
- Update the owning specification with product behavior changes.
- Keep documentation and the behavior it describes in the same commit.
- Record lasting architectural or product rationale in an ADR.
- Treat compatibility surfaces as versioned contracts; size releases by change.
- Report automated and manual verification separately.
- Push, merge, release, and version changes follow explicit user requests.
