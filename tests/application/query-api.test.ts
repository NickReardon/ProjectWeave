import { describe, expect, it } from 'vitest';

import { ProjectWeaveQueryApi } from '../../src/application/query-api';
import { TemplateResolver } from '../../src/application/template-resolver';
import { IndexBuilder } from '../../src/indexing/index-builder';
import type { SourceNote } from '../../src/domain/model';
import type { VaultReader } from '../../src/ports/vault-reader';
import { PathLinkResolver } from '../../src/ports/vault-reader';
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

  it('searches with an explicit runtime strategy and relevance ordering', async () => {
    const notes = fixture();
    const snapshot = new IndexBuilder().build(notes, { revision: 2 });
    const api = new ProjectWeaveQueryApi(() => snapshot);
    const result = await api.search({
      projectPath: 'Projects/Game.md',
      query: 'rcr',
      mode: 'fuzzy',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected search results');
    expect(result.items.map((hit) => hit.title)).toContain('Ranked critical');
    expect(
      result.items.every((hit) => hit.path !== 'Tasks/Other project.md'),
    ).toBe(true);
    expect(result.items).toEqual(
      [...result.items].sort(
        (left, right) =>
          right.score - left.score || left.path.localeCompare(right.path),
      ),
    );
  });

  it('reads only granted Markdown sections with fingerprints and byte cursors', async () => {
    const notes = [
      ...fixture(),
      sourceNote(
        'Projects/Game/Documents/Design.md',
        '',
        '# Design\n\nIntro.\n\n## Requirements\n\nAlpha βeta gamma.\n\n## Notes\n\nLater.',
      ),
    ];
    const snapshot = new IndexBuilder().build(notes, { revision: 3 });
    const api = new ProjectWeaveQueryApi(() => snapshot, {
      vault: new MemoryVault(notes),
    });
    const first = await api.readNote({
      projectPath: 'Projects/Game.md',
      path: 'Projects/Game/Documents/Design.md',
      heading: 'Requirements',
      contentRoots: ['Projects/Game/Documents'],
      maxBytes: 12,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error('Expected a note read');
    expect(first.note.fingerprint).toContain('Design.md');
    expect(first.note.heading).toBe('Requirements');
    expect(first.note.untrusted).toBe(true);
    expect(first.page.truncated).toBe(true);

    const second = await api.readNote({
      projectPath: 'Projects/Game.md',
      path: 'Projects/Game/Documents/Design.md',
      heading: 'Requirements',
      contentRoots: ['Projects/Game/Documents'],
      cursor: first.page.next_cursor ?? undefined,
      maxBytes: 100,
    });
    expect(second.ok && second.note.content).toContain('Alpha βeta gamma.');

    const denied = await api.readNote({
      projectPath: 'Projects/Game.md',
      path: 'Projects/Other.md',
      contentRoots: ['Projects/Game/Documents'],
    });
    expect(denied.ok).toBe(false);
    expect(denied.ok ? '' : denied.diagnostics[0]?.code).toBe(
      'query.read.out_of_scope',
    );
  });

  it('returns related work, dependency sequence, actions, diagnostics, and creation context', async () => {
    const notes = [
      ...fixture(),
      sourceNote(
        'Projects/Game/Documents/Design.md',
        '',
        '# Design\n\n## Requirements\n',
      ),
      sourceNote(
        'Tasks/Origin task.md',
        [
          'type: task',
          'project: "[[Projects/Game]]"',
          'status: backlog',
          'origin: "[[Projects/Game/Documents/Design#Requirements]]"',
        ].join('\n'),
      ),
    ];
    const snapshot = new IndexBuilder().build(notes, {
      revision: 4,
      resolver: new PathLinkResolver(notes.map((note) => note.path)),
    });
    const api = new ProjectWeaveQueryApi(() => snapshot, {
      taskTemplates: () => new TemplateResolver(),
    });
    const related = await api.getRelatedWork({
      projectPath: 'Projects/Game.md',
      notePath: 'Projects/Game/Documents/Design.md',
      heading: 'Requirements',
    });
    expect(related.ok && related.items.map((ref) => ref.path)).toEqual([
      'Tasks/Origin task.md',
    ]);

    const sequence = await api.getSequence({ projectPath: 'Projects/Game.md' });
    expect(sequence.ok).toBe(true);
    if (!sequence.ok) throw new Error('Expected sequence');
    expect(
      sequence.items.findIndex(
        (item) => item.ref.path === 'Tasks/Prerequisite.md',
      ),
    ).toBeLessThan(
      sequence.items.findIndex((item) => item.ref.path === 'Tasks/Blocked.md'),
    );

    const actions = await api.getActionContext({
      projectPath: 'Projects/Game.md',
      taskPath: 'Tasks/Blocked.md',
    });
    expect(actions.ok && actions.actions[0]).toMatchObject({
      enabled: false,
      reason_code: 'task.blocked',
    });

    const diagnostics = await api.getDiagnostics({
      projectPath: 'Projects/Game.md',
    });
    expect(diagnostics.ok).toBe(true);

    const creation = await api.getCreationContext({
      projectPath: 'Projects/Game.md',
      kind: 'task',
    });
    expect(creation.ok && creation.available_variants).toEqual(['default']);
  });
});

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
