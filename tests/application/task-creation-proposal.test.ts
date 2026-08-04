import { describe, expect, it } from 'vitest';

import {
  TaskCreationProposalService,
  type TaskCreationProposalInput,
} from '../../src/application/task-creation-proposal';
import { TaskTemplateResolver } from '../../src/application/task-template-resolver';
import type { SourceNote } from '../../src/domain/model';
import { IndexBuilder } from '../../src/indexing/index-builder';
import type { IndexSnapshot } from '../../src/indexing/index-snapshot';
import {
  PathLinkResolver,
  type VaultReader,
} from '../../src/ports/vault-reader';
import { sourceNote } from '../helpers/source-note';

class MemoryVault implements VaultReader {
  readonly #notes: ReadonlyMap<string, SourceNote>;

  public constructor(notes: readonly SourceNote[]) {
    this.#notes = new Map(notes.map((note) => [note.path, note]));
  }

  public async listMarkdownNotes(): Promise<readonly SourceNote[]> {
    return [...this.#notes.values()];
  }

  public async listMarkdownPaths(): Promise<readonly string[]> {
    return [...this.#notes.keys()];
  }

  public async readMarkdownNote(path: string): Promise<SourceNote | null> {
    return this.#notes.get(path) ?? null;
  }
}

const CLOCK = {
  year: 2026,
  month: 8,
  day: 3,
  hour: 9,
  minute: 5,
  second: 7,
} as const;

function project(weave = ''): SourceNote {
  return sourceNote(
    'Projects/Game/Project.md',
    ['type: project', 'title: Fixture Game', weave].filter(Boolean).join('\n'),
  );
}

function template(path = 'Projects/Game/Templates/Task.md'): SourceNote {
  const content = [
    '---',
    'weave_template: true',
    'template_schema: 1',
    'template_for: task',
    'template_name: custom',
    'template_inputs:',
    '  summary:',
    '    type: markdown',
    '    required: true',
    'type: task',
    'title: "{{title}}"',
    'project: "{{project_link}}"',
    'status: "{{status}}"',
    '---',
    '# {{title}}',
    '',
    '{{summary}}',
    '',
  ].join('\n');
  return { path, content, fingerprint: `fingerprint:${path}` };
}

function taskMap(reference = '[[Templates/Task]]'): string {
  return [
    'weave:',
    '  templates:',
    '    task:',
    `      default: "${reference}"`,
  ].join('\n');
}

function input(
  overrides: Partial<TaskCreationProposalInput> = {},
): TaskCreationProposalInput {
  return {
    operationId: 'create-task:travel-request',
    projectPath: 'Projects/Game/Project.md',
    targetPath: 'Projects/Game/Tasks/Implement travel request.md',
    task: {
      title: 'Implement travel request',
      clock: CLOCK,
    },
    ...overrides,
  };
}

function harness(
  notes: readonly SourceNote[],
  snapshotTransform?: (snapshot: IndexSnapshot) => IndexSnapshot,
): {
  readonly vault: MemoryVault;
  readonly service: TaskCreationProposalService;
} {
  const vault = new MemoryVault(notes);
  const links = new PathLinkResolver(notes.map((note) => note.path));
  const built = new IndexBuilder().build(notes, {
    revision: 7,
    resolver: links,
  });
  const snapshot = snapshotTransform?.(built) ?? built;
  return {
    vault,
    service: new TaskCreationProposalService(
      () => snapshot,
      vault,
      new TaskTemplateResolver(vault, links),
    ),
  };
}

describe('TaskCreationProposalService', () => {
  it('builds an exact non-writing proposal from the packaged default', async () => {
    const source = project();
    const { service, vault } = harness([source]);
    const before = await vault.listMarkdownNotes();

    const result = await service.propose(input());
    const after = await vault.listMarkdownNotes();

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected a task creation proposal');
    }
    expect(result).toMatchObject({
      operation_id: 'create-task:travel-request',
      action: 'Create task',
      index_revision: 7,
      index_freshness: 'current',
      project_ref: {
        kind: 'project',
        path: source.path,
        fingerprint: source.fingerprint,
      },
      template: {
        kind: 'task',
        source: 'packaged',
        variant: 'default',
        reference: 'builtin:minimal',
      },
      preconditions: [
        {
          kind: 'path_absent',
          path: 'Projects/Game/Tasks/Implement travel request.md',
        },
      ],
    });
    expect(result.diff_summary).toBe(
      'Create task "Implement travel request" at Projects/Game/Tasks/Implement travel request.md using builtin:minimal.',
    );
    expect(result.frontmatter_changes).toMatchObject([
      {
        before: null,
        after: { type: 'task', status: 'backlog' },
      },
    ]);
    expect(result.created_files[0]?.content).toContain(
      'project: "[[Projects/Game/Project]]"',
    );
    expect(result.created_files[0]?.content).toContain('status: backlog');
    expect(result.read_set.map((entry) => entry.role)).toEqual([
      'project',
      'template',
    ]);
    expect(after).toEqual(before);
  });

  it('uses a resolved project template and carries its fingerprint', async () => {
    const projectNote = project(taskMap());
    const templateNote = template();
    const { service } = harness([projectNote, templateNote]);

    const result = await service.propose(
      input({ templateInputs: { summary: 'Implement the request handler.' } }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected a task creation proposal');
    }
    expect(result.template).toMatchObject({
      source: 'project',
      path: templateNote.path,
      fingerprint: templateNote.fingerprint,
    });
    expect(result.created_files[0]?.content).toContain(
      'Implement the request handler.',
    );
  });

  it('defaults to backlog and only uses todo for explicit board creation', async () => {
    const { service } = harness([project()]);
    const backlog = await service.propose(input());
    const board = await service.propose(
      input({
        operationId: 'create-task:on-board',
        targetPath: 'Projects/Game/Tasks/Board task.md',
        createOnBoard: true,
      }),
    );

    expect(backlog.ok && backlog.created_files[0]?.content).toContain(
      'status: backlog',
    );
    expect(board.ok && board.created_files[0]?.content).toContain(
      'status: todo',
    );
  });

  it('returns renderer diagnostics when required template input is absent', async () => {
    const { service } = harness([project(taskMap()), template()]);

    const result = await service.propose(input());

    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((issue) => issue.code)).toContain(
      'template.input.required',
    );
  });

  it('refuses to propose an overwrite at an existing target', async () => {
    const existing = sourceNote(
      'Projects/Game/Tasks/Implement travel request.md',
      [
        'type: task',
        'project: "[[Projects/Game/Project]]"',
        'status: backlog',
      ].join('\n'),
    );
    const { service } = harness([project(), existing]);

    const result = await service.propose(input());

    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((issue) => issue.code)).toContain(
      'proposal.target.exists',
    );
  });

  it('disables proposals while the index is rebuilding', async () => {
    const { service } = harness([project()], (snapshot) =>
      snapshot.withFreshness('rebuilding'),
    );

    const result = await service.propose(input());

    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((issue) => issue.code)).toEqual([
      'proposal.index.not_current',
    ]);
  });

  it('rejects an invalid operation id and missing project', async () => {
    const { service } = harness([project()]);
    const invalidOperation = await service.propose(input({ operationId: ' ' }));
    const missingProject = await service.propose(
      input({ projectPath: 'Projects/Missing.md' }),
    );

    expect(invalidOperation.diagnostics.map((issue) => issue.code)).toEqual([
      'proposal.operation_id.invalid',
    ]);
    expect(missingProject.diagnostics.map((issue) => issue.code)).toEqual([
      'proposal.project.not_found',
    ]);
  });

  it('is byte-deterministic for an identical request and read snapshot', async () => {
    const { service } = harness([project()]);
    const request = input();

    expect(await service.propose(request)).toEqual(
      await service.propose(request),
    );
  });
});
