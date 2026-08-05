# ADR 0013: Resolve note templates from a vault template folder

- Status: proposed
- Date: 2026-08-05
- Owners: Project Weave

## Context

A project note can already map its own task templates under
`weave.templates.task`, with named variants beside `default`. Nothing else can
choose a template:

- The create-task modal has no variant chooser, so a project that maps `bug`
  and `test` has configured something no user can select. `templateVariant`
  runs the full depth of the preview and proposal services with no caller.
- Project creation is packaged-only by construction. A project-owned mapping
  lives in the project note, and the project note is what creation produces, so
  there is nowhere for a project to declare its own project template.
- The **Template scaffold folder** setting exists, defaults to
  `Templates/Project Weave`, is validated and persisted, and is read by nothing
  but the settings tab. Its own description calls it a destination for "future
  template scaffolding".

So a vault with a house style — a bug task shaped one way, a project note that
opens with the sections this team uses — must repeat that mapping in every
project note, and cannot express it for projects at all.

## Decision

**A template folder, holding one folder per kind, holding one file per
variant.**

```text
Templates/Project Weave/
  project/default.md
  task/default.md
  task/bug.md
  task/test.md
  epic/default.md
  milestone/default.md
  document/default.md
  document/design.md
```

**The folder name is the `template_for` value it holds.** Not the entity type:
`document` is a `template_for` value with no entity kind behind it, and the
packaged `planning-period.md` declares `template_for: planning_period` while
its entity type is `sprint`. One rule covers all three cases; a rule phrased in
entity kinds would need two exceptions. Folder names match
case-insensitively, so `Task/` and `task/` are the same folder.

**The variant is the filename stem**, lowercased, validated against the
`^[a-z0-9_-]+$` key pattern the resolver already enforces for mapped variants.
`default.md` is the default variant. The filename is authoritative;
`template_name` inside the file stays descriptive.

**Precedence, per variant:**

| Rung | Source | Where |
| --- | --- | --- |
| 1 | project | `weave.templates.<kind>.<variant>` in the project note |
| 2 | vault | `<template folder>/<kind>/<variant>.md` |
| 3 | packaged | plugin asset, `default` only |

A project overrides one variant without disturbing the vault's others. Only
`default` has a packaged rung: there is no packaged notion of a `bug`, so a
`bug` that resolves nowhere is an error rather than a silent ordinary task.

**Failure is scoped and closed.** A vault template that cannot be parsed, or
whose `template_for` contradicts its folder, fails that variant closed — it
never falls back to packaged, because creating from the wrong template silently
is worse than refusing. It does not invalidate the other variants in the
folder. Two files whose stems collide case-insensitively make that variant
ambiguous and refused, matching how an ambiguous wiki link is already treated.

**Nothing is scaffolded.** The plugin does not create the folder or write
starter templates. Passive writes are forbidden, and a previewed **Scaffold
templates** command is a later slice with its own confirmation.

**Discovery is a directory listing** through the existing read-only
`VaultReader`. No new port, and no widening of the one that exists.

## Alternatives considered

- **A flat folder with kind and variant encoded in the filename**
  (`task.bug.md`): rejected. It needs a delimiter rule, every candidate
  delimiter reads as arbitrary, and a variant name containing it breaks the
  scheme.
- **A flat folder with kind and variant read from frontmatter**
  (`template_for` + `template_name`): rejected, though it reuses metadata the
  templates already carry. Discovery would mean parsing every note in the
  folder, the file explorer would stop telling you what a file is, and renaming
  `template_name` would silently rename a variant.
- **An index note mapping variants to links**, mirroring `weave.templates` at
  vault scope: rejected on ergonomics. It is the most principled option — one
  mechanism at two scopes, templates anywhere in the vault — but adding a
  template would mean editing a YAML map as well as writing the note.
- **A new `projectTemplate` setting**: rejected. It is a second persisted
  compatibility surface for a result the existing folder setting already
  reaches, and it would put the choice in `data.json` rather than in Markdown.
- **Per-indexed-root template folders**, so `Work/Projects` and
  `Personal/Projects` can differ: deferred. One root is configured today, and
  the cost of adding the rung later is a documented precedence change rather
  than a rewrite. Recorded here so a later slice knows it was considered.
- **Reconciling `planning_period` with `sprint`**: deferred. Under this rule the
  packaged template needs no change, and there is no sprint creation path to
  disagree with it. The slice that adds one must settle whether the folder is
  `planning_period` or `sprint`, and whether the packaged template's
  declaration moves.

## Consequences

- Positive: a house style is configured once per vault instead of once per
  project, and project notes gain a configurable template for the first time.
- Positive: the **Template scaffold folder** setting stops being a control that
  does nothing.
- Positive: templates stay ordinary Markdown notes in the vault — editable,
  versionable, and portable with it — rather than paths in `data.json`.
- Negative: variant names become a compatibility surface the moment someone
  writes `bug.md`. Renaming semantics later breaks vaults.
- Negative: a magic filename in a configured folder is invisible until
  documented. The settings description and README carry that weight.
- Negative: the create-task modal becomes the first UI where a dropdown changes
  the bytes that get written, so it needs a manual check rather than trust in
  the modal tests.

### Follow-up work

Each step builds, passes the gate, and carries the documentation for the
behavior it adds.

1. **Vault template source.** `VaultTemplateLibrary` lists and loads variants
   under the template folder through `VaultReader`. `TaskTemplateResolver`
   gains the middle rung and reports `source: 'vault'`; `availableVariants`
   merges both configured sources. `src/main.ts` injects the folder from
   settings at the composition root, so application code still reads no
   settings. The settings description stops promising future scaffolding.
   Tests: listing and its rejection cases, precedence across all three rungs,
   fail-closed on a malformed or wrong-kind vault template, and one bad variant
   not poisoning its neighbours. This ADR flips to accepted here.
2. **Task template chooser.** The preview service exposes a project's available
   variants so the modal can populate before its first preview; the create-task
   modal gains a **Template** dropdown listing `default`, each configured
   variant, and `builtin:minimal` as an explicit escape hatch, re-previewing on
   change so the shown bytes are the chosen variant's bytes. Tests: the chooser
   lists both sources, switching changes the rendered output, and a variant
   that fails closed shows its diagnostic with the create button disabled.
3. **Project templates.** `ProjectCreationProposalService` takes a resolved
   template instead of hard-coding the packaged one, so `project/default.md`
   wins when present. No chooser: one house style per vault is the case worth
   serving, and a second has nowhere to be configured. Tests: vault template
   used when present, packaged when absent, fail-closed when broken.
4. **Documentation and the manual check.** `README.md` gains the precedence
   table and folder layout; `docs/ARCHITECTURE.md` gains the vault rung;
   `docs/MANUAL_CHECKS.md` gains check 16 — a vault `task/bug.md` appears in the
   chooser and is used verbatim, a project mapping overrides it, and a
   deliberately broken one refuses rather than falling back;
   `docs/CURRENT_WORK.md` records check 16 as outstanding and closes the
   packaged-only and unreachable-`templateVariant` loose ends.

Unchanged by this work: the commit path already re-reads every non-packaged
template by fingerprint before writing, so a vault template edited while a
modal sits open is refused with no new code. Template notes carry
`weave_template: true` and stay out of entity indexing, so a template folder
inside an indexed project root remains harmless.
