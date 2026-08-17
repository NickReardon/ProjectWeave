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

`test/brat-preview-acceptance` contains the prerelease collision fix plus the
public-readiness documentation slice: MIT license, named support metadata,
contribution/security guidance, privacy/network disclosures, current preview
references, and a pinned companion checksum/install path. The earlier corrected
run `32012926052` published `0.7.0-beta.32012926052` from `de86a86`; these
follow-up changes pass the repository gate and are ready to commit and push.

## Verified

The prior branch gate passed: 368 Vitest tests, 51 script tests, zero
diagnostics across 80 dogfood notes, the production build, and separate plugin
and companion inventories. The corrected remote publication passed the same
gate, and direct release inspection verified its exact asset inventory,
manifest version, source SHA, and companion checksum. The new docs/metadata
slice also passes the post-change gate.

## Next

1. Commit and push the public-readiness slice.
2. Test BRAT from the prepared clean disposable vault and finish recording
   [[Tasks/Accept the BRAT preview and optional companion setup]].
3. Exercise the optional companion install, scoped client, and failure paths.
4. Decide when to make the repository public after the clean-checkout review of
   [[Tasks/Prepare public preview metadata and optional agent setup]].
   [[Tasks/Prepare public preview metadata and optional agent setup]].

## Loose ends

- BRAT and companion-client acceptance require interactive external clients and
  remain unverified even though the release artifacts themselves are verified.
- GitHub's public visibility, secret scanning, and branch-protection settings
  remain external repository decisions; no visibility change has been made.
- The repository is private, so beta.1 proves the authenticated path rather than
  the eventual public no-token installation experience.
- `docs/IMPLEMENTATION_ORDER.md` remains a compatibility pointer with no inbound
  references and is still a deletion candidate.
