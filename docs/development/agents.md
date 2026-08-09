# Agent context and repository commands

Project Weave budgets mandatory agent context. The root `AGENTS.md` is loaded
on every request, so it routes to material that is read only when relevant.
Subtree guides load with their directories, while specifications, procedures,
skills, and references remain opt-in.

## Ownership tiers

| Tier | Read when | Content |
| --- | --- | --- |
| Root `AGENTS.md` | every request | structure, task verbs, routing, shared conventions |
| Subtree `AGENTS.md` | that directory is touched | local ownership and conventions |
| `docs/`, skills, references | explicitly opened | detailed contracts and procedure |

Each fact has one owner. Routers link to owners rather than restating them.
The root guide has a hard limit of 70 lines, enforced by `agents doctor`.

## One entry point

The extensionless `agents` launcher serves POSIX shells. `agents.cmd` serves
Windows Command Prompt and PowerShell. Both call `scripts/agents.mjs`, which is
the single implementation of every verb:

```shell
./agents help
./agents setup
./agents build
./agents test
./agents lint
./agents format
./agents check
./agents doctor
./agents link
```

`./agents help` is the complete catalog, including diagnostics, versioning,
test-vault, export, release, and focused-check verbs.

`setup` installs locked dependencies. The focused verbs delegate to the same
npm scripts used during iteration. `check` regenerates context projections,
runs the context audit, then executes Project Weave's complete automated gate
in CI order. An unknown or unconfigured verb exits unsuccessfully and explains
what is available.

## Generated tool context

Every exact-case `AGENTS.md` is the source for a neighboring generated
`CLAUDE.md` containing `@AGENTS.md`. Run `agents link` after adding, moving, or
renaming a context file. Generated pointers are ignored by Git and checked for
exact content by `agents doctor`.

Project-specific skills belong under `.agents/skills/<name>/SKILL.md` when a
repeated workflow justifies one. Keep each description to one or two sentences
that say when the skill should be used. Keep `SKILL.md` as a router and put bulk
material in `references/`, with a concrete read condition beside every link.
`agents link` projects each skill into `.claude/skills/` with a verified
symlink—or a junction on Windows—and `doctor` checks the target and stale links.

Shared skills are vendored into `.agents/` so a clone and CI remain
self-contained. Check the license in the original source repository before
vendoring; absent a license, treat the material as all rights reserved.

## Doctor

`agents doctor` exits unsuccessfully for project-controlled defects and reports:

- root `AGENTS.md` line count against the 70-line cap;
- total description characters for enabled project skills, including YAML
  literal and folded block scalars;
- missing paths in the root `WHERE TO LOOK` table;
- missing or stale generated `CLAUDE.md` pointers;
- user-global skill descriptions found in common Codex and Claude locations.

Global skill cost is informational because the repository does not own the
user's installation. Project budget, pointers, and generated projections gate
the commit through `agents check` and therefore `npm run check`.

## Cross-platform contract

`.gitattributes` pins the extensionless `agents` launcher to LF and executable
mode. The Windows launcher remains CRLF. Generated skill links are verified
after creation; Windows uses junctions so the operation needs no symlink
privilege or Developer Mode.
