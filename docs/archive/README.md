# Archived Planning Material

**Nothing in this directory is authoritative.** These documents record how
Project Weave arrived at its current shape. They do not define current
behavior, do not override anything, and are not part of any reading order.

For what should be true today, read [`../spec/`](../spec/README.md). For why a
choice was made, read [`../decisions/`](../decisions). For what is implemented,
read [`../../README.md`](../../README.md) and
[`../CURRENT_WORK.md`](../CURRENT_WORK.md).

## Contents

| Document                                                       | What it was                                                                             |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| [PLAN.md](PLAN.md)                                             | The original implementation plan.                                                       |
| [PLAN-ADDENDUM-001.md](PLAN-ADDENDUM-001.md)                   | Added project lifecycle, rank, priority, due dates, completion history, and milestones. |
| [PLAN-ADDENDUM-002.md](PLAN-ADDENDUM-002.md)                   | Turned the product single-project-first and reduced the multi-project surface.          |
| [PLAN-ADDENDUM-003.md](PLAN-ADDENDUM-003.md)                   | Set dependency, planning-period, and estimation defaults.                                |
| [PLAN-ADDENDUM-004.md](PLAN-ADDENDUM-004.md)                   | Made agent access a first-class v1 direction.                                            |
| [PLAN-ADDENDUM-005.md](PLAN-ADDENDUM-005.md)                   | Made note templates project-owned and shared by UI and agents.                          |
| [PROJECT_PLAN.md](PROJECT_PLAN.md)                             | The bootstrap plan, predating the product surface and stack.                            |
| [ADVERSARIAL-REVIEW.md](ADVERSARIAL-REVIEW.md)                 | A hostile code review of one specific past commit.                                       |

Every normative statement these documents once carried now lives in
[`../spec/`](../spec/README.md). Their internal links have been repointed to
the relocated documents; nothing else about their content has been changed.

## Why they are here

Layered addenda meant that determining current behavior required walking a
precedence chain across seven documents, and the owning specs drifted out of
agreement with both the addenda and the code. A new product decision now
updates the canonical spec and, when the rationale is worth keeping, adds an
ADR. It never adds another overriding requirements document.
