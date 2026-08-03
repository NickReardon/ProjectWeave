import { describe, expect, it } from 'vitest';

import { ProjectWeaveQueryApi } from '../../src/application/query-api';
import { IndexBuilder } from '../../src/indexing/index-builder';
import type { SourceNote } from '../../src/domain/model';
import { sourceNote } from '../helpers/source-note';

describe('ProjectWeaveQueryApi', () => {
  it('returns bounded, deterministic board Ready Now results for one project', async () => {
    const snapshot = new IndexBuilder().build(fixture(), { revision: 7 });
    const api = new ProjectWeaveQueryApi(() => snapshot);

    const first = await api.getReadyNow({
      projectPath: 'Projects/Game.md',
      limit: 2,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) {
      throw new Error('Expected a Ready Now result');
    }
    expect(first.schema_version).toBe(1);
    expect(first.index_revision).toBe(7);
    expect(first.project_ref.path).toBe('Projects/Game.md');
    expect(first.items.map((item) => item.title)).toEqual([
      'Ranked low priority',
      'Ranked critical',
    ]);
    expect(first.items[0]?.unlocks).toEqual([]);
    expect(first.page).toEqual({
      limit: 2,
      next_cursor: 'offset:2',
      truncated: true,
    });

    const second = await api.getReadyNow({
      projectPath: 'Projects/Game.md',
      limit: 2,
      cursor: first.page.next_cursor ?? undefined,
    });
    expect(second.ok).toBe(true);
    if (!second.ok) {
      throw new Error('Expected the second Ready Now page');
    }
    expect(second.items.map((item) => item.title)).toEqual([
      'Unranked critical',
    ]);
    expect(second.page.truncated).toBe(false);
  });

  it('normalizes non-finite limits to a bounded default', async () => {
    const snapshot = new IndexBuilder().build(fixture(), { revision: 1 });
    const api = new ProjectWeaveQueryApi(() => snapshot);

    const result = await api.getReadyNow({
      projectPath: 'Projects/Game.md',
      limit: Number.NaN,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected a Ready Now result');
    }
    expect(result.page.limit).toBe(50);
  });

  it('reports current capabilities and the enforced dependency default', async () => {
    const snapshot = new IndexBuilder().build(fixture(), { revision: 1 });
    const api = new ProjectWeaveQueryApi(() => snapshot);

    const context = await api.getProjectContext({
      projectPath: 'Projects/Game.md',
    });
    expect(context.ok).toBe(true);
    if (!context.ok) {
      throw new Error('Expected project context');
    }
    expect(context.policies.dependency_mode).toBe('enforced');
    expect(context.capabilities.estimation).toMatchObject({
      in_use: true,
      unit: 'points',
      required: false,
    });
    expect(context.capabilities.owners.in_use).toBe(true);
  });

  it('returns blocker refs from the same immutable snapshot', async () => {
    const snapshot = new IndexBuilder().build(fixture(), { revision: 1 });
    const api = new ProjectWeaveQueryApi(() => snapshot);

    const context = await api.getTaskContext({
      projectPath: 'Projects/Game.md',
      taskPath: 'Tasks/Blocked.md',
    });
    expect(context.ok).toBe(true);
    if (!context.ok) {
      throw new Error('Expected task context');
    }
    expect(context.task.ready).toBe(false);
    expect(context.task.blocked_by.map((ref) => ref.path)).toEqual([
      'Tasks/Prerequisite.md',
    ]);
  });
});

function fixture(): readonly SourceNote[] {
  return [
    sourceNote('Projects/Game.md', 'type: project'),
    sourceNote('Projects/Other.md', 'type: project'),
    readyTask('Tasks/Ranked low priority.md', 1000, 'low'),
    readyTask('Tasks/Ranked critical.md', 2000, 'critical'),
    readyTask('Tasks/Unranked critical.md', null, 'critical', [
      'points: 3',
      'owner: Dev',
    ]),
    sourceNote(
      'Tasks/Future backlog.md',
      [
        'type: task',
        'project: "[[Projects/Game]]"',
        'status: backlog',
        'rank: 500',
      ].join('\n'),
    ),
    sourceNote(
      'Tasks/Prerequisite.md',
      [
        'type: task',
        'project: "[[Projects/Game]]"',
        'status: in-progress',
      ].join('\n'),
    ),
    sourceNote(
      'Tasks/Blocked.md',
      [
        'type: task',
        'project: "[[Projects/Game]]"',
        'status: todo',
        'depends_on: "[[Tasks/Prerequisite]]"',
      ].join('\n'),
    ),
    sourceNote(
      'Tasks/Other project.md',
      [
        'type: task',
        'project: "[[Projects/Other]]"',
        'status: todo',
        'rank: 1',
      ].join('\n'),
    ),
    sourceNote(
      'Tasks/Other dependent.md',
      [
        'type: task',
        'project: "[[Projects/Other]]"',
        'status: todo',
        'depends_on: "[[Tasks/Ranked low priority]]"',
      ].join('\n'),
    ),
  ];
}

function readyTask(
  path: string,
  rank: number | null,
  priority: string,
  extra: readonly string[] = [],
): SourceNote {
  return sourceNote(
    path,
    [
      'type: task',
      'project: "[[Projects/Game]]"',
      'status: todo',
      ...(rank === null ? [] : ['rank: ' + String(rank)]),
      'priority: ' + priority,
      ...extra,
    ].join('\n'),
  );
}
