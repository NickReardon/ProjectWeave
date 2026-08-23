---
type: task
title: Settle the atomicity claim when grant rollback itself fails
project: '[[Projects/Weave/Project]]'
epic: '[[Epics/Epic-agent-grant-lifecycle]]'
status: backlog
category: loose-end
priority: normal
rank: 5850
milestone: '[[Milestones/v1 release]]'
created: 2026-08-23
---

# Settle the atomicity claim when grant rollback itself fails

## Summary

Grant creation and configuration delivery are atomic by rolling back: if the
clipboard write fails, the grant is removed. That path is real and covered by a
test that fails when the rollback call is deleted.

One step further out, the guarantee is weaker than the specification states. If
the clipboard write fails **and** the rollback's own save also fails, the grant
survives with its configuration never delivered.
[[Documents/Specifications/agent-access-and-mcp|Agent access and MCP]] states
the invariant absolutely — that no reachable state has a grant existing without
its secret captured — so the text currently claims more than the code provides.

## Why it is not simply a defect

The consequence is mild and visible: both failures surface to the user, and the
grant appears in the grant list where it can be revoked. Nothing silently
retains access. What is wrong is the absolute phrasing of a guarantee with a
reachable exception, in a specification that owns current behavior.

## The choice to make

- **Soften the claim** to describe rollback as the mechanism and name the
  double-failure case as the exception, keeping the code as it is.
- **Close the path** in `src/main.ts` so the grant cannot outlive a failed
  delivery, and keep the absolute claim.

The first is honest and cheap. The second costs more and needs a definition of
what "cannot fail" means when the failing operation is the persistence layer
the rollback depends on.

## Acceptance criteria

- The specification and the implementation agree about what atomicity
  guarantees, with no absolute claim that has a reachable exception.
- If the claim is softened, the exception is named where the guarantee is
  stated, not only in a task note.
- Whichever way it is settled, a test covers the resulting boundary.

## Notes

Found while auditing [[Tasks/Restructure agent grant creation into
validate-then-create]] against the shipped code. It does not block that task,
whose own criterion is about no partial state being reachable through the
ordinary clipboard-failure path.
