---
type: epic
title: Add Controlled Documents and Agent Slice D
project: '[[Projects/Weave/Project]]'
status: planned
owner: ''
origin: '[[Projects/Weave/Project]]'
created: 2026-08-07
milestone: '[[Milestones/v1 release]]'
---

# Add Controlled Documents and Agent Slice D

## Summary

One shared document patch engine for previewed ordinary-Markdown operations. New document creation with collision refusal; replace/append beneath resolved heading; insert new section at reviewed location; preserve frontmatter/newline style/untouched bytes; reject ambiguous anchors/config paths/binaries/out-of-allowlist paths. Agent Slice D with exact diffs, fingerprints, approval, and audit outcomes.

### Governing documents

- [Design 17 — Agent Slice D](../../../../spec/17-agent-access-and-mcp.md#agent-slice-d--controlled-document-writes)
- [Design 17 — Initial Security Profile](../../../../spec/17-agent-access-and-mcp.md#initial-security-profile)
- [Design 18 — Project-Owned Templates](../../../../spec/18-project-note-templates.md)

### Exit gate

Every patch produces an exact reviewed diff and preserves untouched bytes; entity/template/path/approval bypass attempts fail before writing.

## Progress

> Derived from member tasks.

<!-- progress-placeholder -->
