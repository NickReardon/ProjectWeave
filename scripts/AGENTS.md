# Repository tooling

`scripts/` contains Node.js ESM tooling for validation, diagnostics, versions,
test-vault management, release inventory, exports, and agent context.

## WHERE TO LOOK

| Task                             | Owner                            |
| -------------------------------- | -------------------------------- |
| Public task verbs                | `../agents` and `agents.mjs`     |
| Agent-context parsing and checks | `agent-context.mjs`              |
| Version policy implementation    | `project-version.mjs`            |
| Release inventory                | `verify-release.mjs`             |
| Export packaging                 | `export-plugin.mjs`              |
| Tooling tests                    | adjacent `*.node-test.mjs` files |

## CONVENTIONS

- `agents.mjs` owns task behavior; `../agents` and `../agents.cmd` are thin
  platform launchers.
- Commands ship in the repository and work from a clean clone after Node is
  available. Configuration-dependent tasks fail with actionable guidance.
- `agents check` regenerates tool-specific context before running `doctor` and
  the same automated gate used by CI.
- Tool-specific context files are generated from exact-case `AGENTS.md` files.
- Parsers handle YAML block-scalar skill descriptions when measuring cost.
- Filesystem mutations stay inside explicit repository-owned output paths.
- Node tests cover context counting, skill-description parsing, and pointer
  extraction.
