---
type: task
title: Revisit whether the agent grant secret is load-bearing
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-shared-reads-agent]]'
status: done
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

## Outcome

Settled as
[[Documents/Decisions/0034-keep-the-grant-secret-alongside-owner-only-sockets|ADR 0034]]:
the secret stays, alongside the owner-only socket permissions that landed in
`5bf05ea`. The two are not competing answers — permissions decide who may open
the endpoint, the secret decides which grant a connection speaks for.

The premise this note was parked on is gone, which is what made the question
decidable. Socket exposure was the one case where the gateway granted access
the filesystem did not, and it now binds 0600 from the instant the file exists.
What survives that fix, stated as capability the filesystem does not grant:

- **Windows has no owner restriction at all.** A named pipe has no mode bits,
  so the fix is POSIX-only and its assertion is skipped on `win32`. On the
  platform this project is developed on, the secret is the only control.
- **Scope binding is per grant; permissions are per user.** Every grant belongs
  to the same operating-system user, so no file mode can express "this project
  and these content roots and no others". Without a credential the caller
  asserts its own scope, and [[Epics/Epic-shared-reads-agent]]'s "one grant
  cannot read another project" exit criterion becomes unenforceable.
- **Removal is one-way**, with agent writes queued behind
  [[Epics/Epic-mutation-kernel]].

Digest-only storage and once-only delivery were already settled above and the
record restates why they follow from keeping a secret at all: `data.json` syncs
and, for this project, is committed to git.

No behavior changed and no specification needed to change:
[[Documents/Specifications/agent-access-and-mcp|Agent access and MCP]] already
requires both the owner-only bind and per-connection authentication to one vault
grant. The revisit triggers in this note carry into the record unchanged, with
one addition: Windows gaining an owner-restricted pipe would not on its own
reopen the question, because scope binding would still need a credential.
