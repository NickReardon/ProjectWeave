---
type: decision
id: "0012"
area: projects
status: accepted
canonical: false
affects: ["projects-and-epics"]
---

# ADR 0012: Give each created project its own folder

- Status: accepted
- Date: 2026-08-05
- Owners: Project Weave

## Context

Task creation is manually accepted, which is what further note kinds were gated
behind. A project note is the natural next kind: every other entity carries a
project relation, and a vault with no project note dead-ends at the workbench's
**No projects** state, so today a user must hand-write their first project note
before the plugin is useful at all.

Nothing decides where a created project note goes. ADR 0008 settled the task
folder by deriving it from the project note's own location — `Tasks` beside the
project note — which means the project note's location is now load-bearing for
a convention that already shipped. Two projects whose notes sit in one folder
would share one `Tasks` folder, and their tasks would mingle with no way to tell
them apart by path.

`docs/spec/README.md` leaves project scaffolding unresolved, and the packaged
`templates/default/project.md` has never had a consumer.

## Decision

Give every created project its own folder, at `<root>/<Title>/Project.md`, and
make the folder rather than the filename carry the project's identity.

- **Placement:** the folder is the identity; the note that defines it takes the
  fixed name `Project.md`. A project note needs its own folder because ADR 0008
  derives the task root from the note's parent, so two project notes sharing a
  folder would share one `Tasks` folder.
- **Naming:** the folder name comes from the same title sanitizer ADR 0008 uses
  for task filenames, so one title yields one predictable name across kinds.
- **Collisions:** folder-level, and suffixed the same way ADR 0008 suffixes task
  filenames. Suggesting a free folder is not reserving one;
  `proposal.target.exists` remains the authoritative block.
- **Occupancy:** derived from note paths. The vault port exposes notes, not
  directories, and this decision does not widen it.
- **Root selection:** an input to allocation, validated but not chosen here.
  Picking among several configured roots is a UI concern.

The resulting rules are specified in
[Projects and epics](../Specifications/projects-and-epics.md).

## Alternatives considered

- **`<root>/<Title>.md`, no folder per project:** rejected. ADR 0008 would then
  put every project's tasks in one `<root>/Tasks` folder, so tasks from
  unrelated projects would share a namespace and collide on title.
- **`<root>/<Title>/<Title>.md`:** rejected. It reads better in a tab title, but
  it duplicates the name in every path, and renaming a project would then mean
  renaming two things to stay consistent rather than one.
- **A configurable project-note filename:** deferred, on the same grounds ADR
  0008 deferred its per-project override — no caller needs it, and a persisted
  setting is a compatibility surface.
- **Refusing a title whose folder exists, rather than suffixing:** rejected for
  inconsistency. ADR 0008 already suffixes for tasks, and a user creating two
  projects called "Website" wants both, not an error.

## Consequences

- Positive: a project created by the plugin is immediately usable by the task
  creation ADR 0008 already describes, with no second convention to learn.
- Positive: the packaged project template gains its first consumer, and the
  empty-vault dead end becomes fixable from inside the plugin.
- Negative: a project whose folder is derived from its title drifts from that
  title when the title is later edited. Nothing repairs the path, by design —
  Markdown in the vault is canonical, and a rename is the user's to make.
- Negative: folder occupancy inferred from note paths cannot see an empty
  folder, so a suggestion can land inside one.
- Follow-up work: the proposal, preview, and commit path for the project kind,
  and the UI that chooses a root when more than one is configured.
