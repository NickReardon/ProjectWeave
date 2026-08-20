---
type: spec
area: plugin-experience
status: current
canonical: true
related_decisions: ["0006"]
---

# Plugin Experience

## Goal

Expose Project Weave consistently through commands, contextual actions, settings, onboarding, diagnostics, and accessible desktop/mobile interactions.

## Command catalog

### Global

- Open Portfolio Dashboard
- Open Project Workbench
- Create Project (when configured)
- Create Epic
- Create Task
- Create Task From Current Note or Heading
- Plan Sprint
- Validate Project Weave Notes
- Open Diagnostics
- Rebuild Index

### Task context

- Edit Task
- Change Task Status
- Set or Clear Owner
- Assign to Sprint or Return to Backlog
- Add or Remove Dependency
- Create Next Iteration
- Open Project, Epic, Sprint, Origin, Dependencies, or Dependents

### Sprint context

- Edit Planned Sprint
- Activate Sprint
- Close Sprint
- Cancel Sprint

### Migration

- Open Legacy Migration (shown only when compatibility mode is enabled)

Commands requiring canonical/current state are unavailable while the first index is building or global validation is stale. They explain why rather than failing silently.

## Context resolution

Commands inspect the active note/view. Context may prefill a project/task/sprint only when exactly one canonical entity is identified. The chosen value remains visible in the next UI. Ambiguity opens a picker; commands never guess from similarly named files.

## Settings

V1 settings MAY include:

- project, epic, task, and sprint default folders;
- filename patterns and optional template paths;
- default project/workbench perspective;
- dashboard sort/filter preferences;
- legacy compatibility mode;
- diagnostic verbosity and redaction controls;
- an optional vault-relative diagnostics log folder for a derived JSON report;
- onboarding completion/version.

Path settings are normalized and validated. Empty diagnostics-log output is
disabled; when configured, the plugin may create that folder and overwrite its
own derived `diagnostics.json` report after a complete index publication. Other
path settings do not create folders until a user confirms an entity creation
that needs them. Settings never contain canonical project state.

## Onboarding

First activation MAY display a non-blocking welcome view that:

1. states that Markdown is canonical and passive lifecycle is non-destructive;
2. links to schema examples;
3. offers folder/template configuration;
4. offers Validate Notes and Open Dashboard;
5. explains that migration is separate and explicit.

Dismissal saves only onboarding preference. Onboarding does not create sample notes, folders, dashboards, or migrations.

## Diagnostics experience

Diagnostics groups issues by severity and project/path. Each row has code, message, affected field, related notes, Open Note, and relevant named repair command when one exists. Validate Notes performs read-only validation. Export Diagnostic Report redacts note bodies and user-defined values unless the user explicitly includes them.

When **Diagnostics log folder** is configured, Project Weave writes one
vault-relative `diagnostics.json` report after each complete index publication.
The report contains index metadata, project-grouped diagnostics, and
unassigned diagnostics, but no note bodies. The report is derived output and is
never treated as a Project Weave entity.

## Notices and confirmations

Use notices for concise success/failure summaries and modals/views for decisions. Confirmations name the action and number of files. Destructive-looking or bulk choices are never confirmed solely by closing a modal or pressing an unlabeled icon.

## Accessibility and mobile

- All actions are keyboard reachable and have text names.
- Drag actions have menu/keyboard equivalents.
- Focus is trapped/restored correctly in modals.
- Validation is associated with its field and summarized at form level.
- Color is never the only status signal.
- Layouts support narrow mobile widths and touch targets.
- The manifest remains mobile-compatible (`isDesktopOnly: false`) unless an approved feature introduces a desktop-only dependency.

## Acceptance criteria

- Every write named by a feature design has a command or context action and an explicit confirmation point.
- No command silently infers ambiguous entity context.
- First-run onboarding changes no content.
- Invalid settings cannot write outside the normalized intended vault path.
- Diagnostics expose every validator result and route to the affected note.
- Core workflows are operable on mobile and by keyboard.
