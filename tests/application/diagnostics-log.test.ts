import { describe, expect, it } from 'vitest';

import {
  buildDiagnosticsLogDocument,
  serializeDiagnosticsLog,
} from '../../src/application/diagnostics-log';
import { DiagnosticsLogService } from '../../src/application/diagnostics-log-service';
import { ProjectWeaveQueryApi } from '../../src/application/query-api';
import { IndexBuilder } from '../../src/indexing/index-builder';
import type { DiagnosticsLogWriter } from '../../src/ports/diagnostics-log-writer';
import { sourceNote } from '../helpers/source-note';

describe('diagnostics log', () => {
  it('groups project and unassigned diagnostics in a stable document', () => {
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
      ],
      { revision: 4 },
    );

    const document = buildDiagnosticsLogDocument(snapshot, ['Projects'], 0);

    expect(document.generated_at).toBe('1970-01-01T00:00:00.000Z');
    expect(document.counts).toEqual({
      total: 1,
      errors: 1,
      warnings: 0,
      info: 0,
    });
    expect(document.projects[0]?.diagnostics[0]?.code).toBe(
      'task.status.invalid',
    );
    expect(document.unassigned).toEqual([]);
    expect(JSON.parse(serializeDiagnosticsLog(document))).toEqual(document);
  });

  it('stays disabled for an empty folder', async () => {
    const snapshot = new IndexBuilder().build([], { revision: 1 });
    const writes: { folder: string; content: string }[] = [];
    const writer: DiagnosticsLogWriter = {
      writeDiagnosticsLog: async (folder, content) => {
        writes.push({ folder, content });
      },
    };
    const publication = {
      publicationId: 1,
      runtimeGeneration: 1,
      publishedAt: 0,
      snapshot,
      queryApi: new ProjectWeaveQueryApi(() => snapshot),
    };
    const service = new DiagnosticsLogService(
      writer,
      () => '',
      () => ['Projects'],
    );

    service.publish(publication);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(writes).toEqual([]);
  });
});
