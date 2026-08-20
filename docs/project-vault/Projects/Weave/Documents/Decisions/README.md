# Project Weave Decision Records

## Purpose

This directory is the project's decision log. A record states a decision that
was made, the forces that made it necessary, what was rejected, and what
followed. It is history.

A decision record has **no authority over current behavior**. That is not a
ranking — it follows from what the document is. A record describes a moment
that has passed, so it cannot be the place a reader learns what is true today.
[`../Specifications/`](../Specifications/README.md) owns current behavior, and a rule a
reader must obey belongs there.

## Lifecycle

Records are **point-in-time and immutable**. Once a record is accepted its body
is not edited.

- A decision that changes is expressed by writing a **new record** that
  supersedes the old one. The superseded record keeps its text and gains
  `superseded_by` in its frontmatter.
- When a later record replaces only **part** of an earlier one, the earlier
  record keeps `status: accepted` and gains no `superseded_by`, because most of
  it still holds. The new record names precisely which part it replaces and
  which parts stand. `superseded_by` means the whole decision was replaced.
- The only permitted edits to an accepted record are typography and broken
  links.
- A record whose rationale still holds but whose behavior has since been
  refined is not updated; the specification is.

This is why the log is worth keeping. A record that is rewritten to stay
current is no longer evidence of why a choice was made, and an editable record
becomes an attractive home for live rules — which is what
[ADR 0022](0022-separate-living-specifications-from-point-in-time-decision-records.md)
was written to end.

## Writing one

Copy [`0000-template.md`](0000-template.md). Keep it short: a record states a
decision, not a design.

```yaml
type: decision
id: '0023'
area: tasks # subject, shared with the specifications
status: proposed | accepted | superseded | rejected
canonical: false # never true; specifications are canonical
affects: ['task-management', 'scheduling-and-milestones'] # specifications this decision changed
superseded_by: '0031' # present only on superseded records
```

A behavior change ships as the record, the owning specification update, and one
commit containing both.

## Numbering

**`id` in the frontmatter is the identifier.** It is what other documents cite
and what the index will key on, so every record declares one. The number in the
filename and the number in the `# ADR NNNN` heading are conveniences for a
reader scanning a directory listing; they must agree with the declared `id`,
and now that the log lives in the vault the filename may stop carrying a number
at all. A record without an `id` has no identity, whatever it is called.

A number is never reassigned and never reused: take the next free one, read
from the records rather than counted from the directory. Gaps are not defects.
`0027` was never issued and nothing is missing, because a number names a record
rather than counting the log.

One collision survives. `0025` is declared by both
[merge-ready current work](0025-merge-ready-current-work-and-evergreen-release-docs.md)
and [name specifications by subject](0025-name-specifications-by-subject.md);
both were accepted before it was noticed. It stands as history rather than being
corrected, because renumbering either one would edit an accepted record and
break the identifier it is cited by, which is the edit immutability exists to
prevent. Cite either of the two by filename rather than by number.

`npm run docs:links` enforces all of this: an `id` on every `type: decision`
note, agreement with the filename number and the heading, and uniqueness across
the set. The historical pair is grandfathered by filename, so a third record
declaring `0025` still fails.

## Scope test

If removing a paragraph from a record would leave a reader unable to implement
something correctly, that paragraph belongs in a specification. Records that
fail this test are defects; the four that failed it historically — 0008, 0012,
0013, and 0018 — were corrected under ADR 0022.
