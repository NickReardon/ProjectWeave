---
type: decision
id: '0033'
area: templates
status: accepted
canonical: false
affects: ['vault-note-templates']
---

# ADR 0033: Correct which creation path skipped ADR 0013's rung ladder

- Status: accepted
- Date: 2026-08-23
- Owners: core

Once this record is accepted, its body is not edited. A decision that changes
is superseded by a new record; see [`README.md`](README.md).

## Context

[ADR 0030](0030-one-creation-pipeline-with-a-spec-per-note-kind.md) argues for
giving template rung resolution one owner and supports that bullet with a claim
about the current state: "ADR 0013's fail-closed behavior becomes uniform: today
only the task path fully implements it."

Doing the work reversed the claim. Building the one resolver (`c5b36f0`) meant
reading both implementations closely and running each against a case-colliding
vault default, which showed that `ProjectCreationProposalService.#selectTemplate`
already merged its candidates through the template catalog and refused a
collision. The task path did not. `TaskTemplateResolver` read the library
through `VaultTemplateLibrary.load()`, which reports an ambiguous key as absent —
it lands in the listing's `ambiguous` set rather than its `entries` — so `load()`
returned nothing, the `default` branch read that as "nothing is configured", and
creation returned the packaged template with no diagnostic at all. That silent
fall-through is the outcome
[ADR 0013](0013-resolve-templates-from-a-vault-template-folder.md) exists to
prevent, and it was task creation reaching it, not project creation.

The correction was recorded in the completed task note and in the commit
message. A reader of ADR 0030 has no path to either, and ADR 0030 is accepted,
so its text is not edited to say otherwise.

## Decision

This record replaces one sentence of ADR 0030 and nothing else.

- **Replaced:** the claim, in ADR 0030's "Template rung resolution has one
  owner" bullet, that today only the task path fully implements ADR 0013's
  fail-closed behavior. The truth was the reverse: project creation failed
  closed on a case-collision, and task creation silently fell back to the
  packaged template.
- **Stands:** the rest of ADR 0030 in full — one creation pipeline, a
  declarative spec per note kind, one owner for rung resolution, the unchanged
  [ADR 0009](0009-create-only-write-boundary.md) write boundary, and every
  alternative and consequence it records. The sentence named the wrong path as
  deficient; it did not change what the duplication cost or what removing it
  required. ADR 0030 therefore keeps `status: accepted` and gains no
  `superseded_by`.
- **Unchanged by this record:** what resolution does today. That behavior —
  one resolver for every kind, both kinds refusing an ambiguous key alike, and
  the explicit built-in default staying reachable when a rung is broken — is
  owned by [Vault note templates](../Specifications/vault-note-templates.md).

## Alternatives considered

- **Edit the sentence in ADR 0030:** rejected. Typography, broken links, and one
  id-collision fix are the only edits an accepted record permits, and a record
  rewritten to stay current stops being evidence of why a choice was made.
- **Give ADR 0030 `superseded_by: '0033'`:** rejected. Its decision holds
  entirely, and `superseded_by` means the whole decision was replaced; a reader
  following it forward would arrive at a record that decides nothing about the
  creation pipeline.
- **Leave the correction in the completed task note:** rejected. Task notes
  close and are read by the person who worked them, so the decision log would
  keep asserting, to everyone else, a fact the code contradicts.

## Consequences

- Positive: the log no longer states a backwards premise about which path was
  unsafe, and the surprise that the work turned up is preserved rather than
  smoothed over.
- Negative: partial supersession leaves no pointer in the frontmatter of the
  record it corrects, so forward navigation depends on the index in
  [`README.md`](README.md) listing it.
- Follow-up work: none. The behavior and its specification landed in `c5b36f0`
  and `52ab234`.
