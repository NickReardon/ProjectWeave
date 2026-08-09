---
type: spec
area: templates
status: current
canonical: true
related_decisions: ["0005", "0010", "0013", "0020"]
---

# 18 — Vault Note Templates

## Status and precedence

Approved v1 design. All Project Weave creation paths—UI, commands, tests, and agent proposals—use this template service. This design supersedes any earlier implication that task/document bodies are always empty or hard-coded.

## Goal

Give the vault a replaceable library of ordinary Markdown templates that controls the initial structure of new tasks, epics, milestones/releases, planning periods, designs, and other documents without forcing setup writes on projects that prefer minimal notes.

## Principles

1. Templates are Markdown, visible and editable in the vault.
2. One configured vault library gives every project, UI caller, and agent the same set.
3. Templates are creation inputs, not canonical state for existing notes.
4. Rendering is deterministic and contains no executable code.
5. Typed domain/context values override template defaults where correctness requires it.
6. Every rendered result is previewed/validated under the normal safe-write contract.
7. Changing a template never rewrites existing notes.

## Supported template kinds

V1 supports:

- `project` — used from a local/global creation setting before a project exists;
- `task`;
- `epic`;
- `milestone` — also used for release-shaped milestones;
- `planning_period` — rendered to the stable sprint/planning-period schema;
- `document` — named variants such as design, decision, meeting, research, or generic document.

Design is a document variant, not a required canonical entity type.

## Vault template library

The configured library contains one folder per template kind and one Markdown
file per variant, for example `Templates/Project Weave/task/bug.md`. Kind and
variant keys use lowercase letters, digits, underscores, or hyphens. Every
project sees the same library, and an empty or missing library uses packaged
templates only.

Project-specific template selection is deferred. In particular,
`weave.templates` in project frontmatter has no runtime meaning in v1. ADR 0020
records why the earlier nested-frontmatter workflow was removed before it
became a compatibility contract.

## Template note format

A task template example:

```markdown
---
template_for: task
template_name: default
template_description: Standard implementation task
template_inputs:
  summary:
    type: markdown
    required: false
  acceptance_criteria:
    type: markdown
    required: false
type: task
title: "{{title}}"
project: "{{project_link}}"
status: "{{status}}"
epic: "{{epic_link}}"
milestone: "{{milestone_link}}"
sprint: "{{planning_period_link}}"
owner: "{{owner}}"
priority: "{{priority}}"
points: "{{points}}"
rank: "{{rank}}"
due_date: "{{due_date}}"
origin: "{{origin_link}}"
created: "{{date}}"
---
# {{title}}

{{#if summary}}
## Summary

{{summary}}
{{/if}}

{{#if acceptance_criteria}}
## Acceptance criteria

{{acceptance_criteria}}
{{/if}}
```

The template must be valid Markdown with valid YAML frontmatter before rendering. Template-only keys are reserved and removed from output:

- `weave_template`
- `template_schema`
- `template_for`
- `template_name`
- `template_description`
- `template_inputs`

`template_for` is the only required template metadata. Its presence excludes
the note from canonical entity indexing before interpreting a target `type`.
An omitted `template_schema` means schema 1. The older `weave_template: true`
marker remains optional for compatibility; if present, it must be the Boolean
`true`. Template notes remain visible as ordinary editable Markdown files and
in template diagnostics.

## Template inputs

`template_inputs` declares agent/UI-fillable content slots not supplied automatically by Project Weave. Supported v1 input types are:

- `string`
- `markdown`
- `boolean`
- `integer`
- `date`
- `datetime`
- `link`
- `links`

Each input may declare `required`, `description`, and a static `default`. Defaults cannot reference tools, files, environment values, or executable expressions. Required inputs are required for that template variant only; selecting a different/minimal variant remains possible according to project configuration.

Built-in context variables do not need to be redeclared as inputs.

## Built-in variables

### Common

- `title`
- `date`
- `time`
- `datetime`
- `project_title`
- `project_link`
- `project_path`
- `target_path`
- `template_name`

### Entity/context

- `status`
- `origin_link`
- `epic_link`
- `milestone_link`
- `planning_period_link`
- `owner`
- `priority`
- `points`
- `rank`
- `due_date`
- `goal`
- `start_date`
- `end_date`

Only variables meaningful for the selected kind/context receive values. Unknown variables are errors. Known unset optional variables are handled according to their location.

Date/time variables support the familiar forms `{{date}}`, `{{time}}`, and optional formats such as `{{date:YYYY-MM-DD}}`; Project Weave also supports `{{datetime}}`. Formatting uses the user's local timezone. The syntax intentionally resembles Obsidian's core Templates variables, but Project Weave rendering does not require that core plugin.

## Rendering rules

### Frontmatter

Frontmatter is parsed as YAML before variable replacement. A placeholder must occupy the entire scalar value, such as:

```yaml
points: "{{points}}"
depends_on: "{{dependency_links}}"
```

The renderer replaces it with the typed integer/list value rather than textual YAML. If a known optional variable is unset and occupies the complete value, the property is omitted. Static text interpolation inside frontmatter values is rejected in v1 because it is difficult to type and escape safely.

Static template properties are preserved unless reserved or overridden by creation context/explicit input/invariants. Unknown non-reserved properties are allowed and become ordinary output frontmatter. A static property whose value is empty is preserved the same way and renders as `key: null`; a template that wants a field to stay visible when unset declares it that way instead of as a placeholder. ADR 0010 applies this to the packaged task template's planning properties.

### Body

Body placeholders insert Markdown text. The only control construct is:

```text
{{#if variable}}
content
{{/if}}
```

The block renders when the variable is present/non-empty. Blocks cannot nest in v1. `\{{` emits literal `{{`. Unknown variables, unmatched blocks, and unsupported directives are validation errors.

No loops, includes, macros, JavaScript, shell, network, file reads, model calls, or arbitrary expressions are supported.

## Creation pipeline and precedence

For every new note:

1. Resolve project, note kind, requested/default variant, and catalog entry.
2. Read and fingerprint the template.
3. Parse/validate template metadata, inputs, YAML, and body directives.
4. Render the packaged minimal base or selected vault template.
5. Apply context values: project, origin, initial status, date/time, allocated path/rank, and invoking view.
6. Apply explicit user/agent typed fields and declared template inputs.
7. Apply invariant overlay.
8. Apply structured body/section edits allowed by the creation operation.
9. Parse/validate the complete rendered note and affected global relations.
10. Include template ref/fingerprint, variables, exact output, and postconditions in the proposal.

Precedence from lowest to highest is template static defaults, context defaults, explicit typed inputs, then invariants. Invariants include:

- correct entity `type`;
- selected `project` relation;
- safe normalized target path;
- correct origin for create-from-document;
- allowed initial status/board placement;
- resolved compatible epic/milestone/planning-period relations;
- validated rank/dependency graph.

A template cannot override these values. If the template declares a conflicting static value, preview shows the effective value and template validation emits a warning or error according to severity.

## Defaults and missing references

Packaged minimal templates exist for every supported kind. They are immutable plugin assets and are used when the vault library has no matching default.

A broken, ambiguous, malformed, or incompatible vault template does not
silently fall back. Creation is disabled with a diagnostic and offers the
explicit **Built-in default** choice where allowed.

Agents receive the same disabled action/reason and cannot select fallback unless the proposal explicitly names it.

## New-project setup

### Create Project

Create Project selects the shared vault `project/default.md` template when it
exists, otherwise the packaged project template. The resulting project note is
previewed and validated before creation. Collision prevents overwrite and
requires a different location. No template directory or project-note template
configuration is created as a side effect.

## Replacing and editing templates

- Editing the template note manually affects future creation after re-indexing.
- A controlled agent template-edit operation is deferred; generic document proposals cannot modify marked template notes initially.
- Replacing a template link or content never updates existing notes.
- Any open creation proposal is stale when its referenced template fingerprint changes.
- Template rename and deletion update the library catalog; unavailable variants become diagnostics, not automatic fallback.
- Removing a named variant does not modify notes created from it.

Project Weave may display `created_from_template` in its operation report, but does not persist template linkage in every created note by default. If provenance is later needed, it requires an explicit schema decision because templates should not become live inheritance.

## UI behavior

### Create forms

- Resolve and show the selected template.
- Always show the task template control and the destination where new tasks can
  be created. Disable it when only one effective variant is available.
- Enable the control and show named variants when more than one is configured.
- Render declared inputs with type-appropriate controls.
- Put ordinary optional entity fields under progressive disclosure.
- Preview final frontmatter/body/path before bulk or agent-assisted creation.

### Template management

Template management may offer opening the configured library, copying a
packaged template, validating templates, and previewing sample data. It does
not edit project-note frontmatter.

Opening or validating templates is read-only. No command silently repairs or rewrites them.

## Agent creation context

Add a tool-neutral query:

```ts
getCreationContext({
  projectRef,
  kind: "task",
  variant?: "bug",
  sourceRef?: { path, heading }
})
```

It returns:

- project/index revision;
- effective default and available variant keys/descriptions;
- template path/fingerprint;
- declared input schema;
- current project capabilities/policies;
- invariant/default typed fields;
- bounded rendered body skeleton when the access grant permits it;
- disabled state/diagnostics;
- acceptable target roots and option-search recipes.

MCP adds a logical `weave_creation_context` read tool. Raw template body is returned only under allowed project/template read scope and is labeled untrusted Markdown.

## Agent proposals

Every agent creation operation references `template_kind` and `template_variant` (or explicitly selects `builtin:minimal`). The agent supplies declared input values plus typed entity fields. Project Weave resolves/renders; the agent does not submit a supposedly final raw entity note.

For task creation from a document:

```json
{
  "project_ref": "Projects/Tethered.md",
  "source": {
    "note_ref": "Design/Travel.md",
    "heading": "Requirements",
    "fingerprint": "sha256:..."
  },
  "template_variant": "default",
  "drafts": [
    {
      "draft_key": "travel-request",
      "title": "Implement travel request",
      "template_inputs": {
        "summary": "Implement the request object and handler.",
        "acceptance_criteria": "- [ ] Request validates destination\n- [ ] Invalid requests fail safely"
      },
      "depends_on": []
    }
  ]
}
```

All drafts in one proposal may use the selected variant or explicitly named permitted variants. Proposal limits and security profile still apply. The source and every template become fingerprinted read-set inputs. Any change before commit invalidates approval.

For ordinary document creation, the agent selects a document variant and fills declared inputs/structured sections. The initial agent API does not offer template-free raw file creation.

## Template validation

Validate Project Templates reports:

- invalid optional `weave_template`, unsupported explicit schema, missing or
  incompatible kind, or missing default;
- invalid variant keys;
- duplicate/incompatible library entries;
- malformed YAML/body directives;
- unknown variables or unsupported input types;
- invariant conflicts;
- document templates that would create reserved entity types;
- sample-render parse/schema errors;
- references outside an agent grant when evaluating agent availability.

Validation never edits template/project notes. A template can be valid generally yet unavailable to a particular agent grant.

## Caching and lifecycle

Parsed template ASTs may be cached by normalized path/fingerprint. Cache is disposable. Template create/modify/rename/delete events invalidate affected entries, project creation contexts, and pending proposals that use changed fingerprints.

Activation may parse/index template metadata but never creates, initializes, normalizes, or rewrites template notes.

## Test strategy

### Parsing/rendering

- Static defaults, typed scalar/list substitution, optional-key omission, body interpolation, conditional blocks, escaping, and formatted local dates.
- Unknown variables, invalid YAML, unmatched/nested blocks, unsupported directives/types, and invariant conflicts.
- Unknown static frontmatter/body Markdown is preserved.

### Resolution and replacement

- Vault default/variant selection, packaged fallback, broken-template refusal, ambiguous library entries, and incompatible kind.
- Editing/repointing templates affects future notes only.
- Existing note hashes remain unchanged after every template operation except explicit direct user edits to those notes.
- Template changes invalidate pending proposals.

### UI/agent equivalence

- UI and agent creation with identical context/template/inputs render byte-equivalent proposed notes.
- Both receive the same disabled reasons, variables, defaults, options, diagnostics, paths, and postconditions.
- Agent cannot bypass selection with raw entity Markdown or undeclared variables.
- Agent grants restrict raw template/skeleton reads as designed.

### Setup and safety

- New-project proposals preview every template/project-note path and never overwrite collisions.
- Template notes identified by `template_for` never appear as tasks/epics/etc.
- Lifecycle operations never materialize templates.
- Generic agent document tools reject template notes.
- No template syntax executes code, reads files/settings/environment, performs network calls, or invokes tools.

### Scale/mobile

- Template caching invalidates correctly without full-vault reparsing.
- Large projects do not render every template for ordinary list views.
- Rendering and template management work on mobile; only the optional agent transport remains desktop-specific.

## Acceptance criteria

- A configured vault library can replace templates for every supported creation kind.
- A vault with no template configuration can still create minimal notes without passive setup writes.
- New Project can use the shared vault library or packaged project template.
- UI and agents always render through the same Template Service.
- Agent-created tasks/documents visibly use the selected catalog template.
- Template/context/explicit/invariant precedence is deterministic and tested.
- Missing optional template fields remain compatible with progressive disclosure.
- Broken selected library templates never cause silent fallback.
- Editing a template changes no existing created note.
- Every proposal fingerprints the template and conflicts if it changes before commit.
- Templates cannot execute code or bypass domain/path/access/approval rules.

## Compatibility note

Obsidian's core Templates plugin uses ordinary Markdown templates and familiar `{{title}}`, `{{date}}`, and `{{time}}` variables. Project Weave deliberately follows that recognizable surface where practical while using its own deterministic typed renderer for entity creation and agent parity: [Obsidian Templates](https://obsidian.md/help/plugins/templates).
