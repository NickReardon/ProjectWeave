---
type: decision
id: "0013"
area: templates
status: proposed
canonical: false
affects: ["vault-note-templates"]
superseded_in_part_by: ["0020"]
---

# ADR 0013: Provide a layered note-template catalog

- Status: proposed
- Date: 2026-08-05
- Owners: Project Weave

Project-specific mapping passages below preserve the original decision
history. ADR 0020 supersedes that rung for v1; the active catalog is the vault
library over packaged defaults.

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

Resolve templates from a vault template library folder, merged into one catalog
keyed by kind and variant, rather than requiring a per-project template map.

- **One merged catalog.** Creation screens consume a single catalog keyed by
  `kind/variant`. Precedence is evaluated independently per key, so replacing
  one variant never displaces its neighbours.
- **Discovery by convention.** `<library>/<kind>/<variant>.md`, exact direct
  children only, filename authoritative. A copied file appears with no
  registration step, which is what removes the project map from the ordinary
  path.
- **Creation property profiles.** Each kind owns a domain profile classifying
  its fields as required, derived, defaulted, optional, or invariant. Templates
  own presentation and body; Project Weave owns identity and invariants. This is
  what lets a template be a body with no frontmatter at all.
- **Failure is scoped per key and fails closed.** A broken candidate never
  silently falls through to another rung, because that would write bytes the
  user did not choose.
- **A separate template-library reader.** Vault templates commonly live outside
  indexed project roots, so the composition root constructs a second read-only
  reader scoped to the library folder and routes proposal/commit rechecks
  through it. The index coordinator keeps only the project-scoped reader, so the
  promise that unrelated vault notes are not indexed stays true. This reuses the
  existing `VaultReader` port and widens neither indexing nor writes.

This supersedes how ADR 0010's outcome is achieved. ADR 0010 keeps the seven
optional planning properties visible by declaring them as empty statics in the
packaged task template, which only holds for notes created from that template.
The task creation profile makes it hold for every task from any template, at
which point those declarations become redundant rather than load-bearing. The
outcome is preserved exactly; only the mechanism changes.

The resulting rules are specified in
[Vault note templates](../Specifications/vault-note-templates.md).

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
   the Vault note templates spec so the authoritative precedence and property-profile rules match
   this ADR. Update README, Architecture, Manual Checks, and Current Work.
   Manual acceptance covers adding `task/bug.md`, selecting it, project
   override precedence, invalid-template refusal, correct created properties,
   and a fingerprint refusal after an open template changes.

This ADR moves to accepted when the catalog/reader boundary and authoritative
contract updates land. Later UI and entity-kind slices remain tracked follow-up
work rather than prerequisites for accepting the catalog decision.
