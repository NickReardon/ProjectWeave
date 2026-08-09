import { describe, expect, it } from 'vitest';

import { getProjectDiagnostics } from '../../src/application/project-diagnostics';
import { IndexBuilder } from '../../src/indexing/index-builder';
import { sourceNote } from '../helpers/source-note';

describe('project diagnostics', () => {
  it('returns diagnostics for assigned entities but not other projects', () => {
    const snapshot = new IndexBuilder().build(
      [
        sourceNote('Projects/Game/Project.md', 'type: project'),
        sourceNote(
          'Projects/Game/Tasks/Broken.md',
          [
            'type: task',
            "project: '[[Projects/Game/Project]]'",
            'status: nope',
          ].join('\n'),
        ),
        sourceNote('Projects/Other/Project.md', 'type: project'),
        sourceNote(
          'Projects/Other/Tasks/Broken.md',
          [
            'type: task',
            "project: '[[Projects/Other/Project]]'",
            'status: nope',
          ].join('\n'),
        ),
      ],
      { revision: 1 },
    );

    expect(
      getProjectDiagnostics(snapshot, 'Projects/Game/Project.md').map(
        (diagnostic) => diagnostic.path,
      ),
    ).toEqual(['Projects/Game/Tasks/Broken.md']);
  });
});
