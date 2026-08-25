---
type: decision
id: '0034'
area: agent-access
status: accepted
canonical: false
affects: ['agent-access-and-mcp']
---

# ADR 0034: Keep the grant secret alongside owner-only socket permissions

- Status: accepted
- Date: 2026-08-23
- Owners: core

Once this record is accepted, its body is not edited. A decision that changes
is superseded by a new record; see [`README.md`](README.md).

## Context

[ADR 0018](0018-agent-gateway-transport.md) decided that the pipe is not the
authentication and that every connection presents a grant secret;
[ADR 0028](0028-immutable-dialog-based-agent-grants.md) made the secret's
one-time delivery part of an atomic create. Neither answered the question
underneath: a vault is plain Markdown on the user's own disk, so any process
running as that user can read it without the gateway, the grant, or the secret.
For a local read-only gateway the secret mostly authenticates a weaker path to
data the caller already has.

The one case that survived that argument was socket exposure — a socket file
taking its mode from the process umask, reachable by a different local user who
genuinely cannot read the vault — and the answer to it was owner-only
permissions rather than a credential. That answer has since shipped: `5bf05ea`
binds the Unix-domain socket 0600 from the instant it exists. The premise the
question was parked on is therefore gone, and the choice between keeping the
secret, keeping it alongside the new permissions, and dropping it in favour of
operating-system permissions is now decidable.

## Decision

The grant secret stays, alongside owner-only socket permissions. The two are
not alternatives: file permissions decide who may open the endpoint, and the
secret decides which grant a connection speaks for.

Stated as capability the filesystem does not already grant:

- **On Windows the pipe carries no owner restriction as we create it.** A named
  pipe has no POSIX mode bits, so `5bf05ea` is a POSIX-only fix and its test is
  skipped on `win32`. Windows does have its own access control for named pipes
  — a security descriptor with a DACL — but the Node and libuv path this plugin
  binds through exposes no way to supply one, so the pipe is created with the
  default descriptor rather than an owner-only one. The gap is in what we can
  install through this transport, not in what the platform can express. On the
  platform this project is developed on, the secret is the only thing refusing a
  connection from another local user.
- **Scope binding is per grant, and permissions are per user.** Every grant on
  a machine belongs to the same operating-system user, so no file mode can
  express "this connection may read this project and these content roots and no
  others". Without a credential the caller would simply assert which grant it
  is. This contains a mis-scoped but well-behaved agent, which is the threat the
  read-only gateway is actually for; a hostile local process is not in scope,
  because it reads the vault directly.
- **Removal is one-way.** Writes are queued behind the mutation kernel, and
  re-introducing per-connection authentication after clients are configured
  without it is worse than carrying it now.

Because a secret exists, two things follow rather than being separately chosen:
it is stored only as a digest, and the plaintext is delivered exactly once.
Grants live in `data.json`, which syncs through Obsidian Sync or iCloud and, for
this project, is committed to git — a recoverable secret would put a plaintext
credential somewhere it leaves the machine, which is a worse exposure than
anything it defends against locally.

This decision changes no behavior and needs no specification change:
[Agent access and MCP](../Specifications/agent-access-and-mcp.md) already
requires both the owner-only socket bind and per-connection authentication to a
single vault grant.

## Alternatives considered

- **Keep the secret as the only control, unchanged:** rejected, and already
  overtaken. It left the endpoint openable cross-user on POSIX and refused the
  caller only after the connection existed, which is the weaker place to refuse.
- **Drop the secret in favour of operating-system permissions:** rejected. The
  permissions we can currently install are POSIX-only, and even where they hold
  they cannot express grant scope, so dropping the secret would trade an
  enforced binding for an unenforceable one and would leave the Windows pipe
  guarded by nothing.
- **Make the secret recoverable so it can be shown again:** rejected. It would
  write a plaintext credential into synced, committed settings; revoking and
  recreating a grant is the recovery path, which ADR 0028's immutable grants
  already make the norm.
- **Defer the question again:** rejected. It was parked on socket exposure, and
  that is fixed; leaving it open would mean re-deriving the same argument a
  third time.

## Consequences

- Positive: each control answers one question, so neither has to be justified by
  the other, and the unrestricted pipe is covered by something rather than by
  nothing.
- Negative: the marginal protection on POSIX, against a process run by the same
  user, remains close to zero. The cost is paid for the Windows case and for
  scope binding, not for local secrecy.
- Negative: the setup friction stands — a secret configured per repository, and
  a lost secret meaning revoke and recreate.
- Follow-up work: none. Revisit if agent writes land through the mutation
  kernel, if the endpoint becomes reachable beyond the local machine, or if
  once-only delivery proves an obstacle in practice rather than in theory.
  Gaining a way to bind the pipe with a restrictive DACL would not on its own
  reopen this, because scope binding would still need a credential.
