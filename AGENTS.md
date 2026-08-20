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
├── docs/                 # project documents and dogfood vault (AGENTS.md)
├── agents / agents.cmd   # cross-platform task entry points
└── manifest.json         # Obsidian compatibility metadata
```

Generated `CLAUDE.md` files project each `AGENTS.md` into tool-specific paths.
Edit the `AGENTS.md` source and run `./agents link` or `.\agents.cmd link`.

## WHERE TO LOOK

| Need                               | Location                                                            |
| ---------------------------------- | ------------------------------------------------------------------- |
| Current authority map              | `CURRENT-DESIGN.md`                                                 |
| Implemented behavior and setup     | `README.md`                                                         |
| Recent work                        | `git log --oneline -20`                                             |
| Product behavior                   | `docs/project-vault/Projects/Weave/Documents/Specifications/`       |
| Architecture boundaries            | `docs/ARCHITECTURE.md`                                              |
| Decision rationale                 | `docs/project-vault/Projects/Weave/Documents/Decisions/`            |
| Outstanding work and manual checks | `docs/project-vault/`                                               |
| Work in flight on this checkout    | `docs/CURRENT_WORK.md`                                              |
| Verification history               | `git log`                                                           |
| Agent tooling                      | `docs/project-vault/Projects/Weave/Documents/References/agents.md`  |
| Testing procedure                  | `docs/project-vault/Projects/Weave/Documents/References/testing.md` |
| Release procedure                  | `docs/project-vault/Projects/Weave/Documents/References/release.md` |

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
- Product behavior changes update the owning, living specification.
- Keep documentation and the behavior it describes in the same commit.
- Land a design before branching to build it.
- Record rationale in a decision record. Accepted records are immutable and are
  superseded rather than edited; they never define current behavior.
- Treat compatibility surfaces as versioned contracts; size releases by change.
- Report automated and manual verification separately.
- A commit carries its own gate result in its message and the task-note status
  change it completes; `git log` is the verification and task-state accounting.
- End every change by rewriting `docs/CURRENT_WORK.md` to a short description of
  the state it leaves behind; never append to it.
- Push, merge, release, and version changes follow explicit user requests.
