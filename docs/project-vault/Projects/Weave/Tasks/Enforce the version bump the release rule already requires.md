---
type: task
title: Enforce the version bump the release rule already requires
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-stabilize-and-shipping]]'
status: backlog
category: chore
priority: high
rank: 2350
milestone: '[[Milestones/v1 release]]'
created: 2026-08-18
---

# Enforce the version bump the release rule already requires

## Summary

The release procedure already states the rule: bump the patch before exporting
a build that differs from the last exported one, because a version identifies
an installed build and two builds that behave differently must never share a
number.

Nothing enforces it. `npm run version:check` verifies only that
`package.json`, `manifest.json`, and `versions.json` agree with each other. It
never asks whether the version moved when the build did, so the gate passes
happily while several differing builds ship under one number.

That is how `main` came to export the desktop gateway fix, the documentation
link gate, and the agent grant redesign while still calling itself `0.6.0`,
and it is what makes "passed against the installed 0.6.0 build" on a manual
check note mean less than it should.

## The related mistake

Prerelease `target_version` is a free-text workflow input, so a preview asserts
its intended stable version rather than deriving it. Two previews were
published as `0.7.0-beta.*` while the repository read `0.6.0`, and a third
inherited that number by precedent rather than by rule — a minor increment is
reserved for a slice Epic passing its exit gate, and none had.

Deriving the target from `package.json` removes the assertion, and with it this
whole class of mistake.

## Acceptance criteria

- The gate fails when the exported build differs from the last released or
  exported one and the version has not moved.
- Prerelease `target_version` is derived from the canonical project version
  rather than typed, or is validated against it.
- The check states which build it compared against, so a failure is actionable
  rather than a bare refusal.
- Re-exporting an unchanged tree still needs no bump, matching the existing
  rule.

## Notes

The hard part is defining "differs" cheaply. Comparing the built `main.js` and
`styles.css` against the last released artifacts is one option; comparing the
source tree against the last release tag is another. Whichever is chosen, it
has to run inside the ordinary gate rather than becoming a separate job.
