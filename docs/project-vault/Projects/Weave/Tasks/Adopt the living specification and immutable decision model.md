---
type: task
title: Adopt the living specification and immutable decision model
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-documentation-authority]]'
status: done
category: chore
priority: critical
rank: 100
origin: '[[Documents/Design/Documentation authority and document lifecycle]]'
created: 2026-08-16
---

# Adopt the living specification and immutable decision model

## Summary

State the two document lifecycles in the routing documents and the decision
template, so the rule is discoverable before someone writes the next record.
Specifications are living and edited in place; decision records are
point-in-time and immutable once accepted.

## Acceptance criteria

- `AGENTS.md`, `docs/AGENTS.md`, `CURRENT-DESIGN.md`, and `docs/spec/README.md`
  state that specifications own current behavior and decision records do not.
- The immutability and supersession rule is written down once, with the other
  documents linking to it rather than restating it.
- `docs/decisions/0000-template.md` carries `superseded_by` and the rule that
  an accepted record is not edited.
- No routing document ranks decision records by authority; the distinction is
  lifecycle.

## Validation

Run `./agents doctor` for pointer resolution and `npm run check` for the
formatting and current-work gates.
