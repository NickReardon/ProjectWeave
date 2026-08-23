---
type: task
title: Document the companion launch ordering requirement
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-shared-reads-agent]]'
status: done
category: chore
priority: high
rank: 5600
milestone: '[[Milestones/v1 release]]'
created: 2026-08-17
---

# Document the companion launch ordering requirement

## Summary

Moving the gateway handshake to connect time — see
[[Tasks/Verify the MCP companion gateway handshake at connect time]] — made the
companion exit non-zero at startup when it cannot reach the gateway. That is the
intended diagnosability improvement, but it introduces an ordering requirement
that did not exist before and is currently undocumented.

Previously the bridge connected lazily, so a companion launched before Obsidian
started would wait harmlessly and work once the vault opened. It now fails fast.

## Why this matters in practice

MCP clients commonly spawn every configured stdio server at client startup. A
user who opens their MCP client before Obsidian will therefore see the Project
Weave server fail immediately, with a message about the gateway being
unreachable, even though nothing is misconfigured. Restarting Obsidian likewise
leaves the already-launched companion dead until the client respawns it.

The failure message is accurate and actionable, so this is a documentation gap
rather than a defect. The alternative — retrying at startup instead of exiting —
would restore the ambiguity the connect-time handshake was introduced to
remove.

## Acceptance criteria

- The README states that Obsidian must be running with the vault open before
  the MCP client launches the companion.
- It states what a user should do after restarting Obsidian, in whatever terms
  their client offers for restarting a server.
- The guidance sits with the client configuration material rather than in the
  download section.

## Notes

Fold this into
[[Tasks/Add a companion troubleshooting section to the README]] if that work is
picked up first; the two overlap and should not produce two separate accounts
of the same behavior.

## Outcome

Landed together with
[[Tasks/Add a companion troubleshooting section to the README]] as one
account, as the note above required. `README.md` gained a single
`### Starting order and troubleshooting` subsection at the end of
`## Read-only agent access` — with the client configuration material, not the
download section.

The subsection states why order matters (the companion verifies connectivity,
authentication, and the release tag at startup and exits non-zero instead of
waiting), then the requirement: Obsidian must already be running with the
granted vault open and the gateway enabled before the MCP client launches the
companion, because most clients spawn every configured stdio server when the
client itself starts. It also states the restart case — the companion the
client already launched stays dead after Obsidian restarts, so the server must
be restarted through whatever the client offers: a per-server restart or
reconnect control, an MCP configuration reload, or restarting the client.

All three acceptance criteria are met. No behavior changed; this was a
documentation gap, and the fail-fast handshake is left as designed.
