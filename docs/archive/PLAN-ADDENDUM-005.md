---
type: archive
status: archived
canonical: false
---

# Project Weave Plan Addendum 005

> **Archived and non-authoritative.** This document is history. Current
> behavior is defined in [`docs/spec/`](../spec/README.md); see
> [the archive index](README.md).

## Status

Accepted v1 template direction. This addendum makes project-owned note templates part of the shared UI and agent creation contract.

## Objective

Every Project Weave project can carry replaceable Markdown templates for the notes it creates: tasks, epics, milestones/releases, planning periods, designs, and other project documents. The project note references those templates so the same structure is used by every team member, Project Weave UI command, and connected agent.

Templates define creation defaults and document shape. They do not become a second database and are never reapplied automatically to existing notes.

## Project configuration

A project MAY reference one default and named variants per note kind:

```yaml
weave:
  templates:
    task:
      default: "[[Project/Templates/Task]]"
      bug: "[[Project/Templates/Bug Task]]"
      research: "[[Project/Templates/Research Task]]"
    epic:
      default: "[[Project/Templates/Epic]]"
    milestone:
      default: "[[Project/Templates/Milestone]]"
    planning_period:
      default: "[[Project/Templates/Cycle]]"
    document:
      default: "[[Project/Templates/Document]]"
      design: "[[Project/Templates/Design]]"
      decision: "[[Project/Templates/Decision]]"
```

Missing configuration uses packaged minimal defaults without passively writing project content. New Project and Initialize Project Templates can explicitly materialize editable template notes and their references through a reviewed multi-file proposal.

## Template note contract

Templates are ordinary Markdown notes marked with reserved metadata:

```yaml
weave_template: true
template_for: task
```

They may otherwise resemble the target note. Project Weave excludes marked template notes from entity indexing. On render it removes template-only metadata, resolves supported variables, applies operation/context values, enforces invariant entity fields, and validates the complete result before proposing a write.

## Creation precedence

1. Packaged minimal template, when no project reference exists.
2. Referenced project template content/defaults.
3. Creation context such as current project, origin, default status, date, and allocated rank/path.
4. Explicit user or agent inputs.
5. Final invariant overlay and schema/global validation.

A template cannot override the entity type, selected project, safe target path, or another operation invariant.

## Replacement and evolution

- Editing a referenced template changes future creations only.
- Repointing a project template key changes future selections only.
- Existing tasks/documents remain byte-for-byte unchanged.
- Pending creation proposals include the template fingerprint and become stale if it changes.
- A broken or incompatible explicit reference disables that creation path with an actionable error; fallback is an explicit choice, never silent.
- Template deletion/move/rename remains an ordinary user action outside passive plugin behavior.

## UI integration

- Create forms use the project's default automatically.
- When named variants exist, show a compact template picker.
- One available template does not add unnecessary UI.
- Preview shows selected template, resolved variables, output path, frontmatter, and body.
- Set Project Template and Initialize Project Templates are named, proposal-backed operations.
- Validate Project Templates is read-only.

## Agent integration

Agents query the same creation context as the UI. The context reports available template keys, descriptions, required/optional inputs, selected default, template fingerprint, and a bounded rendered skeleton where permitted.

Agent create proposals reference a project template key. The server—not the agent—resolves and renders the template, then applies typed fields/body section edits and validates output. Agents cannot bypass templates with direct file creation or generic frontmatter.

The initial `propose_create_tasks_from_document` workflow therefore becomes:

1. query task creation context/templates;
2. read design and related work;
3. choose the default or named task template;
4. supply editable task drafts and section/body content;
5. render every task from the selected template;
6. preview and approve exact output;
7. commit only if source, template, targets, and relevant relations remain current.

Controlled document creation likewise requires a referenced project template or an explicit packaged minimal template.

## Template engine boundary

V1 supports deterministic variables and simple optional blocks only. It does not execute JavaScript, shell commands, network requests, model prompts, arbitrary expressions, recursive includes, or template-authored tool calls.

Supported date/time placeholders should align where practical with Obsidian's familiar `{{title}}`, `{{date}}`, `{{time}}`, and formatted date/time conventions. Project Weave adds typed project/entity/origin/path variables and safe optional-field omission.

## Normative design

Detailed rendering rules, schemas, variables, safety behavior, agent contracts, and tests are defined in [Vault note templates](../spec/vault-note-templates.md).
