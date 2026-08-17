---
type: status
status: current
canonical: false
---

# Project Weave Current Work

## Purpose

The **mid-flight record**: what is in flight on this checkout, what is verified,
what is next. Rewritten at the end of every change, never appended to. A screen
at most; a stale section is a defect.

Verification and task-state history live in `git log`, which cannot drift from
the commits it describes. Outstanding work lives in `docs/project-vault/`.
Intended behavior lives in `docs/spec/`. See
[ADR 0023](decisions/0023-make-current-work-a-mid-flight-record.md); runs before
`ef1db32` are in [`archive/AUTOMATED-VERIFICATION-LOG.md`](archive/AUTOMATED-VERIFICATION-LOG.md).

## In flight

`test/brat-preview-acceptance` fixes the prerelease workflow's first real-run
collision with manually published `0.7.0-beta.1`. The failed run passed the full
gate and artifact build, then published nothing because the tag-existence guard
rejected the duplicate. Preview versions now use the globally unique GitHub run
ID, with regression coverage; publication and BRAT acceptance remain to run.

## Verified

Focused prerelease tests and formatting pass on the branch. The failed remote
run passed the complete gate, production build, plugin/companion export,
manifest stamping, companion checksum, and payload staging before the duplicate
tag guard stopped publication.

## Next

1. Validate, commit, and push the unique-version fix; rerun the prerelease
   workflow from that exact commit.
2. Test BRAT from a clean disposable vault and finish recording
   [[Tasks/Accept the BRAT preview and optional companion setup]].
3. Decide and record the public license, author/support metadata, and companion
   install location needed by
   [[Tasks/Prepare public preview metadata and optional agent setup]].

## Loose ends

- `0.7.0-beta.1` was published manually from a commit before the authenticated
  private-asset fix; the workflow's first run exposed the version collision and
  published nothing.
- The repository is private, so beta.1 proves the authenticated path rather than
  the eventual public no-token installation experience.
- `docs/IMPLEMENTATION_ORDER.md` remains a compatibility pointer with no inbound
  references and is still a deletion candidate.
