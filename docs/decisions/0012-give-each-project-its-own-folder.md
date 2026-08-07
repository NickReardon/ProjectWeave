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

**Placement.** A created project note lands at `<root>/<Title>/Project.md`,
where `<root>` is one of the indexed project folders from settings. The folder
is the project's identity; the note that defines it has a fixed name.

**Filename.** `Project.md`, not the title. The folder already carries the name,
ADR 0008 derives the task folder from the note's parent, and the fixture vault
has used `Projects/Game/Project.md` since the beginning.

**Folder name.** Derived from the title by the same sanitizer ADR 0008 uses for
task filenames, so one title yields one predictable name across both kinds.

**Collisions are folder-level.** An occupied folder is a collision even when it
holds no project note, because ADR 0008 would file the new project's tasks
inside it. Suffixing follows ADR 0008 — a deterministic ` 2`, ` 3`, … bounded at
100 attempts, compared case-insensitively — and suggesting a free folder is not
reserving one: the proposal service's `proposal.target.exists` check remains the
authoritative block.

**Occupied folders are derived from note paths.** The vault port exposes notes,
not directories, and this decision does not widen it. A folder containing no
Markdown is therefore invisible to allocation; the proposal check and the writer
both still refuse to overwrite, so the worst case is a suggestion that lands in
an existing empty folder.

**Root selection is the caller's.** Allocation takes the root as an input and
validates it. Choosing among several configured roots is a UI concern, and this
decision does not settle it.

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
