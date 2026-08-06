import { describe, expect, it } from 'vitest';

import { IndexBuilder } from '../../src/indexing/index-builder';
import type { SourceNote } from '../../src/domain/model';
import { sourceNote } from '../helpers/source-note';

describe('IndexBuilder', () => {
  it('derives same-project readiness and keeps cross-project edges advisory', () => {
    const snapshot = build([
      project('Projects/A.md'),
      project('Projects/B.md'),
      task('Tasks/Done.md', 'Projects/A', 'done'),
      task('Tasks/Unfinished.md', 'Projects/A', 'in-progress'),
      task('Tasks/Cancelled.md', 'Projects/A', 'cancelled'),
      task('Tasks/Ready.md', 'Projects/A', 'todo', ['Tasks/Done']),
      task('Tasks/Blocked.md', 'Projects/A', 'todo', ['Tasks/Unfinished']),
      task('Tasks/Blocked cancelled.md', 'Projects/A', 'todo', [
        'Tasks/Cancelled',
      ]),
      task('Tasks/External.md', 'Projects/B', 'todo'),
      task('Tasks/Cross project.md', 'Projects/A', 'todo', ['Tasks/External']),
      task('Tasks/Unresolved.md', 'Projects/A', 'todo', ['Tasks/Missing']),
    ]);

    expect(snapshot.getReadiness('Tasks/Ready.md')).toMatchObject({
      ready: true,
    });
    expect(snapshot.getReadiness('Tasks/Blocked.md')).toMatchObject({
      ready: false,
    });
    expect(snapshot.getReadiness('Tasks/Blocked cancelled.md')).toMatchObject({
      ready: false,
    });
    expect(snapshot.getReadiness('Tasks/Cross project.md')).toMatchObject({
      ready: true,
    });
    expect(snapshot.getReadiness('Tasks/Unresolved.md')).toMatchObject({
      ready: false,
    });
    expect(snapshot.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'Tasks/Cross project.md',
          code: 'dependency.cross_project',
          severity: 'warning',
        }),
      ]),
    );
  });

  it('diagnoses same-project cycles and blocks every participating task', () => {
    const snapshot = build([
      project('Projects/A.md'),
      task('Tasks/A.md', 'Projects/A', 'todo', ['Tasks/B']),
      task('Tasks/B.md', 'Projects/A', 'todo', ['Tasks/A']),
    ]);

    expect(snapshot.getReadiness('Tasks/A.md')?.ready).toBe(false);
    expect(snapshot.getReadiness('Tasks/B.md')?.ready).toBe(false);
    expect(
      snapshot.diagnostics.filter((issue) => issue.code === 'dependency.cycle'),
    ).toHaveLength(2);
  });

  it('indexes provenance without turning ordinary documents into entities', () => {
    const snapshot = build([
      project('Projects/A.md'),
      sourceNote('Design/Travel.md', '', '# Requirements'),
      sourceNote(
        'Tasks/Travel.md',
        [
          'type: task',
          'project: "[[Projects/A]]"',
          'status: backlog',
          'origin: "[[Design/Travel#Requirements]]"',
        ].join('\n'),
      ),
    ]);

    expect(snapshot.getEntity('Design/Travel.md')).toBeUndefined();
    expect(
      snapshot
        .getRelatedToOrigin('Design/Travel.md', 'Requirements')
        .map((entity) => entity.path),
    ).toEqual(['Tasks/Travel.md']);
  });

  it('is deterministic across enumeration order and isolates malformed notes', () => {
    const notes = [
      project('Projects/A.md'),
      task('Tasks/B.md', 'Projects/A', 'todo'),
      task('Tasks/A.md', 'Projects/A', 'todo'),
      sourceNote('Tasks/Malformed.md', 'type: [task'),
      sourceNote(
        'Templates/Task.md',
        ['weave_template: true', 'template_for: task', 'type: task'].join('\n'),
      ),
    ];
    const forward = build(notes);
    const reverse = build([...notes].reverse());

    expect(forward.getEntities().map((entity) => entity.path)).toEqual(
      reverse.getEntities().map((entity) => entity.path),
    );
    expect(
      forward.diagnostics.map((issue) => [issue.path, issue.code]),
    ).toEqual(reverse.diagnostics.map((issue) => [issue.path, issue.code]));
    expect(forward.getEntity('Tasks/A.md')?.kind).toBe('task');
    expect(forward.getEntity('Templates/Task.md')).toBeUndefined();
    expect(forward.diagnostics.map((issue) => issue.code)).toContain(
      'note.frontmatter.invalid',
    );
  });
});

function build(
  notes: readonly SourceNote[],
  taskCategories: readonly string[] = [],
) {
  return new IndexBuilder().build(notes, { revision: 1, taskCategories });
}

function project(path: string): SourceNote {
  return sourceNote(path, 'type: project');
}

function task(
  path: string,
  projectPath: string,
  status: string,
  dependencies: readonly string[] = [],
): SourceNote {
  return sourceNote(
    path,
    [
      'type: task',
      'project: "[[' + projectPath + ']]"',
      'status: ' + status,
      ...(dependencies.length === 0
        ? []
        : [
            'depends_on:',
            ...dependencies.map((dependency) => '  - "[[' + dependency + ']]"'),
          ]),
    ].join('\n'),
  );
}

describe('IndexBuilder task categories', () => {
  const PROJECT = 'Projects/Game/Project.md';

  function categorised(category: string): readonly SourceNote[] {
    return [
      project(PROJECT),
      sourceNote(
        'Projects/Game/Tasks/One.md',
        [
          'type: task',
          'project: "[[Projects/Game/Project]]"',
          'status: todo',
          `category: ${category}`,
        ].join('\n'),
      ),
    ];
  }

  it('accepts any category when the vault configures none', () => {
    const snapshot = build(categorised('anything at all'));

    expect(snapshot.diagnostics).toEqual([]);
    const task = snapshot.getEntity('Projects/Game/Tasks/One.md');
    expect(task?.kind === 'task' && task.category).toBe('anything at all');
  });

  it('reports a category the configured vocabulary does not list', () => {
    const snapshot = build(categorised('feature'), ['bug', 'chore']);

    const issue = snapshot.diagnostics.find(
      (candidate) => candidate.code === 'task.category.invalid',
    );
    expect(issue?.path).toBe('Projects/Game/Tasks/One.md');
    expect(issue?.field).toBe('category');
    expect(issue?.recovery).toContain('bug, chore');
    // Reported, never repaired: the note still says what it says.
    const task = snapshot.getEntity('Projects/Game/Tasks/One.md');
    expect(task?.kind === 'task' && task.category).toBe('feature');
    expect(task?.diagnostics.map((one) => one.code)).toContain(
      'task.category.invalid',
    );
  });

  it('matches a configured category case-insensitively', () => {
    expect(build(categorised('Bug'), ['bug']).diagnostics).toEqual([]);
    expect(build(categorised('bug'), ['Bug']).diagnostics).toEqual([]);
  });

  it('leaves a task with no category alone', () => {
    const snapshot = build(
      [
        project(PROJECT),
        sourceNote(
          'Projects/Game/Tasks/One.md',
          'type: task\nproject: "[[Projects/Game/Project]]"\nstatus: todo',
        ),
      ],
      ['bug'],
    );

    expect(snapshot.diagnostics).toEqual([]);
  });
});
