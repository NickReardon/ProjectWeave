# Documentation and dogfood vault

`docs/` holds Project Weave's own dogfood vault, and every project document
lives in one tree inside it at `project-vault/Projects/Weave/`: canonical
specifications, decision history, and development procedure under
`Documents/`, superseded material under `Archive/Legacy/`, beside the project
state and task notes they describe. Only `ARCHITECTURE.md` and
`CURRENT_WORK.md` sit outside the vault.

## AUTHORITY

| Claim | Owner |
| --- | --- |
| Intended behavior | `project-vault/Projects/Weave/Documents/Specifications/` |
| Implemented behavior | `../README.md` |
| Architectural boundaries | `ARCHITECTURE.md` |
| Decision rationale and history | `project-vault/Projects/Weave/Documents/Decisions/` |
| Outstanding work and manual checks | `project-vault/` |
| Work in flight on this checkout | `CURRENT_WORK.md` |
| Verification and task-state history | `git log` |
| Superseded historical material | `project-vault/Projects/Weave/Archive/Legacy/` |

`Documents/Specifications/` is the canonical behavior contract. A disagreement
between code and specification identifies a defect in one of them; make the
owner accurate.

Specifications are living and edited in place. Decision records are
point-in-time and immutable once accepted, so they hold no authority over
current behavior; `Documents/Decisions/README.md` owns that rule.

## CONVENTIONS

- Product decisions update the owning specification and ship with a concise
  record from `Documents/Decisions/0000-template.md` in the same commit.
- A design lands before it is built: the specification and decision record, the
  Epic, and its tasks and milestone assignment commit together, and only then
  does an implementation branch start. The plan is what gets reviewed, so the
  work items are citable before code exists. This does not conflict with
  shipping documentation alongside behavior: `Documents/Specifications/` states
  intended behavior and is written up front, while `../README.md` states
  implemented behavior and moves with the code.
- An accepted decision record is not edited. A changed decision is superseded
  by a new record, and the old one gains `superseded_by` and keeps its text.
- A rule a reader must obey lives in the owning specification, never in a
  decision record.
- Each fact has one owning specification; a topic may span documents, a fact
  may not. No specification asserts precedence over another.
- `CURRENT_WORK.md` is rewritten to match the checkout, never appended to. It
  carries in-flight state only; a commit records the gate result for its own
  change, and `git log` is the accounting.
- Rewriting it is the last step of every change, not an occasional tidy-up. Keep
  it short: what is in flight, what is verified, what is next. If it no longer
  describes the checkout, that is a defect.
- Task notes in `project-vault/` carry outstanding checks, loose ends, and the
  next decision point. Status transitions use the documented interim editing
  process until typed task editing exists.
- `README.md` and `ARCHITECTURE.md` change alongside implemented or released
  boundary changes.
- Material under `Archive/Legacy/` is historical context rather than
  requirements.
- Run `npm run diagnostics:check` after changing dogfood-vault notes and review
  every diagnostic before handoff.
