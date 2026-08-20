# Development Procedure

How to work on, verify, and ship Project Weave. These documents are procedure;
[`../Specifications/`](../Specifications/README.md) is.

- [agents.md](agents.md) — mandatory-context budgeting, generated tool
  projections, the repository command entry point, and its `doctor` gate.
- [testing.md](testing.md) — the manual-check procedure against Obsidian: the
  disposable test vault, the numbered checks, and how to record results.
  [`docs/CURRENT_WORK.md`](../../../../../CURRENT_WORK.md) is authoritative for which have
  passed.
- [release.md](release.md) — the version-sizing rule, release channels, BRAT
  preview, stable GitHub releases, and Community directory submission.

Automated verification is `./agents check` (or `.\agents.cmd check` on
Windows); `npm run check` enters the same implementation.
