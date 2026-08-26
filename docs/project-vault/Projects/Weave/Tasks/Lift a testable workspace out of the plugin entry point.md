---
type: task
title: Lift a testable workspace out of the plugin entry point
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-creation-pipeline]]'
status: backlog
category: enhancement
priority: high
rank: 6300
milestone: '[[Milestones/v1 release]]'
created: 2026-08-19
---

# Lift a testable workspace out of the plugin entry point

## Summary

`src/main.ts` is 854 lines, the highest-churn file in the repository, and has
no test file. `ProjectWeavePlugin extends Plugin`, so everything on it is
reachable only by constructing an Obsidian plugin.

## What is not wiring

The settings write-through is copied seven times — five `updateX` methods plus
the two grant mutations — each ending `await this.saveData(next); this.settings
= next` and then doing something different: replace the runtime, rebuild the
index, rebind the read source, republish diagnostics, refresh the agent bridge.

The copied half is the boring half. The interesting half — which settings change
invalidates what — is never stated anywhere as one thing. It is recovered by
reading five method tails and comparing them.

A second consequence: because the plugin cannot be constructed in a test,
`tests/ui/settings-tab.test.ts` duck-types it as an object literal, and nothing
checks that the stub still resembles the real plugin.

## Solution

A `WeaveWorkspace` holding settings, the runtime, and the invalidation table,
behind a `SettingsStore` port with `load()` and `save()` that `main.ts`
satisfies with `loadData`/`saveData`. `main.ts` keeps `onload`, view, command
and ribbon registration, and adapter construction — the things that genuinely
need `Plugin`.

## Acceptance criteria

- The invalidation table is one readable declaration rather than five method
  tails, and is covered by tests over an in-memory settings store.
- `src/main.ts` contains registration and adapter construction only.
- The settings-tab test drives a real workspace rather than a hand-written stub.
- Settings persistence behavior is unchanged, including the first-run write.

## Notes

Sequenced before [[Tasks/Collapse the two creation ladders into one pipeline]],
which rewrites the entry point's two creation openers: doing that against a
workspace rather than against `Plugin` means the new wiring lands somewhere
testable the first time. The ordering is a convenience, not a dependency.

## What is currently untestable because of this

`onExternalSettingsChange` reconciles six settings against their side effects.
Three are observable from a constructed plugin and are covered: the adopted
grant list, the derived client endpoint, and the blank-vault-id guard. The
other three — reindexing on changed roots or categories, rebinding the template
reader, and republishing diagnostics — reach services that only exist after
`onload`, so removing any of those branches leaves the suite green.

The serialization guard on `#refreshAgentBridge` is untestable for the same
reason: reaching it needs an enabled gateway, which binds a real socket.

`tests/helpers/obsidian-stub.ts` gained a `Plugin` base deliberately too small
to run `onload`, which registers views, commands, a ribbon icon, and workspace
listeners. Growing it into a real harness is this task.
