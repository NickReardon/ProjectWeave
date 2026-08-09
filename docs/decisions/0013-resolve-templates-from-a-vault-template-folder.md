---
type: decision
id: "0013"
area: templates
status: proposed
canonical: false
affects: ["18"]
---

# ADR 0013: Provide a layered note-template catalog

- Status: proposed
- Date: 2026-08-05
- Owners: Project Weave

## Context

Project Weave already has the pieces of a safe creation pipeline:

- packaged task and project templates;
- a deterministic renderer that cannot execute code or read external state;
- project-owned task-template mappings under `weave.templates.task`;
- exact previews and a create-only commit path that fingerprints every
  non-packaged input;
- ordinary entity parsing after rendering, before anything is written.

The remaining template experience is harder than it needs to be. A project can
name task variants, but the create-task modal cannot select them. Every project
would need to repeat the same mapping to share a house style. Project creation
cannot use a project-owned mapping because the project note is the thing being
created. The persisted **Template scaffold folder** setting defaults to
`Templates/Project Weave`, but it is not a runtime source for anything.

The desired experience is simpler:

1. Project Weave provides useful templates out of the box.
2. Adding one valid Markdown file to a known vault folder makes another
   template available without editing a registry or YAML map.
3. A project may override a template when it genuinely needs different rules,
   but project configuration is optional rather than the normal setup path.
4. Creating from any template produces a note with the correct canonical
   properties and sane defaults for its kind.

## Decision

### One merged template catalog

Creation screens consume one catalog keyed by template kind and variant:

```text
task/default
task/bug
epic/default
milestone/default
planning_period/default
document/default
document/design
project/default
```

The catalog merges three sources:

| Rung | Source | Purpose |
| --- | --- | --- |
| 1 | project | Optional specialization through `weave.templates.<kind>.<variant>` |
| 2 | vault | Vault-wide templates in the configured template library folder |
| 3 | plugin | Immutable templates shipped by Project Weave |

Precedence is evaluated independently for each catalog key. A project may
override `task/bug` without replacing the vault's `task/default` or
`document/design`. A vault may replace the plugin's `task/default` while still
using other plugin variants.

Plugin templates are not restricted to `default`. Project Weave may ship a
small, deliberate set of broadly useful named variants. Every shipped key is a
compatibility surface and is added intentionally rather than as UI filler.
`builtin:minimal` remains an explicit escape hatch that selects the plugin's
minimal default for the requested kind even when a higher rung is broken.

### Vault template library

The setting currently called **Template scaffold folder** becomes the
user-facing **Template library folder**. Its default remains
`Templates/Project Weave`. The existing persisted key may remain during the
first implementation to avoid an unnecessary settings migration; renaming the
stored field requires a deliberate settings-version migration.

The library has one direct child folder per `template_for` value and one direct
Markdown file per variant:

```text
Templates/Project Weave/
  project/default.md
  task/default.md
  task/bug.md
  task/test.md
  epic/default.md
  milestone/default.md
  planning_period/default.md
  document/default.md
  document/design.md
  document/decision.md
```

Discovery rules are intentionally small and deterministic:

- Only exact direct children matching `<library>/<kind>/<variant>.md` are
  candidates. Nested archive, backup, or attachment folders are ignored.
- The kind folder is the `template_for` value, not necessarily the output
  entity type. `planning_period` produces the stable `sprint` entity schema,
  while `document` has no canonical entity kind in v1.
- Kind folders and variant stems match ASCII case-insensitively.
- The variant is the filename stem, normalized to lowercase and validated
  against `^[a-z0-9_-]+$`.
- The filename is authoritative. `template_name` remains descriptive metadata.
- Two candidate paths that normalize to the same kind and variant make only
  that catalog key ambiguous and unavailable.
- An empty configured library folder disables the vault rung. A missing folder
  simply contributes no vault templates and causes no write or setup prompt.

A manually copied valid template appears automatically; no index note or
registration map is required. Template files remain ordinary Markdown and
require only the matching `template_for` value. Missing `template_schema`
defaults to schema 1, while the older `weave_template: true` marker remains
optional for compatibility.

### Optional project overrides

Existing project mappings remain supported:

```yaml
weave:
  templates:
    task:
      bug: "[[Project/Templates/Bug Task]]"
    document:
      design: "[[Project/Templates/Design]]"
```

They are an advanced portability and specialization feature, not a prerequisite
for ordinary creation. A project with no template map sees the effective vault
and plugin catalog. A malformed project map continues to fail closed rather
than being silently hidden by a lower rung.

### Creation property profiles

Templates control presentation, optional properties, declared inputs, and body
structure. Project Weave controls entity identity and operation invariants.

Each creatable kind owns a domain-level creation property profile that
classifies its fields as:

- **required** — always present in the created note;
- **derived** — calculated from the selected project, title, source, allocated
  path/rank, and injected civil clock;
- **defaulted** — assigned a documented initial lifecycle value;
- **optional** — left unset or explicitly `null` according to that kind's
  compatibility contract, never filled with invented data;
- **invariant** — cannot be changed by a template.

The structured kind mapping is:

| Template kind | Created note identity |
| --- | --- |
| `project` | `type: project` |
| `task` | `type: task` |
| `epic` | `type: epic` |
| `milestone` | `type: milestone` |
| `planning_period` | `type: sprint` |
| `document` | Ordinary Markdown document; `design` and `decision` are variants, not entity types |

For example, every created task receives its title, selected project relation,
an allowed initial status such as `backlog`, and an allocated rank regardless
of whether its template repeats those properties. Optional planning properties
follow the existing task compatibility contract: `epic`, `milestone`,
`sprint`, `owner`, `priority`, `points`, and `due_date` remain visible as
explicitly empty properties, while unset `depends_on` and `origin` are omitted.

That contract is ADR 0010's, and accepting this ADR supersedes how it is kept.
ADR 0010 achieves it by declaring the seven properties as empty statics in the
packaged task template, which only holds for notes created from that template.
The task creation profile makes it hold for every task, from any template, at
which point the packaged template's declarations become redundant rather than
load-bearing. ADR 0010's outcome is preserved exactly; its mechanism is
replaced, and it is marked accordingly rather than rewritten.

A body-focused task template may therefore be as small as:

```markdown
---
template_for: task
---

# {{title}}

## Problem

## Expected behavior

## Acceptance criteria
```

The task creation profile supplies the canonical task frontmatter around that
body. If a template explicitly declares an invariant property, its value must
agree with the requested kind and context; a contradiction such as
`task/bug.md` declaring `type: epic` makes the template unavailable.

Value precedence, from lowest to highest, is:

1. kind-profile fallback values;
2. selected template static values and declared input defaults;
3. creation context and derived values;
4. explicit typed user or agent inputs;
5. invariant overlay.

The profile defines which fields a template or explicit input is allowed to
influence. A bug template may default an optional priority, but it cannot
change the entity type, selected project, safe target path, allocated identity,
or another operation invariant.

### Detection and validation

Folder names classify templates, not ordinary project notes. Canonical
frontmatter remains the only authority for whether an ordinary note is a task,
epic, project, milestone, or sprint.

For every structured creation:

1. Resolve the effective catalog key and fingerprint the selected non-plugin
   source.
2. Parse the template and verify its declared kind, optional explicit schema,
   inputs, YAML, placeholders, and body directives.
3. Apply the kind profile, selected template, creation context, explicit typed
   values, and invariant overlay.
4. Render the exact target bytes and show them in preview.
5. Run those bytes through the ordinary entity parser. Creation remains
   disabled unless the result is recognized as the requested kind with valid
   required relations and controlled values.
6. At confirmation, re-read every non-plugin input, re-check target absence,
   and parse the exact previewed bytes again before the create-only write.

Documents use the same deterministic template and safe-write pipeline but do
not pretend to be indexed entities. If Project Weave later needs canonical
design-document detection, that requires an explicit document entity schema;
it must not be inferred from selecting `document/design` during creation.

### Straightforward creation UI

Each create flow selects a kind by the action the user invoked: **Create
task**, **Create epic**, **Create document**, and so on.

- Always show one compact **Template** control and the destination where new
  notes can be created. Disable the control when only one effective template
  is usable.
- If more than one variant exists, enable the **Template** picker.
- Show friendly variant names and descriptions while preserving the stable key.
- Changing the selection immediately regenerates the exact preview.
- A broken selected variant shows its diagnostic and disables creation; it
  never silently changes the bytes by falling through to another source.
- `builtin:minimal` is an explicit user choice, not an automatic repair.
- Template-declared inputs use type-appropriate controls. Ordinary optional
  entity properties remain progressively disclosed.

The same catalog, profiles, validation, and preview service serve commands,
workbench UI, tests, and future agent proposals.

### Adding a template

Two paths are first-class:

1. Copy or author a valid Markdown template at the documented vault path. It
   appears automatically.
2. Run **Add template** from the picker, workbench, or settings. Choose the
   kind and variant, choose a plugin template or minimal template to copy,
   preview the exact destination and bytes, confirm one create-only write, and
   open the new file for editing.

The command never overwrites an existing file, never edits a project map, and
never scaffolds templates during activation or passive discovery. Renaming or
deleting a template remains an ordinary explicit vault action; the catalog
updates on the next read and existing created notes remain unchanged.

### Reader and lifecycle boundaries

Vault templates commonly live outside indexed project roots. The project index
reader must remain scoped to those roots so the setting promise that unrelated
vault notes are not indexed or diagnosed stays true.

The composition root therefore creates a separate read-only template-library
reader scoped to the configured library folder. `ObsidianVaultReader` already
takes an arbitrary root list, so this is the existing adapter constructed with
the library folder rather than a new one; only the routed reader used for
proposal and commit rechecks is new. Creation proposal and commit
composition can re-read both project inputs and template-library inputs through
a small routed/composite reader. The index coordinator continues to receive
only the project-scoped reader. This uses the existing `VaultReader` port; it
does not widen indexing and does not introduce generic vault writes.

Changing the template-library setting affects newly opened or refreshed
creation flows. Editing a selected vault or project template while a preview is
open invalidates the proposal by fingerprint at confirmation.

## Failure behavior

Failure is scoped and closed per selected catalog key:

- A malformed or wrong-kind vault template blocks that variant without
  poisoning its neighbours.
- A broken higher-precedence candidate never silently falls through, because
  that would create bytes different from the user's configured choice.
- An absent candidate falls through normally to the next catalog rung.
- A named variant that exists at no rung is unavailable; it never becomes the
  ordinary default by accident.
- Case-insensitive collisions make only that normalized key ambiguous.
- Passive discovery, settings changes, and validation never create, edit,
  normalize, or delete vault content.

## Alternatives considered

- **Require a project template map:** rejected as the normal workflow. It is
  portable and remains useful for overrides, but repeating a shared vault style
  in every project adds configuration without user value.
- **Plugin defaults only:** rejected. Users need ordinary editable Markdown
  templates without waiting for a Project Weave release.
- **Vault templates only:** rejected. A fresh vault should create valid notes
  immediately without setup or passive scaffolding.
- **A flat folder with kind and variant encoded in filenames:** rejected. It
  needs an arbitrary delimiter and makes the file explorer harder to scan.
- **A vault registry note mapping keys to links:** rejected for the primary
  workflow. Adding a template should require one file, not a file plus registry
  maintenance.
- **Infer ordinary note entity kinds from template paths:** rejected. Created
  and manually authored notes remain Markdown whose canonical frontmatter is
  validated independently of how they originated.
- **Widen the project index to include the template folder:** rejected. It
  breaks the configured indexing boundary and causes unrelated template-folder
  notes to be read or diagnosed as project content.
- **Per-indexed-root template libraries:** deferred. The first implementation
  provides one vault catalog. Adding another precedence rung later is possible
  but must be documented as a compatibility change.

## Consequences

- Positive: a fresh vault has valid defaults with no setup.
- Positive: adding a vault-wide template is one ordinary Markdown file.
- Positive: project-specific specialization remains possible without becoming
  mandatory configuration.
- Positive: templates cannot accidentally omit or corrupt the properties that
  make a created note a task, epic, project, milestone, or sprint.
- Positive: the template control remains discoverable and communicates where
  new notes can be created even when there is no meaningful choice yet.
- Positive: UI and future agents create byte-equivalent notes through the same
  catalog and property profiles.
- Negative: plugin and vault variant keys become compatibility surfaces.
- Negative: `builtin:minimal` widens from "the packaged task template" to "the
  plugin's minimal default for the requested kind". It is a selector users can
  already write in a project map, so the widening is a compatibility change to
  an existing surface rather than a new one.
- Negative: a configured folder layout is a discoverability convention that
  README, settings, validation, and the Add Template flow must make visible.
- Negative: kind profiles add explicit domain work for every newly creatable
  entity, but that work is required to guarantee valid notes independently of
  template quality.

## Follow-up work

Each implementation step builds, passes the complete automated gate, and
carries the documentation for the behavior it adds.

1. **Catalog and reader boundary.** Add `VaultTemplateLibrary` and the merged
   catalog model. Keep the index reader project-scoped; inject a separately
   scoped library reader and a routed reader for proposal/commit rechecks.
   Support an empty setting, a missing folder, exact-depth discovery,
   case-insensitive collisions, and the default folder outside `Projects`.
   Update the settings label and description.
2. **Creation property profiles.** Extract the task and project creation
   property rules from their packaged templates into explicit domain profiles.
   Prove that a minimal body-focused template still renders a valid entity and
   that wrong type, project, status, path, or other invariant values are
   refused. Add profiles alongside each later creation kind rather than one
   speculative generic profile.
3. **Task catalog and chooser.** Merge plugin, vault, and optional project task
   variants. Expose available variants before the first preview and add the
   progressively disclosed picker. Test precedence per key, switching bytes,
   `builtin:minimal`, and one broken variant not poisoning its neighbours.
4. **Add Template flow.** Preview and create one template note from a selected
   plugin/minimal starting point, refuse collisions, and open the created file.
   Manual file placement remains equally supported.
5. **Project default.** Resolve `project/default` from the vault catalog before
   the plugin default. Project creation needs no picker until more than one
   meaningful project variant has a caller. Test packaged fallback and
   fail-closed broken vault defaults.
6. **Additional kinds.** Epic, milestone, planning-period, and document
   creation adopt the same catalog only when their creation profiles,
   proposals, previews, and safe-write validation exist. Template discovery
   does not imply that a kind is already creatable. Each kind also needs a
   target-path and collision rule, and none exists: ADR 0008 settles those for
   tasks and ADR 0012 for projects, and nothing covers an epic, a milestone, a
   planning period, or a document. That decision is a prerequisite of this
   step, not part of it.
7. **Normative documentation and acceptance.** Update Plan Addendum 005 and
   Design 18 so the authoritative precedence and property-profile rules match
   this ADR. Update README, Architecture, Manual Checks, and Current Work.
   Manual acceptance covers adding `task/bug.md`, selecting it, project
   override precedence, invalid-template refusal, correct created properties,
   and a fingerprint refusal after an open template changes.

This ADR moves to accepted when the catalog/reader boundary and authoritative
contract updates land. Later UI and entity-kind slices remain tracked follow-up
work rather than prerequisites for accepting the catalog decision.
