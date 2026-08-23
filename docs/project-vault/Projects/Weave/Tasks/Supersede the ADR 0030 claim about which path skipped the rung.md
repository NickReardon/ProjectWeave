---
type: task
title: Supersede the ADR 0030 claim about which path skipped the rung
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-documentation-authority]]'
status: done
category: chore
priority: normal
rank: 6650
milestone: '[[Milestones/v1 release]]'
created: 2026-08-22
---

# Supersede the ADR 0030 claim about which path skipped the rung

## Summary

[[Documents/Decisions/0030-one-creation-pipeline-with-a-spec-per-note-kind|ADR 0030]]
states that "ADR 0013's fail-closed behavior becomes uniform: today only the
task path fully implements it." Landing
[[Tasks/Give template rung resolution one owner]] established the opposite:
project creation already merged its candidates through the template catalog
and failed closed on a case-collision, while task creation read the library
through `VaultTemplateLibrary.load()`, which reports an ambiguous key as
absent rather than as broken. Task creation therefore read "nothing
configured" and silently returned the packaged template — the fallthrough
ADR 0013 exists to prevent.

The record's decision still holds; one sentence supporting it is wrong about
which path was deficient.

## Why this is not just an edit

The record is `accepted`, and accepted records are immutable and superseded
rather than edited. The reversal is currently recorded only in the completed
task note, which is not where a reader of the decision record would look.

## Acceptance criteria

- A reader of ADR 0030 can discover that its premise about the task path was
  incorrect, without depending on a task note.
- ADR 0030's own text is not edited.
- The resolution states what was actually true: the ambiguous-key fallthrough
  was in task creation, and both kinds now fail closed identically.

## Notes

Cheap to leave and cheap to fix, but it is a decision record asserting a fact
that the code now contradicts, which is the exact failure
[[Epics/Epic-documentation-authority]] exists to prevent.

## Outcome

Settled as
[[Documents/Decisions/0033-correct-which-creation-path-skipped-the-rung-ladder|ADR 0033]],
a partial supersession. ADR 0030 was not touched: it keeps `status: accepted`
and gains no `superseded_by`, which is what the decision log's lifecycle
prescribes when a later record replaces only part of an earlier one. ADR 0033
names the one replaced sentence — the claim that only the task path fully
implemented ADR 0013's fail-closed behavior — states what was actually true,
and says in as many words that the rest of ADR 0030 stands.

The record states the correction and points at
[[Documents/Specifications/vault-note-templates|Vault note templates]] for what
resolution does today, so it asserts no live rule of its own.

Discovery was the part that needed more than a new record. A partially
superseded record gains no frontmatter pointer, so nothing in ADR 0030 leads a
reader to ADR 0033, and the acceptance criterion above asks for exactly that.
[[Documents/Decisions/README|The decision log index]] now carries a **Partial
supersessions** table — the log's living forward-pointer index — listing this
pair alongside the two that already existed, and noting that ADR 0013's own
`superseded_in_part_by` key predates the lifecycle and is not a pattern to copy.
