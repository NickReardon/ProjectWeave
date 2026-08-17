---
type: task
title: Revisit whether the agent grant secret is load-bearing
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-shared-reads-agent]]'
status: backlog
category: loose-end
priority: normal
rank: 5900
milestone: '[[Milestones/v1 release]]'
created: 2026-08-17
---

# Revisit whether the agent grant secret is load-bearing

## Summary

Grant creation issues a secret, stores only its digest, and delivers the
plaintext exactly once. The current decision is to keep that and get the flow to
a workable state — see
[[Tasks/Restructure agent grant creation into validate-then-create]] — rather
than settle the underlying question now. This note exists so the question is not
re-derived from scratch each time someone meets the once-only secret.

## The open question

A vault is plain Markdown on the user's own disk. Any process running as that
user can read it directly, without the gateway, the grant, or the secret. So for
a local, read-only gateway the secret authenticates a strictly weaker path to
data the caller already has, which is close to no protection at all.

What survives that argument is narrower than it first appears:

- **Socket exposure.** `server.listen(endpoint)` sets no explicit mode, so on
  Linux and macOS the socket file's permissions fall to the process umask.
  Another *user* on a shared machine — who genuinely cannot read the vault
  files — may be able to connect. This is the one case where the gateway grants
  access the filesystem does not, and the direct fix is owner-only socket
  permissions rather than a secret. See
  [[Tasks/Restrict the agent gateway socket to its owner]].
- **Grant scoping.** "One grant cannot read another project" is an exit-gate
  criterion for [[Epics/Epic-shared-reads-agent]], and without a credential it
  is unenforceable. But it protects against an over-broad well-behaved agent,
  not against an attacker, and a hostile client bypasses scoping by reading the
  filesystem.
- **Future capability.** The calculus changes if the endpoint ever becomes
  reachable beyond the local machine.

## What is settled regardless

If a secret exists at all, storing only its digest is correct and the once-only
delivery follows from that. Grants live in `data.json` inside the vault, which
syncs through Obsidian Sync or iCloud and, for this project, is committed to
git. A recoverable secret would put a plaintext credential somewhere it leaves
the machine entirely — a worse exposure than anything the secret defends
against locally.

## Revisit when

- Agent writes land through [[Epics/Epic-mutation-kernel]], or
- the gateway is reachable from anywhere but the local machine, or
- the once-only secret proves to be a real obstacle in practice rather than a
  theoretical one.

## Acceptance criteria

- The choice between keeping the secret as-is, keeping it alongside owner-only
  socket permissions, and dropping it in favour of operating-system permissions
  is settled and recorded as a decision.
- The rationale states what the secret defends against, in terms of capability
  the filesystem does not already grant.
