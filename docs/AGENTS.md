# Documentation and dogfood vault

`docs/` holds canonical specifications, decision history, development
procedure, validation evidence, and Project Weave's own project state.

## AUTHORITY

| Claim | Owner |
| --- | --- |
| Intended behavior | `spec/` |
| Implemented behavior | `../README.md` |
| Architectural boundaries | `ARCHITECTURE.md` |
| Decision rationale and history | `decisions/` |
| Outstanding work and manual checks | `project-vault/` |
| Completed automated gates | `CURRENT_WORK.md` |
| Superseded historical material | `archive/` |

`spec/` is the canonical behavior contract. A disagreement between code and
specification identifies a defect in one of them; make the owner accurate.

## CONVENTIONS

- Product decisions update the owning specification. Add a concise ADR from
  `decisions/0000-template.md` when the rationale is worth preserving.
- ADRs preserve superseded decisions as history; current behavior remains in
  the specification.
- `CURRENT_WORK.md` only appends completed `npm run check` or export evidence
  with its source commit.
- Task notes in `project-vault/` carry outstanding checks, loose ends, and the
  next decision point. Status transitions use the documented interim editing
  process until typed task editing exists.
- `README.md` and `ARCHITECTURE.md` change alongside implemented or released
  boundary changes.
- Material under `archive/` is historical context rather than requirements.
- Run `npm run diagnostics:check` after changing dogfood-vault notes and review
  every diagnostic before handoff.
