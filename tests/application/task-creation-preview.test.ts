import { describe, expect, it } from 'vitest';

import { TaskCreationProposalService } from '../../src/application/task-creation-proposal';
import {
  byteLength,
  lineCount,
  previewOperationId,
  TaskCreationPreviewService,
} from '../../src/application/task-creation-preview';
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

const PROJECT_PATH = 'Projects/Game/Project.md';

function build(notes: readonly SourceNote[]): {
  service: TaskCreationPreviewService;
  snapshot: IndexSnapshot;
  vault: MemoryVault;
} {
  const vault = new MemoryVault(notes);
  const links = new PathLinkResolver(notes.map((note) => note.path));
  const snapshot = new IndexBuilder().build(notes, {
    revision: 7,
    resolver: links,
  });
  const getSnapshot = (): IndexSnapshot => snapshot;
  const proposals = new TaskCreationProposalService(
    getSnapshot,
    vault,
    new TaskTemplateResolver(vault, links),
  );
  return {
    service: new TaskCreationPreviewService(getSnapshot, vault, proposals),
    snapshot,
    vault,
  };
}

function vaultNotes(extra: readonly SourceNote[] = []): readonly SourceNote[] {
  return [
    sourceNote(PROJECT_PATH, 'type: project\ntitle: Fixture Game'),
    ...extra,
  ];
}

function task(path: string, frontmatter: string): SourceNote {
  return sourceNote(
    path,
    `type: task\nproject: "[[Projects/Game/Project]]"\n${frontmatter}`,
  );
}

describe('TaskCreationPreviewService', () => {
  it('allocates a path and rank, then proposes the exact note', async () => {
    const { service } = build(vaultNotes());

    const result = await service.preview({
      projectPath: PROJECT_PATH,
      title: 'Implement request',
      clock: CLOCK,
    });

    expect(result.ok).toBe(true);
    expect(result).toMatchObject({
      index_revision: 7,
      allocation: {
        targetPath: 'Projects/Game/Tasks/Implement request.md',
        taskFolder: 'Projects/Game/Tasks',
        rank: 1000,
        renamedForCollision: false,
      },
    });
    if (!result.ok) {
      return;
    }
    expect(result.proposal.created_files).toEqual([
      {
        path: 'Projects/Game/Tasks/Implement request.md',
        content: result.content,
      },
    ]);
    expect(result.proposal.preconditions).toEqual([
      { kind: 'path_absent', path: 'Projects/Game/Tasks/Implement request.md' },
    ]);
    expect(result.proposal.expected_postconditions).toEqual([
      {
        kind: 'entity_indexed',
        entity: 'task',
        path: 'Projects/Game/Tasks/Implement request.md',
        project_path: PROJECT_PATH,
      },
    ]);
  });

  it('carries the allocated rank into the rendered note', async () => {
    const { service } = build(
      vaultNotes([
        task('Projects/Game/Tasks/A.md', 'title: A\nstatus: todo\nrank: 3000'),
        task('Projects/Game/Tasks/B.md', 'title: B\nstatus: done\nrank: 9000'),
      ]),
    );

    const result = await service.preview({
      projectPath: PROJECT_PATH,
      title: 'Next up',
      clock: CLOCK,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    // Spans done tasks too, so the new rank cannot collide with 9000.
    expect(result.allocation.rank).toBe(10_000);
    expect(result.content).toContain('rank: 10000');
  });

  it('suggests a free path when the derived filename is taken', async () => {
    const { service } = build(
      vaultNotes([
        task(
          'Projects/Game/Tasks/Implement request.md',
          'title: Implement request\nstatus: todo',
        ),
      ]),
    );

    const result = await service.preview({
      projectPath: PROJECT_PATH,
      title: 'Implement request',
      clock: CLOCK,
    });

    expect(result).toMatchObject({
      ok: true,
      allocation: {
        targetPath: 'Projects/Game/Tasks/Implement request 2.md',
        renamedForCollision: true,
      },
    });
  });

  it('files a task under a requested subfolder', async () => {
    const { service } = build(vaultNotes());

    const result = await service.preview({
      projectPath: PROJECT_PATH,
      title: 'Dodge roll',
      subfolder: 'Combat',
      clock: CLOCK,
    });

    expect(result).toMatchObject({
      ok: true,
      allocation: {
        targetPath: 'Projects/Game/Tasks/Combat/Dodge roll.md',
        taskFolder: 'Projects/Game/Tasks/Combat',
      },
    });
  });

  it('defaults to backlog and puts a board task in todo', async () => {
    const { service } = build(vaultNotes());

    const backlog = await service.preview({
      projectPath: PROJECT_PATH,
      title: 'Later',
      clock: CLOCK,
    });
    const board = await service.preview({
      projectPath: PROJECT_PATH,
      title: 'Now',
      createOnBoard: true,
      clock: CLOCK,
    });

    expect(backlog.ok && backlog.content).toContain('status: backlog');
    expect(board.ok && board.content).toContain('status: todo');
  });

  it('reports an unknown project without allocating', async () => {
    const { service } = build(vaultNotes());

    const result = await service.preview({
      projectPath: 'Projects/Missing/Project.md',
      title: 'Implement request',
      clock: CLOCK,
    });

    expect(result.ok).toBe(false);
    expect(result.allocation).toBeNull();
    expect(
      result.ok ? [] : result.diagnostics.map((issue) => issue.code),
    ).toEqual(['preview.project.not_found']);
  });

  it('surfaces an unusable title as an allocation diagnostic', async () => {
    const { service } = build(vaultNotes());

    const result = await service.preview({
      projectPath: PROJECT_PATH,
      title: '///',
      clock: CLOCK,
    });

    expect(result.ok).toBe(false);
    expect(
      result.ok ? [] : result.diagnostics.map((issue) => issue.code),
    ).toEqual(['allocation.title.unusable']);
  });

  it('keeps the allocation visible when the proposal itself fails', async () => {
    // A stale index must not hide which path and rank were chosen; the user
    // still needs to see what the preview would have produced.
    const notes = vaultNotes();
    const vault = new MemoryVault(notes);
    const links = new PathLinkResolver(notes.map((note) => note.path));
    const stale = new IndexBuilder()
      .build(notes, { revision: 7, resolver: links })
      .withFreshness('rebuilding');
    const getSnapshot = (): IndexSnapshot => stale;
    const service = new TaskCreationPreviewService(
      getSnapshot,
      vault,
      new TaskCreationProposalService(
        getSnapshot,
        vault,
        new TaskTemplateResolver(vault, links),
      ),
    );

    const result = await service.preview({
      projectPath: PROJECT_PATH,
      title: 'Implement request',
      clock: CLOCK,
    });

    expect(result.ok).toBe(false);
    expect(result.allocation).toMatchObject({
      targetPath: 'Projects/Game/Tasks/Implement request.md',
    });
    expect(
      result.ok ? [] : result.diagnostics.map((issue) => issue.code),
    ).toEqual(['proposal.index.not_current']);
  });

  it('reads the vault without modifying it and is deterministic', async () => {
    const { service, vault } = build(vaultNotes());
    const before = await vault.listMarkdownNotes();

    const request = {
      projectPath: PROJECT_PATH,
      title: 'Implement request',
      clock: CLOCK,
    };
    const first = await service.preview(request);
    const second = await service.preview(request);

    expect(first).toEqual(second);
    expect(await vault.listMarkdownNotes()).toEqual(before);
  });
});

describe('preview helpers', () => {
  it('derives a stable operation id from revision and target', () => {
    expect(previewOperationId(7, 'Projects/Game/Tasks/A.md')).toBe(
      'preview:7:Projects/Game/Tasks/A.md',
    );
  });

  it('measures bytes rather than code units', () => {
    expect(byteLength('abc')).toBe(3);
    // Multi-byte characters must not read as one byte each.
    expect(byteLength('日本語')).toBe(9);
    expect(byteLength('')).toBe(0);
  });

  it('counts lines without inventing one after a trailing newline', () => {
    expect(lineCount('')).toBe(0);
    expect(lineCount('one')).toBe(1);
    expect(lineCount('one\n')).toBe(1);
    expect(lineCount('one\ntwo')).toBe(2);
    expect(lineCount('one\ntwo\n')).toBe(2);
  });
});
