---
type: decision
id: '0023'
area: dogfooding
status: accepted
canonical: false
affects: ['0015']
---

# ADR 0023: Make current work a mid-flight record and let commits carry verification history

- Status: accepted
- Date: 2026-08-16
- Owners: core

## Context

[ADR 0015](0015-track-project-state-in-weave-itself.md) split
`docs/CURRENT_WORK.md`: task-shaped content moved into the dogfood vault, and
the automated-verification log stayed in Markdown as append-only evidence. The
reasoning was that evidence is a statement about a commit that already
happened, so making it mutable task state would destroy what makes it evidence.

Two premises behind that split have since expired.

**The manual-check status has already moved.** ADR 0015 rejected deleting the
file because doing so "loses the manual-check status, which no other artifact in
the repository carries." Checks 01 through 17 are now vault task notes carrying
that status directly, so the largest reason to keep the file no longer applies
to what remains in it.

**Git already is the immutable record.** The evidence log is a hand-written
prose paragraph per gate run, each naming a commit. Nothing verifies those
claims, and nothing keeps them in step with the history they describe: the last
entry names `ef1db32` while six later commits and six patch versions have
landed. A record that is supposed to prove something about the past, and that no
one maintains, proves less than the commit history it paraphrases.

Meanwhile the state Git genuinely cannot hold is the state the file is forbidden
from carrying. What is half-finished on this checkout, what has been verified
but not committed, and what the next step is are all mid-flight facts, and
`scripts/verify-current-work.mjs` rejects exactly that shape — `## Snapshot`
sections, `**Branch:**` fields, and branch identifiers are all treated as
"volatile checkout state" to be kept out.

ADR 0015 anticipated this outcome. Its follow-up work records that the
current-work gate and its Node test "retire or retarget" at cutover.

## Decision

Turn `docs/CURRENT_WORK.md` into a short mid-flight record, and let the commit
history carry the accounting.

- **`CURRENT_WORK.md` holds in-flight state only:** what is being worked on now,
  what has been verified on this checkout, what is not yet committed or merged,
  and the next step. It is **rewritten, not appended.** Its natural length is a
  screen, and a stale entry is a defect rather than history.
- **Verification history lives in commits.** A commit that changes behavior
  states the gate result for that change in its message. `git log` is the
  accounting, and it cannot drift from the commits it describes because it is
  made of them.
- **Task state changes travel in the commit that does the work.** Moving a task
  note to `done` is part of the change, so the history of task state is the
  commit history, with no second record to keep in step.
- **The accumulated log is archived** to `docs/archive/`, which is authoritative
  over nothing, rather than deleted. It describes real gate runs and stays
  readable there.
- **The guard inverts.** `scripts/verify-current-work.mjs` stops rejecting
  checkout state, which is now the file's purpose, and starts rejecting
  accumulation — dated evidence entries and unbounded growth.

This supersedes ADR 0015's disposition of the automated-verification section.
The rest of ADR 0015 — moving task-shaped content into the vault — stands and is
unchanged by this record.

## Alternatives considered

- **Delete `CURRENT_WORK.md` entirely,** the option ADR 0015 rejected: closer to
  viable now that the manual checks have moved, but still rejected. Mid-flight
  state has no other home, and a fresh checkout would offer no way to tell what
  is half-done or verified-but-uncommitted.
- **Keep the append-only log and add a separate in-flight file:** rejected. Two
  files with adjacent purposes invite the same drift, and the log is already
  unmaintained with nobody having noticed for six commits.
- **Keep the log but generate it from CI:** rejected. A generated log would
  faithfully reproduce information `git log` already holds, at the cost of a
  build step and a file that must not be hand-edited.
- **Retire the guard rather than retarget it:** rejected. The file reached
  roughly 420 lines once already. The failure mode is re-accumulation, and a
  guard costs little compared with rediscovering that.
- **Record gate results in the task notes instead of commit messages:** rejected.
  A task note is mutable, so it has the same weakness as the log; the commit that
  ran the gate is the thing that cannot change afterwards.

## Consequences

- Positive: one accounting instead of two, and it is the one that cannot drift
  from what actually happened.
- Positive: the file becomes useful to resume from, because it answers "where
  was I" rather than "what has ever passed".
- Positive: commit messages carry verification, so a reviewer sees the gate
  result beside the change it covers.
- Negative: verification history becomes less browsable. Reconstructing what
  passed when means reading `git log` rather than one page.
- Negative: commit message discipline now matters more, and a commit that omits
  its gate result loses that evidence with no file to catch the omission.
- Negative: a mid-flight file is expected to be stale between sessions in a way
  an append-only log was not, so its staleness stops being a signal.
- Follow-up work: `AGENTS.md` and `docs/AGENTS.md` carry rules about appending
  to `CURRENT_WORK.md`; both change here. The guard and its Node test retarget
  here rather than at a later cutover.
