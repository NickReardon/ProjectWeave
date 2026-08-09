# Project Weave Current Design

This file is a map, not a contract. It says where each kind of truth lives.
Nothing here overrides anything it points to.

## Where things live

| Question                           | Answer lives in                                                       |
| ---------------------------------- | --------------------------------------------------------------------- |
| What should be true?               | [`docs/spec/`](docs/spec/README.md)                                   |
| What is implemented?               | [`README.md`](README.md)                                              |
| What is verified?                  | `tests/`, plus [`docs/development/testing.md`](docs/development/testing.md)       |
| Why was a choice made?             | [`docs/decisions/`](docs/decisions)                                   |
| How do the pieces fit together?    | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)                        |
| What remains to do, in what order? | The roadmap and linked Epic notes in [`docs/project-vault/Projects/Weave/Project.md`](docs/project-vault/Projects/Weave/Project.md) |
| What outstanding work exists?      | [`docs/project-vault/`](docs/project-vault/), Project Weave's own dogfood vault |
| What automated verification has run? | [`docs/CURRENT_WORK.md`](docs/CURRENT_WORK.md), an append-only evidence log |
| How did the project get here?      | [`docs/archive/`](docs/archive/README.md) — authoritative over nothing |

## The one rule

A new product decision **updates the owning specification** in `docs/spec/`.
If the rationale is worth preserving, it also gets an ADR under
`docs/decisions/`.

It does not add another requirements document that overrides the spec. Layered
addenda are what made a precedence chain necessary in the first place, and the
specs drifted out of agreement with both the addenda and the code while the
reader was expected to reconcile seven documents in order.

## Product direction

[Product brief](docs/spec/00-product-brief.md): a streamlined,
single-project-first Obsidian workbench for a solo developer or small team
building a long-lived project such as a game.
[`docs/spec/README.md`](docs/spec/README.md) indexes the specifications, states
the global invariants, and describes the core v1 slice.
