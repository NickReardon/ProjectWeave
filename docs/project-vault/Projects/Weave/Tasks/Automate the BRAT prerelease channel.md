---
type: task
title: Automate the BRAT prerelease channel
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-stabilize-and-shipping]]'
status: waiting
category: chore
priority: high
rank: 2600
milestone: '[[Milestones/v1 release]]'
depends_on: ['[[Tasks/Separate plugin and companion release inventories]]', '[[Tasks/Prepare public preview metadata and optional agent setup]]']
origin: '[[Documents/Design/Prerelease and optional MCP companion distribution]]'
created: 2026-08-16
---

# Automate the BRAT prerelease channel

## Summary

Add a manually dispatched publication workflow that builds an exact source ref,
runs the complete gate, and publishes one unambiguous Project Weave prerelease.

## Acceptance criteria

- Dispatch requires an explicit source ref and intended stable target version.
- Release tag, release name, and generated prerelease manifest version match.
- The workflow publishes `main.js`, `manifest.json`, and `styles.css` as the
  BRAT-installable assets.
- The same release attaches the separately checksummed
  `project-weave-mcp.cjs` without claiming BRAT installs it.
- Release notes record source SHA, validation result, compatibility, test focus,
  companion checksum, and preview limitations.
- A failed gate or inventory check publishes nothing.

## Validation

Exercise a dry run or disposable prerelease, inspect every asset and digest,
and confirm the workflow cannot publish from an ambiguous or failing source.

The manual workflow, generated-version build override, manifest stamping,
release-note generator, checksum verification, and failure-before-publication
ordering are implemented and covered locally. Completion waits on the public
metadata dependency and an explicitly authorized workflow run. Private
prerelease `0.7.0-beta.1` was published manually from `06dbdd0` to test the
artifact updater, so the workflow itself remains unexercised.

The first authorized workflow run on 2026-08-17 passed the complete gate and
artifact build, then correctly published nothing because its workflow-local run
number derived the already existing manual tag `0.7.0-beta.1`. The follow-up fix
uses GitHub's globally unique run ID so manual and automated previews cannot
collide; a successful publication run is still required.
