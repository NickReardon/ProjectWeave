---
type: decision
id: "0009"
area: writes
status: accepted
canonical: false
affects: ["10"]
---

# ADR 0009: Cross the write boundary with a create-only port and a re-checking commit service

- Status: accepted
- Date: 2026-08-03
- Owners: Project Weave

## Context

Every slice until now was read-only, which made the safety story simple: the
plugin could not damage a vault because it could not write to one. Task
creation ends that. The preview surface already showed the exact target path,
preconditions, rendered bytes, and expected postconditions, which is the
precondition the handoff set for building a write path.

The risk is not that a write is wrong once. It is that a write path capable of
modification becomes reachable from somewhere that was never reviewed for it.
`AGENTS.md` forbids a generic write-capable vault port for exactly this reason,
and the original plan required every content write to be triggered by a named command
or direct UI action.

A second risk is subtler: a proposal is built from notes read at one moment and
confirmed at another. Between those, the project note or template can change,
and writing the earlier bytes would create a note the user never saw.

## Decision

**A create-only port.** `NoteWriter` exposes one operation — create a note that
does not exist — and returns a typed outcome. It has no method that expresses
overwrite, move, or delete, so a caller that is wrong about everything else
still cannot damage existing content. Only `TaskCreationCommitService` may use
it.

**Defence in depth in the adapter.** `ObsidianNoteWriter` writes through
`Vault.create` and `Vault.createFolder`, never the filesystem. It refuses a
path that is not a safe normalized Markdown path, refuses a path outside the
configured project roots, and refuses a path that already exists. Obsidian
rejects an existing path itself, so non-overwrite is enforced by the platform
and not only by our check. Missing parent folders are created only as part of a
confirmed creation that needs them.

**Commit re-checks, then writes the confirmed bytes.** The commit service
implements the single-file sequence in design 10: re-read the proposal's read
set and compare fingerprints, re-check that the target is absent, re-validate
the produced note in memory, then write once. It writes the proposal's own
bytes rather than re-rendering, so a confirmed preview can never become a
different note. Any drift aborts, and every failure reports that the vault is
unchanged.

A packaged template is exempt from the read-set re-read. It ships inside the
plugin build, has no vault note behind it, and cannot drift while the plugin is
loaded. Project-owned templates are re-read like any other input.

**Confirmation is a named action.** The button says what it will do, is
disabled until a valid proposal exists, and dismissing the modal writes
nothing. Opening the created note is opt-in.

## Alternatives considered

- **A general `writeNote(path, content)` port:** rejected. It expresses overwrite by construction, so every future caller becomes a place where data loss must be re-argued. `AGENTS.md` forbids it directly.
- **Re-rendering at commit instead of writing the proposal's bytes:** rejected. It would silently resolve drift by producing something the user never reviewed, which is precisely the failure the preview exists to prevent.
- **Ignoring read-set drift because the index revision is unchanged:** rejected. Design 17 allows unrelated revision changes but requires the touched inputs to be re-compared; an edit to the project note is not unrelated.
- **Auto-opening the created note:** rejected as a default. Design 10 says to navigate only if requested, and an unexpected tab switch after a write is disorienting.
- **Deferring folder creation to a settings step:** rejected. Design 12 explicitly permits creating folders as part of a confirmed creation that needs them, and a separate step would create folders for tasks that are never made.
- **Supporting multi-file proposals now:** deferred. Design 10 requires partial-success reporting and a no-write-if-any-changed rule for those, which is a larger contract than one note needs.

## Consequences

- Positive: the plugin can create tasks, completing the first vertical slice from design note to backlog item.
- Positive: the blast radius of a bug in the write path is bounded by the port's shape — a new note at a safe in-scope path, or nothing.
- Positive: a stale confirmation is refused rather than written, so the preview's guarantee holds across time.
- Negative: creation is proven only against test doubles until the manual vault check runs. The Obsidian adapter has no automated coverage.
- Negative: the packaged-template exemption is a correctness argument, not an enforced invariant; a future packaged template loaded from disk at runtime would need the exemption revisited.
- Follow-up: multi-file proposals, editing existing notes, and rank rebalancing all need write paths this ADR deliberately does not open.
