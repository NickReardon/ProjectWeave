# Project Weave Current Design

## Product direction

The current v1 direction is [Project Weave v1 Product Brief](docs/PRODUCT_BRIEF-V1.md): a streamlined, single-project-first Obsidian workbench for a solo developer or small team building a long-lived project such as a game.

## Normative reading order

1. [Original implementation plan](PLAN.md) for the Markdown-first and non-destructive foundations.
2. [Plan Addendum 001](PLAN-ADDENDUM-001.md) for project lifecycle, rank, controlled priority, due dates, completion timestamps, and milestones.
3. [Plan Addendum 002](PLAN-ADDENDUM-002.md) for the single-project-first, design-to-execution workflow and multi-project boundary.
4. [Plan Addendum 003](PLAN-ADDENDUM-003.md) for enforced-by-default declared dependencies plus optional planning periods and estimates.
5. [Design 15](docs/design/15-scheduling-and-milestones.md) for scheduling/milestone behavior.
6. [Design 16](docs/design/16-streamlined-long-project-workflow.md) for the primary Plan, Board, My Work, scale, and progressive-disclosure UX.
7. [Plan Addendum 004](PLAN-ADDENDUM-004.md), [Design 17](docs/design/17-agent-access-and-mcp.md), and [Security Profile 17a](docs/design/17a-agent-access-security-profile.md) for the shared application API and staged agent boundary.
8. [Plan Addendum 005](PLAN-ADDENDUM-005.md) and [Design 18](docs/design/18-project-note-templates.md) for the project-owned template contract shared by UI and agents.

Later addenda take precedence where wording conflicts. The earlier feature designs in `docs/design/01` through `14` remain supporting contracts for lifecycle, data safety, entities, provenance, validation, migration, and testing except where the current direction explicitly defers portfolio behavior or changes defaults.

## Core v1 slice

```text
write or revise a Markdown design
  -> create/edit linked task drafts
  -> rank tasks and declare prerequisites
  -> keep future work in backlog
  -> add selected tasks to the board
  -> use Ready Now / My Work
  -> complete, reopen, and preserve history
```

Epics, milestones/releases, planning periods (Sprint/Cycle/Period), point estimates, owners, priorities, and due dates are optional. Same-project dependencies are optional but enforced by default once declared. Multi-project recognition and switching are supported; portfolio planning is deferred.
