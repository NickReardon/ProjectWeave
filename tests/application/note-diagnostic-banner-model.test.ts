import { describe, expect, it } from 'vitest';

import { buildNoteDiagnosticBannerModel } from '../../src/application/note-diagnostic-banner-model';
import { IndexBuilder } from '../../src/indexing/index-builder';
import { sourceNote } from '../helpers/source-note';

describe('note diagnostic banner model', () => {
  it('projects bounded diagnostics for only the open note', () => {
    const snapshot = new IndexBuilder().build(
      [
        sourceNote('Projects/Game/Project.md', 'type: project'),
        sourceNote(
          'Projects/Game/Tasks/Affected.md',
          [
            'type: task',
            'title: 42',
            'project: "[[Projects/Game/Project]]"',
            'status: todo',
            'completed_at: "2026-08-02T10:00:00-07:00"',
            'due_date: 2026-02-30',
          ].join('\n'),
        ),
        sourceNote(
          'Projects/Other/Project.md',
          ['type: project', 'weave:', '  dependency_mode: invalid'].join('\n'),
        ),
      ],
      { revision: 3 },
    );

    const model = buildNoteDiagnosticBannerModel(
      snapshot,
      '\\Projects\\Game\\Tasks\\Affected.md',
      2,
    );

    expect(model).toMatchObject({
      path: 'Projects/Game/Tasks/Affected.md',
      freshness: 'current',
      total: 3,
      errors: 2,
      warnings: 1,
      info: 0,
      displayed: 2,
      truncated: true,
      tone: 'error',
    });
    expect(model?.items).toEqual([
      {
        severity: 'error',
        code: 'task.completed_at.status_mismatch',
        field: 'completed_at',
        message: '`completed_at` is valid only when task status is `done`.',
        recovery:
          'Set status to done or remove completed_at through an explicit edit.',
      },
      {
        severity: 'error',
        code: 'task.due_date.invalid',
        field: 'due_date',
        message:
          'Field `due_date` must be a real calendar date in YYYY-MM-DD form.',
      },
    ]);
    expect(
      buildNoteDiagnosticBannerModel(snapshot, 'Projects/Game/Tasks/Clean.md'),
    ).toBeNull();
  });

  it('uses the highest displayed tone and preserves controlled-status guidance', () => {
    const snapshot = new IndexBuilder().build(
      [
        sourceNote('Projects/Game/Project.md', 'type: project'),
        sourceNote(
          'Projects/Game/Tasks/Invalid status.md',
          [
            'type: task',
            'project: "[[Projects/Game/Project]]"',
            'status: complete',
            'completed_at: "2026-08-02T10:00:00-07:00"',
          ].join('\n'),
        ),
        sourceNote(
          'Projects/Game/Tasks/Warning.md',
          [
            'type: task',
            'title: 42',
            'project: "[[Projects/Game/Project]]"',
            'status: todo',
          ].join('\n'),
        ),
      ],
      { revision: 4 },
    );

    expect(
      buildNoteDiagnosticBannerModel(
        snapshot,
        'Projects/Game/Tasks/Invalid status.md',
      ),
    ).toMatchObject({
      total: 1,
      errors: 1,
      warnings: 0,
      tone: 'error',
      items: [
        {
          code: 'task.status.invalid',
          field: 'status',
          message:
            'Field `status` must be one of: backlog, todo, in-progress, waiting, review, done, cancelled.',
        },
      ],
    });
    expect(
      buildNoteDiagnosticBannerModel(
        snapshot,
        'Projects/Game/Tasks/Warning.md',
      ),
    ).toMatchObject({
      total: 1,
      errors: 0,
      warnings: 1,
      tone: 'warning',
    });
  });
});
