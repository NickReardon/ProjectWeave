---
type: decision
id: '0015'
area: dogfooding
status: proposed
canonical: false
affects: []
---

# ADR 0015: Track Project Weave's own working state in Project Weave

- Status: proposed
- Date: 2026-08-07
- Owners: core

## Context

`docs/CURRENT_WORK.md` is a hand-maintained file of roughly 420 lines carrying
the state Git cannot: validation evidence, which manual checks have passed,
known loose ends, and the next decision. It works, and it exists for a real
reason — commit history records what changed, not what remains unverified.

But Project Weave is a project workbench. Its purpose is carrying outstanding
work, pending decisions, and follow-up items. Maintaining a parallel Markdown
pseudo-database for exactly that, inside this repository, is duplicated effort
and an implicit statement that the product is not yet good enough for its own
project. It is also the shape of information an agent should be able to ask
for — a `project_status` query over the application API — rather than parse out
of prose.

The blocker is not design, it is the write boundary. Today Project Weave can
create one note. It cannot modify an existing one, so a task's status cannot
change, which is the entire mechanism this migration depends on.

## Decision

When the preconditions below are met, Project Weave's own notes become the
source for the parts of `CURRENT_WORK.md` that are genuinely work items. The
parts that are evidence stay in Markdown.

| Current section              | Destination                                                                                                     |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Operational state            | The project note body                                                                                            |
| Automated verification       | **Stays Markdown.** Append-only evidence bound to immutable commits                                              |
| Manual checks still required | One task per check, `category: manual-check`, status carrying the passed/partial/unrun state `docs/development/testing.md` records today |
| Known loose ends             | Backlog tasks, `category: loose-end`                                                                             |
| Next decision point          | Backlog rank order, not prose                                                                                    |

The split is the substantive part of this decision. Validation evidence is a
statement about a commit that already happened — "the complete gate passed
against `8dcfcb0`". Turning it into mutable task state would destroy the
property that makes it evidence, because a record that can be edited after the
fact no longer proves anything about the past. Everything else in the file is
work with a status, which is what a task is.

`docs/development/testing.md` continues to own **how** to run each check. Only
the record of **whether** each has passed moves.

## Preconditions

Each is blocking, in roadmap order:

1. **Slice 3 — the typed mutation and proposal kernel.** Changing a task's
   status requires editing an existing note. The current create-only write
   port has no operation that can express it.
2. **Typed task editing (slice 5, Agent Slice C),** so a status transition runs
   through a validated operation rather than hand-edited frontmatter. Editing
   these notes by hand would reproduce the maintenance burden this ADR removes.
3. **A decision on where the dogfood vault lives.** Deliberately left open here,
   because it depends on how slice 3's write path treats paths outside indexed
   roots. `test-vault/` cannot serve: it is Git-ignored and reset between
   checks, so it cannot hold state that must survive. The candidates are a
   committed vault folder in this repository indexed by a developer's Obsidian,
   or a separate vault repository. This needs its own ADR.
4. **Agent Slice A (slice 2),** if the goal includes an agent reading project
   status through the application API rather than a human reading notes. Not
   required for the migration itself.

## Alternatives considered

- **Delete `CURRENT_WORK.md` and rely on Git plus issues:** rejected. It loses
  the manual-check status, which no other artifact in the repository carries,
  and the checks are the largest part of what the file is for.
- **Keep `CURRENT_WORK.md` permanently:** rejected. It is the position this ADR
  exists to change. A project-tracking tool that cannot track its own project
  has not been tested against its hardest available user.
- **Migrate only the known loose ends:** a viable intermediate. Loose ends are
  ordinary backlog items with no status vocabulary of their own, so they need
  less than the manual checks do. Worth taking first if slice 3 lands before
  typed task editing.
- **Move the manual checks into `testing.md` itself:** rejected. That file owns
  procedure; mixing mutable per-run status into it would make a document that
  must be edited after every check session, trading one hand-maintained record
  for another.

## Consequences

- Positive: one system of record for outstanding work; a `project_status` query
  can serve agents directly; the product gets exercised by a real long-lived
  project, which is the use case the v1 brief names.
- Positive: the manual-check status stops being duplicated between
  `CURRENT_WORK.md` and the check headings in `docs/development/testing.md`,
  which drift apart today.
- Negative: project state moves from one greppable file into a set of notes.
  Anyone without Obsidian reads a folder rather than a page.
- Negative: a defect in Project Weave becomes a defect in the project's own
  bookkeeping. The evidence section staying in Markdown limits the blast
  radius.
- Follow-up work: `AGENTS.md` carries four separate rules about maintaining
  `CURRENT_WORK.md` — the post-merge handoff discipline, the
  no-branch-identifiers rule, what belongs in the file, and when to update
  it — all of which need rewriting at cutover. `npm run check` includes a
  current-work gate backed by `scripts/verify-current-work.mjs` and its Node
  test; both retire or retarget at the same time.

Until every precondition is met, `docs/CURRENT_WORK.md` remains authoritative
and this ADR stays `proposed`.
