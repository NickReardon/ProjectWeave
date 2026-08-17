# Project Weave Current Design

This file is a map, not a contract. It says where each kind of truth lives.
Nothing here overrides anything it points to.

## Where things live

| Question                           | Answer lives in                                                       |
| ---------------------------------- | --------------------------------------------------------------------- |
| What should be true?               | [`docs/spec/`](docs/spec/README.md)                                   |
| What is implemented?               | [`README.md`](README.md)                                              |
| What is verified?                  | `tests/`, plus [`docs/development/testing.md`](docs/development/testing.md)       |
| Why was a choice made?             | [`docs/decisions/`](docs/decisions/README.md)                         |
| How do the pieces fit together?    | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)                        |
| What remains to do, in what order? | The roadmap and linked Epic notes in [`docs/project-vault/Projects/Weave/Project.md`](docs/project-vault/Projects/Weave/Project.md) |
| What outstanding work exists?      | [`docs/project-vault/`](docs/project-vault/), Project Weave's own dogfood vault |
| What is in flight right now?       | [`docs/CURRENT_WORK.md`](docs/CURRENT_WORK.md), rewritten each checkout |
| What verification has run?         | `git log` — each commit records the gate result for its own change    |
| How did the project get here?      | [`docs/archive/`](docs/archive/README.md) — authoritative over nothing |

## Two lifecycles

The documents above split into two kinds, and the split is by lifecycle rather
than by rank.

**Living.** Specifications, `README.md`, and `ARCHITECTURE.md` are edited in
place and state what is true now. Specifications own current behavior, and each
fact has exactly one owning specification.

**Point-in-time.** Decision records are immutable once accepted: a decision that
changes is superseded by a new record rather than edited. They therefore hold no
authority over current behavior — not because they rank lower, but because they
describe a moment that has passed.
[`docs/decisions/README.md`](docs/decisions/README.md) owns that rule.

## The one rule

A new product decision **updates the owning specification** in `docs/spec/`,
and ships with a decision record under `docs/decisions/` in the same commit.

It does not add another requirements document that overrides the spec. Layered
addenda are what made a precedence chain necessary in the first place, and the
specs drifted out of agreement with both the addenda and the code while the
reader was expected to reconcile seven documents in order.

## Product direction

[Product brief](docs/spec/product-brief.md): a streamlined,
single-project-first Obsidian workbench for a solo developer or small team
building a long-lived project such as a game.
[`docs/spec/README.md`](docs/spec/README.md) indexes the specifications, states
the global invariants, and describes the core v1 slice.
