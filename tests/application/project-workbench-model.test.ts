import { describe, expect, it } from 'vitest';

import {
  buildProjectWorkbenchModel,
  type ProjectWorkbenchReadPublication,
} from '../../src/application/project-workbench-model';
import type { SourceNote } from '../../src/domain/model';
import { IndexBuilder } from '../../src/indexing/index-builder';
import { IndexSnapshot } from '../../src/indexing/index-snapshot';
import type { TaskSearchMatcher } from '../../src/application/task-search';
import { sourceNote } from '../helpers/source-note';

describe('Project Workbench model', () => {
  it('reports loading before the replacement runtime publishes its first index', () => {
    const model = buildProjectWorkbenchModel({
      publication: {
        publicationId: 4,
        runtimeGeneration: 2,
        snapshot: IndexSnapshot.empty(),
      },
      selectedProjectPath: 'Projects/Game/Project.md',
      readyDisplayLimit: 5,
    });

    expect(model).toMatchObject({
      state: 'loading',
      publicationId: 4,
      runtimeGeneration: 2,
      indexRevision: 0,
      indexFreshness: 'rebuilding',
      banner: { kind: 'rebuilding' },
      projectOptions: [],
    });
  });

  it('distinguishes no projects from an unavailable persisted selection', () => {
    const emptyPublication = publication([]);

    expect(
      buildProjectWorkbenchModel({
        publication: emptyPublication,
        selectedProjectPath: null,
        readyDisplayLimit: 5,
      }).state,
    ).toBe('no_projects');

    const unavailable = buildProjectWorkbenchModel({
      publication: publication([
        sourceNote('Projects/Only/Project.md', 'type: project'),
      ]),
      selectedProjectPath: 'Projects/Missing\\Project.md',
      readyDisplayLimit: 5,
    });
    expect(unavailable).toMatchObject({
      state: 'project_unavailable',
      requestedProjectPath: 'Projects/Missing/Project.md',
    });
  });

  it('infers from an active project, a related entity, or a sole project', () => {
    const notes = [
      sourceNote('Projects/Alpha/Project.md', 'type: project'),
      sourceNote('Projects/Beta/Project.md', 'type: project'),
      task('Projects/Beta/Tasks/Implement.md', 'Projects/Beta/Project', 'todo'),
    ];
    const multiProjectPublication = publication(notes);

    expect(
      project(
        buildProjectWorkbenchModel({
          publication: multiProjectPublication,
          selectedProjectPath: null,
          activePath: 'Projects/Alpha/Project.md',
          readyDisplayLimit: 5,
        }),
      ).project.path,
    ).toBe('Projects/Alpha/Project.md');
    expect(
      project(
        buildProjectWorkbenchModel({
          publication: multiProjectPublication,
          selectedProjectPath: null,
          activePath: 'Projects/Beta/Tasks/Implement.md',
          readyDisplayLimit: 5,
        }),
      ).project.path,
    ).toBe('Projects/Beta/Project.md');

    expect(
      project(
        buildProjectWorkbenchModel({
          publication: publication([
            sourceNote('Projects/Only/Project.md', 'type: project'),
          ]),
          selectedProjectPath: null,
          readyDisplayLimit: 5,
        }),
      ).project.path,
    ).toBe('Projects/Only/Project.md');
  });

  it('offers deterministic project choices without guessing from folders', () => {
    const model = buildProjectWorkbenchModel({
      publication: publication([
        sourceNote('Projects/Zeta/Project.md', 'type: project'),
        sourceNote('Projects/Alpha/Project.md', 'type: project'),
      ]),
      selectedProjectPath: null,
      activePath: 'Projects/Alpha/Notes/Unindexed.md',
      readyDisplayLimit: 5,
    });

    expect(model.state).toBe('choose_project');
    expect(model.projectOptions.map((option) => option.path)).toEqual([
      'Projects/Alpha/Project.md',
      'Projects/Zeta/Project.md',
    ]);
  });

  it('excludes archived projects from normal choices and inference', () => {
    const activeAndArchived = buildProjectWorkbenchModel({
      publication: publication([
        sourceNote('Projects/Active/Project.md', 'type: project'),
        sourceNote(
          'Projects/Archive/Project.md',
          ['type: project', 'status: archived'].join('\n'),
        ),
      ]),
      selectedProjectPath: null,
      readyDisplayLimit: 5,
    });

    expect(project(activeAndArchived).project.path).toBe(
      'Projects/Active/Project.md',
    );
    expect(
      activeAndArchived.projectOptions.map((option) => option.path),
    ).toEqual(['Projects/Active/Project.md']);

    const archivedOnlyPublication = publication([
      sourceNote(
        'Projects/Archive/Project.md',
        ['type: project', 'status: archived'].join('\n'),
      ),
    ]);
    expect(
      buildProjectWorkbenchModel({
        publication: archivedOnlyPublication,
        selectedProjectPath: null,
        activePath: 'Projects/Archive/Project.md',
        readyDisplayLimit: 5,
      }).state,
    ).toBe('no_projects');
    expect(
      buildProjectWorkbenchModel({
        publication: archivedOnlyPublication,
        selectedProjectPath: 'Projects/Archive/Project.md',
        readyDisplayLimit: 5,
      }).state,
    ).toBe('project_unavailable');
  });

  it('projects counts and a bounded Ready list using canonical sorting', () => {
    const model = project(
      buildProjectWorkbenchModel({
        publication: publication(workbenchFixture(), {
          publicationId: 19,
          runtimeGeneration: 3,
          revision: 7,
        }),
        selectedProjectPath: 'Projects/Game/Project.md',
        readyDisplayLimit: 2,
      }),
    );

    expect(model).toMatchObject({
      publicationId: 19,
      runtimeGeneration: 3,
      indexRevision: 7,
      indexFreshness: 'current',
      banner: null,
      counts: {
        tasks: 5,
        diagnostics: 1,
        ready: 3,
        inProgress: 1,
        blocked: 1,
      },
      taskState: 'has_ready',
      ready: {
        total: 3,
        displayed: 2,
        truncated: true,
      },
    });
    expect(model.ready.items).toEqual([
      {
        path: 'Projects/Game/Tasks/Ranked low.md',
        title: 'Ranked low',
        rank: 100,
        priority: 'low',
        unlockCount: 1,
      },
      {
        path: 'Projects/Game/Tasks/Ranked critical.md',
        title: 'Ranked critical',
        rank: 200,
        priority: 'critical',
        unlockCount: 0,
      },
    ]);
  });

  it('lists every non-terminal status by default in deterministic status and rank order', () => {
    const model = project(
      buildProjectWorkbenchModel({
        publication: publication([
          sourceNote('Projects/Tasks/Project.md', 'type: project'),
          task(
            'Projects/Tasks/Tasks/Todo later.md',
            'Projects/Tasks/Project',
            'todo',
            [
              'rank: 200',
              'priority: critical',
              'depends_on: "[[Projects/Tasks/Tasks/In progress]]"',
            ],
          ),
          task(
            'Projects/Tasks/Tasks/Backlog.md',
            'Projects/Tasks/Project',
            'backlog',
          ),
          task(
            'Projects/Tasks/Tasks/Todo first.md',
            'Projects/Tasks/Project',
            'todo',
            ['rank: 100', 'priority: low'],
          ),
          task(
            'Projects/Tasks/Tasks/In progress.md',
            'Projects/Tasks/Project',
            'in-progress',
          ),
          task(
            'Projects/Tasks/Tasks/Waiting.md',
            'Projects/Tasks/Project',
            'waiting',
          ),
          task(
            'Projects/Tasks/Tasks/Review.md',
            'Projects/Tasks/Project',
            'review',
          ),
          task(
            'Projects/Tasks/Tasks/Done.md',
            'Projects/Tasks/Project',
            'done',
          ),
          task(
            'Projects/Tasks/Tasks/Cancelled.md',
            'Projects/Tasks/Project',
            'cancelled',
          ),
          sourceNote('Projects/Other/Project.md', 'type: project'),
          task(
            'Projects/Other/Tasks/Do not mix.md',
            'Projects/Other/Project',
            'todo',
          ),
        ]),
        selectedProjectPath: 'Projects/Tasks/Project.md',
        readyDisplayLimit: 5,
        taskDisplayLimit: 20,
      }),
    );

    expect(model.allTasks).toMatchObject({
      total: 6,
      displayed: 6,
      truncated: false,
      statuses: ['backlog', 'todo', 'in-progress', 'waiting', 'review'],
      search: '',
    });
    expect(model.allTasks.items.map((item) => item.path)).toEqual([
      'Projects/Tasks/Tasks/Backlog.md',
      'Projects/Tasks/Tasks/Todo first.md',
      'Projects/Tasks/Tasks/Todo later.md',
      'Projects/Tasks/Tasks/In progress.md',
      'Projects/Tasks/Tasks/Waiting.md',
      'Projects/Tasks/Tasks/Review.md',
    ]);
    expect(model.allTasks.items[1]).toMatchObject({
      status: 'todo',
      rank: 100,
      priority: 'low',
      ready: true,
      blockerCount: 0,
    });
    expect(model.allTasks.items[2]).toMatchObject({
      status: 'todo',
      ready: false,
      blockerCount: 1,
    });
  });

  it('makes terminal tasks explicitly filterable and searches title or path case-insensitively', () => {
    const model = project(
      buildProjectWorkbenchModel({
        publication: publication([
          sourceNote('Projects/History/Project.md', 'type: project'),
          task(
            'Projects/History/Tasks/Released.md',
            'Projects/History/Project',
            'done',
          ),
          task(
            'Projects/History/Tasks/Abandoned HISTORY.md',
            'Projects/History/Project',
            'cancelled',
          ),
          task(
            'Projects/History/Tasks/History active.md',
            'Projects/History/Project',
            'todo',
          ),
        ]),
        selectedProjectPath: 'Projects/History/Project.md',
        readyDisplayLimit: 5,
        taskStatuses: ['done', 'cancelled'],
        taskSearch: '  abandoned history  ',
      }),
    );

    expect(model.allTasks).toMatchObject({
      total: 1,
      displayed: 1,
      truncated: false,
      statuses: ['done', 'cancelled'],
      search: 'abandoned history',
    });
    expect(model.allTasks.items[0]).toMatchObject({
      path: 'Projects/History/Tasks/Abandoned HISTORY.md',
      status: 'cancelled',
    });
  });

  it('filters through an injected search matcher instead of its default', () => {
    // The seam that lets the search strategy change without touching the
    // model. A token matcher stands in for a strategy added later: the default
    // rejects a split query, an injected one accepts it.
    const everyToken: TaskSearchMatcher = (candidate, query) =>
      query
        .split(/\s+/u)
        .filter((token) => token.length > 0)
        .every((token) =>
          (candidate.title + '\n' + candidate.path)
            .toLocaleLowerCase()
            .includes(token),
        )
        ? 0
        : null;

    const scope = {
      publication: publication([
        sourceNote('Projects/Game/Project.md', 'type: project'),
        task(
          'Projects/Game/Tasks/Combat dodge roll.md',
          'Projects/Game/Project',
          'todo',
        ),
      ]),
      selectedProjectPath: 'Projects/Game/Project.md',
      readyDisplayLimit: 5,
      taskSearch: 'combat roll',
    } as const;

    expect(project(buildProjectWorkbenchModel(scope)).allTasks.total).toBe(0);
    expect(
      project(
        buildProjectWorkbenchModel({
          ...scope,
          taskSearchMatcher: everyToken,
        }),
      ).allTasks.total,
    ).toBe(1);
  });

  it('keeps a matcher from widening the other filters', () => {
    // A matcher that accepts everything must not resurrect a status the user
    // excluded; search is one predicate among several, not an override.
    const matchAll: TaskSearchMatcher = () => 0;
    const model = project(
      buildProjectWorkbenchModel({
        publication: publication([
          sourceNote('Projects/Game/Project.md', 'type: project'),
          task(
            'Projects/Game/Tasks/Combat dodge roll.md',
            'Projects/Game/Project',
            'done',
          ),
        ]),
        selectedProjectPath: 'Projects/Game/Project.md',
        readyDisplayLimit: 5,
        taskSearch: 'anything',
        taskSearchMatcher: matchAll,
      }),
    );

    expect(model.allTasks.total).toBe(0);
  });

  it('caps All Tasks rendering at 200 results after filtering', () => {
    const generatedTasks = Array.from({ length: 205 }, (_, index) =>
      task(
        'Projects/Large/Tasks/Task ' + String(index).padStart(3, '0') + '.md',
        'Projects/Large/Project',
        'backlog',
      ),
    );
    const model = project(
      buildProjectWorkbenchModel({
        publication: publication([
          sourceNote('Projects/Large/Project.md', 'type: project'),
          ...generatedTasks,
        ]),
        selectedProjectPath: 'Projects/Large/Project.md',
        readyDisplayLimit: 5,
        taskDisplayLimit: 500,
        taskStatuses: ['backlog'],
      }),
    );

    expect(model.allTasks).toMatchObject({
      total: 205,
      displayed: 200,
      truncated: true,
    });
    expect(model.allTasks.items[0]?.path).toBe(
      'Projects/Large/Tasks/Task 000.md',
    );
    expect(model.allTasks.items.at(-1)?.path).toBe(
      'Projects/Large/Tasks/Task 199.md',
    );
  });

  it('pages past the 200 bound and clamps an offset the results no longer reach', () => {
    const generatedTasks = Array.from({ length: 205 }, (_, index) =>
      task(
        'Projects/Large/Tasks/Task ' + String(index).padStart(3, '0') + '.md',
        'Projects/Large/Project',
        'backlog',
      ),
    );
    const pageAt = (taskOffset: number) =>
      project(
        buildProjectWorkbenchModel({
          publication: publication([
            sourceNote('Projects/Large/Project.md', 'type: project'),
            ...generatedTasks,
          ]),
          selectedProjectPath: 'Projects/Large/Project.md',
          readyDisplayLimit: 5,
          taskDisplayLimit: 200,
          taskOffset,
          taskStatuses: ['backlog'],
        }),
      ).allTasks;

    // The tail past the per-request bound is reachable, and the last page is
    // short rather than padded.
    const second = pageAt(200);
    expect(second).toMatchObject({
      total: 205,
      displayed: 5,
      offset: 200,
      truncated: false,
    });
    expect(second.items[0]?.path).toBe('Projects/Large/Tasks/Task 200.md');

    // An offset past the end lands on the last page, not on an empty one.
    expect(pageAt(4000).offset).toBe(200);
    // A ragged offset snaps back onto a page boundary.
    expect(pageAt(137).offset).toBe(0);
  });

  it('filters by priority, epic, milestone, owner, and due state while exposing deterministic options', () => {
    const notes = [
      sourceNote('Projects/Filters/Project.md', 'type: project'),
      sourceNote(
        'Projects/Filters/Epics/Engine.md',
        [
          'type: epic',
          'project: "[[Projects/Filters/Project]]"',
          'status: active',
        ].join('\n'),
      ),
      sourceNote(
        'Projects/Filters/Milestones/Alpha.md',
        [
          'type: milestone',
          'project: "[[Projects/Filters/Project]]"',
          'status: planned',
        ].join('\n'),
      ),
      task(
        'Projects/Filters/Tasks/Matching.md',
        'Projects/Filters/Project',
        'todo',
        [
          'priority: high',
          'owner: Robin',
          'due_date: 2026-08-03',
          'epic: "[[Projects/Filters/Epics/Engine]]"',
          'milestone: "[[Projects/Filters/Milestones/Alpha]]"',
        ],
      ),
      task(
        'Projects/Filters/Tasks/Other.md',
        'Projects/Filters/Project',
        'todo',
        ['priority: low', 'owner: Casey', 'due_date: 2026-08-04'],
      ),
    ];
    const model = project(
      buildProjectWorkbenchModel({
        publication: publication(notes),
        selectedProjectPath: 'Projects/Filters/Project.md',
        readyDisplayLimit: 5,
        taskPriority: 'high',
        taskEpicPath: 'Projects/Filters/Epics/Engine.md',
        taskMilestonePath: 'Projects/Filters/Milestones/Alpha.md',
        taskOwner: 'Robin',
        taskDueState: 'today',
        taskToday: '2026-08-03',
      }),
    );

    expect(model.allTasks).toMatchObject({
      total: 1,
      priority: 'high',
      epicPath: 'Projects/Filters/Epics/Engine.md',
      milestonePath: 'Projects/Filters/Milestones/Alpha.md',
      owner: 'Robin',
      dueState: 'today',
      filterOptions: {
        epics: [
          {
            value: 'Projects/Filters/Epics/Engine.md',
            label: 'Engine',
          },
        ],
        milestones: [
          {
            value: 'Projects/Filters/Milestones/Alpha.md',
            label: 'Alpha',
          },
        ],
        owners: [
          { value: 'Casey', label: 'Casey' },
          { value: 'Robin', label: 'Robin' },
        ],
      },
    });
    expect(model.allTasks.items[0]).toMatchObject({
      path: 'Projects/Filters/Tasks/Matching.md',
      priority: 'high',
      owner: 'Robin',
      dueDate: '2026-08-03',
      epic: {
        path: 'Projects/Filters/Epics/Engine.md',
        title: 'Engine',
      },
      milestone: {
        path: 'Projects/Filters/Milestones/Alpha.md',
        title: 'Alpha',
      },
    });
  });

  it('distinguishes past, today, future, and missing due dates from an injected local date', () => {
    const notes = [
      sourceNote('Projects/Due/Project.md', 'type: project'),
      task('Projects/Due/Tasks/Past.md', 'Projects/Due/Project', 'todo', [
        'due_date: 2026-08-02',
      ]),
      task('Projects/Due/Tasks/Today.md', 'Projects/Due/Project', 'todo', [
        'due_date: 2026-08-03',
      ]),
      task('Projects/Due/Tasks/Future.md', 'Projects/Due/Project', 'todo', [
        'due_date: 2026-08-04',
      ]),
      task('Projects/Due/Tasks/None.md', 'Projects/Due/Project', 'todo'),
    ];
    const expected = {
      past: 'Past',
      today: 'Today',
      future: 'Future',
      none: 'None',
    } as const;

    for (const [dueState, title] of Object.entries(expected)) {
      const model = project(
        buildProjectWorkbenchModel({
          publication: publication(notes),
          selectedProjectPath: 'Projects/Due/Project.md',
          readyDisplayLimit: 5,
          taskDueState: dueState as keyof typeof expected,
          taskToday: '2026-08-03',
        }),
      );
      expect(model.allTasks.items.map((item) => item.title)).toEqual([title]);
    }
  });
  it('exposes bounded, severity-ordered diagnostic details for only the selected project', () => {
    const model = project(
      buildProjectWorkbenchModel({
        publication: publication([
          sourceNote('Projects/Alpha/Project.md', 'type: project'),
          sourceNote(
            'Projects/Alpha/Tasks/Invalid completion.md',
            [
              'type: task',
              'title: 42',
              'project: "[[Projects/Alpha/Project]]"',
              'status: todo',
              'completed_at: "2026-08-02T10:00:00-07:00"',
              'due_date: 2026-02-30',
            ].join('\n'),
          ),
          sourceNote(
            'Projects/Beta/Project.md',
            ['type: project', 'weave:', '  dependency_mode: invalid'].join(
              '\n',
            ),
          ),
        ]),
        selectedProjectPath: 'Projects/Alpha/Project.md',
        readyDisplayLimit: 5,
        diagnosticDisplayLimit: 2,
      }),
    );

    expect(model.counts.diagnostics).toBe(3);
    expect(model.diagnostics).toMatchObject({
      total: 3,
      errors: 2,
      warnings: 1,
      info: 0,
      displayed: 2,
      truncated: true,
    });
    expect(model.diagnostics.items).toEqual([
      {
        severity: 'error',
        code: 'task.completed_at.status_mismatch',
        path: 'Projects/Alpha/Tasks/Invalid completion.md',
        field: 'completed_at',
        message: '`completed_at` is valid only when task status is `done`.',
        recovery:
          'Set status to done or remove completed_at through an explicit edit.',
      },
      {
        severity: 'error',
        code: 'task.due_date.invalid',
        path: 'Projects/Alpha/Tasks/Invalid completion.md',
        field: 'due_date',
        message:
          'Field `due_date` must be a real calendar date in YYYY-MM-DD form.',
      },
    ]);
  });

  it('surfaces malformed and ownerless notes as unassigned diagnostics', () => {
    const model = project(
      buildProjectWorkbenchModel({
        publication: publication([
          sourceNote('Projects/Alpha/Project.md', 'type: project'),
          sourceNote('Inbox/Malformed.md', 'type: 42'),
          sourceNote(
            'Inbox/Missing project.md',
            ['type: task', 'status: todo'].join('\n'),
          ),
        ]),
        selectedProjectPath: 'Projects/Alpha/Project.md',
        readyDisplayLimit: 5,
        unassignedDiagnosticDisplayLimit: 1,
      }),
    );

    expect(model.diagnostics.total).toBe(0);
    expect(model.unassignedDiagnostics).toMatchObject({
      total: 2,
      errors: 2,
      warnings: 0,
      info: 0,
      displayed: 1,
      truncated: true,
    });
    expect(model.unassignedDiagnostics.items).toEqual([
      {
        severity: 'error',
        code: 'entity.type.invalid',
        path: 'Inbox/Malformed.md',
        field: 'type',
        message: 'Frontmatter field `type` must be a string.',
        recovery:
          'Use a supported entity type or remove the field from an ordinary note.',
      },
    ]);
  });

  it('preserves related paths for diagnostic note navigation', () => {
    const model = project(
      buildProjectWorkbenchModel({
        publication: publication([
          sourceNote('Projects/Game/Project.md', 'type: project'),
          task(
            'Projects/Game/Tasks/Alpha.md',
            'Projects/Game/Project',
            'todo',
            ['rank: 100'],
          ),
          task('Projects/Game/Tasks/Beta.md', 'Projects/Game/Project', 'todo', [
            'rank: 100',
          ]),
        ]),
        selectedProjectPath: 'Projects/Game/Project.md',
        readyDisplayLimit: 5,
        diagnosticDisplayLimit: 10,
      }),
    );

    expect(model.diagnostics.total).toBe(2);
    expect(model.diagnostics.items[0]).toMatchObject({
      severity: 'warning',
      code: 'task.rank.duplicate',
      path: 'Projects/Game/Tasks/Alpha.md',
      field: 'rank',
      relatedPaths: ['Projects/Game/Tasks/Beta.md'],
    });
  });

  it('includes diagnostics from portfolio sprints linked to the project', () => {
    const model = project(
      buildProjectWorkbenchModel({
        publication: publication([
          sourceNote('Projects/Game/Project.md', 'type: project'),
          sourceNote(
            'Periods/Portfolio.md',
            [
              'type: sprint',
              'title: 42',
              'scope: portfolio',
              'projects:',
              '  - "[[Projects/Game/Project]]"',
              'status: planned',
            ].join('\n'),
          ),
        ]),
        selectedProjectPath: 'Projects/Game/Project.md',
        readyDisplayLimit: 5,
      }),
    );

    expect(model.diagnostics.items).toEqual([
      expect.objectContaining({
        severity: 'warning',
        code: 'entity.title.invalid',
        path: 'Periods/Portfolio.md',
        field: 'title',
      }),
    ]);
  });

  it('distinguishes a project with no tasks from one with no ready tasks', () => {
    const noTasks = project(
      buildProjectWorkbenchModel({
        publication: publication([
          sourceNote('Projects/Empty/Project.md', 'type: project'),
        ]),
        selectedProjectPath: 'Projects/Empty/Project.md',
        readyDisplayLimit: 5,
      }),
    );
    expect(noTasks.taskState).toBe('no_tasks');
    expect(noTasks.ready).toMatchObject({
      items: [],
      total: 0,
      displayed: 0,
      truncated: false,
    });
    expect(noTasks.diagnostics).toEqual({
      items: [],
      total: 0,
      errors: 0,
      warnings: 0,
      info: 0,
      displayed: 0,
      truncated: false,
    });

    const noReady = project(
      buildProjectWorkbenchModel({
        publication: publication([
          sourceNote('Projects/Quiet/Project.md', 'type: project'),
          task(
            'Projects/Quiet/Tasks/Done.md',
            'Projects/Quiet/Project',
            'done',
          ),
        ]),
        selectedProjectPath: 'Projects/Quiet/Project.md',
        readyDisplayLimit: 5,
      }),
    );
    expect(noReady.counts.tasks).toBe(1);
    expect(noReady.taskState).toBe('no_ready');
    expect(noReady.ready.total).toBe(0);
  });

  it('surfaces a stale-last-good banner without changing the project data', () => {
    const current = publication(workbenchFixture());
    const stale = {
      ...current,
      snapshot: current.snapshot.withFreshness('stale_last_good'),
    };
    const model = project(
      buildProjectWorkbenchModel({
        publication: stale,
        selectedProjectPath: 'Projects/Game/Project.md',
        readyDisplayLimit: 20,
      }),
    );

    expect(model.indexFreshness).toBe('stale_last_good');
    expect(model.banner).toEqual({
      kind: 'stale_last_good',
      message: 'Showing stale index revision 1; some data may be out of date.',
    });
    expect(model.ready.displayed).toBe(3);
    expect(model.ready.truncated).toBe(false);
  });
});

function publication(
  notes: readonly SourceNote[],
  options: {
    readonly publicationId?: number;
    readonly runtimeGeneration?: number;
    readonly revision?: number;
  } = {},
): ProjectWorkbenchReadPublication {
  return {
    publicationId: options.publicationId ?? 1,
    runtimeGeneration: options.runtimeGeneration ?? 1,
    snapshot: new IndexBuilder().build(notes, {
      revision: options.revision ?? 1,
    }),
  };
}

function project(model: ReturnType<typeof buildProjectWorkbenchModel>) {
  if (model.state !== 'project') {
    throw new Error(`Expected a project model, received ${model.state}.`);
  }
  return model;
}

function workbenchFixture(): readonly SourceNote[] {
  return [
    sourceNote(
      'Projects/Game/Project.md',
      ['type: project', 'weave:', '  dependency_mode: invalid'].join('\n'),
    ),
    task('Projects/Game/Tasks/Ranked low.md', 'Projects/Game/Project', 'todo', [
      'rank: 100',
      'priority: low',
    ]),
    task(
      'Projects/Game/Tasks/Ranked critical.md',
      'Projects/Game/Project',
      'todo',
      ['rank: 200', 'priority: critical'],
    ),
    task(
      'Projects/Game/Tasks/Unranked critical.md',
      'Projects/Game/Project',
      'todo',
      ['priority: critical'],
    ),
    task('Projects/Game/Tasks/Blocked.md', 'Projects/Game/Project', 'todo', [
      'depends_on: "[[Projects/Game/Tasks/Ranked low]]"',
    ]),
    task(
      'Projects/Game/Tasks/In progress.md',
      'Projects/Game/Project',
      'in-progress',
    ),
  ];
}

function task(
  path: string,
  projectPath: string,
  status: string,
  extra: readonly string[] = [],
): SourceNote {
  return sourceNote(
    path,
    [
      'type: task',
      `project: "[[${projectPath}]]"`,
      `status: ${status}`,
      ...extra,
    ].join('\n'),
  );
}
