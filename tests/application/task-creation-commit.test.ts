import { describe, expect, it } from 'vitest';

import {
  TaskCreationCommitService,
  type TaskCreationCommitResult,
} from '../../src/application/task-creation-commit';
import { TaskCreationProposalService } from '../../src/application/task-creation-proposal';
import type { TaskCreationProposal } from '../../src/application/task-creation-proposal';
import { TaskTemplateResolver } from '../../src/application/task-template-resolver';
import type { SourceNote } from '../../src/domain/model';
import { IndexBuilder } from '../../src/indexing/index-builder';
import type { IndexSnapshot } from '../../src/indexing/index-snapshot';
import type {
  NoteCreateOutcome,
  NoteWriter,
} from '../../src/ports/note-writer';
import {
  PathLinkResolver,
  type VaultReader,
} from '../../src/ports/vault-reader';
import { sourceNote } from '../helpers/source-note';

class MemoryVault implements VaultReader {
  readonly #notes = new Map<string, SourceNote>();

  public constructor(notes: readonly SourceNote[]) {
    for (const note of notes) {
      this.#notes.set(note.path, note);
    }
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

  public set(note: SourceNote): void {
    this.#notes.set(note.path, note);
  }
}

/** Records writes so a test can prove the vault was left alone. */
class RecordingWriter implements NoteWriter {
  public readonly writes: { path: string; content: string }[] = [];
  #outcome: NoteCreateOutcome = { kind: 'created' };

  public willReturn(outcome: NoteCreateOutcome): void {
    this.#outcome = outcome;
  }

  public async createNote(
    path: string,
    content: string,
  ): Promise<NoteCreateOutcome> {
    this.writes.push({ path, content });
    return this.#outcome;
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
const TARGET_PATH = 'Projects/Game/Tasks/Implement request.md';

function projectNote(): SourceNote {
  return sourceNote(PROJECT_PATH, 'type: project\ntitle: Fixture Game');
}

async function buildProposal(
  vault: MemoryVault,
  snapshot: IndexSnapshot,
): Promise<TaskCreationProposal> {
  const links = new PathLinkResolver([PROJECT_PATH]);
  const proposals = new TaskCreationProposalService(
    () => snapshot,
    vault,
    new TaskTemplateResolver(vault, links),
  );
  const proposal = await proposals.propose({
    operationId: 'op-1',
    projectPath: PROJECT_PATH,
    targetPath: TARGET_PATH,
    task: { title: 'Implement request', clock: CLOCK, rank: 1000 },
  });
  if (!proposal.ok) {
    throw new Error(
      'fixture proposal failed: ' +
        proposal.diagnostics.map((issue) => issue.code).join(','),
    );
  }
  return proposal;
}

function snapshotOf(notes: readonly SourceNote[]): IndexSnapshot {
  return new IndexBuilder().build(notes, {
    revision: 7,
    resolver: new PathLinkResolver(notes.map((note) => note.path)),
  });
}

async function harness(): Promise<{
  vault: MemoryVault;
  writer: RecordingWriter;
  proposal: TaskCreationProposal;
  snapshot: IndexSnapshot;
  commit: (
    override?: Partial<{ snapshot: IndexSnapshot }>,
  ) => Promise<TaskCreationCommitResult>;
}> {
  const notes = [projectNote()];
  const vault = new MemoryVault(notes);
  const snapshot = snapshotOf(notes);
  const writer = new RecordingWriter();
  const proposal = await buildProposal(vault, snapshot);

  return {
    vault,
    writer,
    proposal,
    snapshot,
    commit: async (override) =>
      new TaskCreationCommitService(
        () => override?.snapshot ?? snapshot,
        vault,
        writer,
      ).commit(proposal),
  };
}

describe('TaskCreationCommitService', () => {
  it('writes exactly the bytes the proposal showed', async () => {
    const { writer, proposal, commit } = await harness();

    const result = await commit();

    expect(result).toMatchObject({
      ok: true,
      operation_id: 'op-1',
      created_path: TARGET_PATH,
    });
    expect(writer.writes).toEqual([
      { path: TARGET_PATH, content: proposal.created_files[0]?.content },
    ]);
  });

  it('aborts when a read-set note changed after the preview', async () => {
    // The rendered bytes were derived from these notes, so a change means the
    // user would be confirming something they never saw.
    const { vault, writer, commit } = await harness();
    vault.set(
      sourceNote(PROJECT_PATH, 'type: project\ntitle: Renamed Mid-Flight'),
    );

    const result = await commit();

    expect(result).toMatchObject({ ok: false, vault_unchanged: true });
    expect(
      result.ok ? [] : result.diagnostics.map((issue) => issue.code),
    ).toEqual(['commit.read_set.changed']);
    expect(writer.writes).toEqual([]);
  });

  it('aborts when a read-set note disappeared after the preview', async () => {
    const notes = [projectNote()];
    const snapshot = snapshotOf(notes);
    const vault = new MemoryVault(notes);
    const proposal = await buildProposal(vault, snapshot);
    const writer = new RecordingWriter();
    const emptied = new MemoryVault([]);

    const result = await new TaskCreationCommitService(
      () => snapshot,
      emptied,
      writer,
    ).commit(proposal);

    expect(
      result.ok ? [] : result.diagnostics.map((issue) => issue.code),
    ).toEqual(['commit.read_set.missing']);
    expect(writer.writes).toEqual([]);
  });

  it('aborts when a project-owned template changed after the preview', async () => {
    // The packaged template is skipped because it ships in the build, but a
    // project template is a real note and is exactly what must be re-checked:
    // its bytes shaped the note the user confirmed.
    const templatePath = 'Projects/Game/Templates/Task.md';
    const templateNote = (body: string): SourceNote =>
      sourceNote(
        templatePath,
        [
          'weave_template: true',
          'template_schema: 1',
          'template_for: task',
          'type: task',
          'title: "{{title}}"',
          'project: "{{project_link}}"',
          'status: "{{status}}"',
        ].join('\n'),
        body,
      );
    const notes = [
      sourceNote(
        PROJECT_PATH,
        [
          'type: project',
          'title: Fixture Game',
          'weave:',
          '  templates:',
          '    task:',
          '      default: "[[Templates/Task]]"',
        ].join('\n'),
      ),
      templateNote('# {{title}}\n'),
    ];
    const vault = new MemoryVault(notes);
    const snapshot = snapshotOf(notes);
    const links = new PathLinkResolver(notes.map((note) => note.path));
    const proposal = await new TaskCreationProposalService(
      () => snapshot,
      vault,
      new TaskTemplateResolver(vault, links),
    ).propose({
      operationId: 'op-1',
      projectPath: PROJECT_PATH,
      targetPath: TARGET_PATH,
      task: { title: 'Implement request', clock: CLOCK, rank: 1000 },
    });
    if (!proposal.ok) {
      throw new Error(
        'fixture proposal failed: ' +
          proposal.diagnostics.map((issue) => issue.code).join(','),
      );
    }
    expect(proposal.template.source).toBe('project');

    const writer = new RecordingWriter();
    vault.set(templateNote('# {{title}}\n\nAn edited template body.\n'));
    const result = await new TaskCreationCommitService(
      () => snapshot,
      vault,
      writer,
    ).commit(proposal);

    expect(
      result.ok ? [] : result.diagnostics.map((issue) => issue.code),
    ).toEqual(['commit.read_set.changed']);
    expect(writer.writes).toEqual([]);
  });

  it('aborts when the target appeared between preview and commit', async () => {
    const { vault, writer, commit } = await harness();
    vault.set(sourceNote(TARGET_PATH, 'type: task\ntitle: Someone else'));

    const result = await commit();

    expect(
      result.ok ? [] : result.diagnostics.map((issue) => issue.code),
    ).toEqual(['commit.target.exists']);
    expect(writer.writes).toEqual([]);
  });

  it('aborts while the index is not current', async () => {
    const { writer, snapshot, commit } = await harness();

    const result = await commit({
      snapshot: snapshot.withFreshness('rebuilding'),
    });

    expect(
      result.ok ? [] : result.diagnostics.map((issue) => issue.code),
    ).toEqual(['commit.index.not_current']);
    expect(writer.writes).toEqual([]);
  });

  it('reports a losing race without claiming the vault changed', async () => {
    // The writer refuses to overwrite, so a note created between the
    // precondition check and the write is reported, not replaced.
    const { writer, commit } = await harness();
    writer.willReturn({ kind: 'exists' });

    const result = await commit();

    expect(result).toMatchObject({ ok: false, vault_unchanged: true });
    expect(
      result.ok ? [] : result.diagnostics.map((issue) => issue.code),
    ).toEqual(['commit.target.exists']);
  });

  it('surfaces an out-of-scope path and a refused write distinctly', async () => {
    const scoped = await harness();
    scoped.writer.willReturn({ kind: 'out_of_scope' });
    expect(
      await scoped
        .commit()
        .then((result) =>
          result.ok ? [] : result.diagnostics.map((issue) => issue.code),
        ),
    ).toEqual(['commit.target.out_of_scope']);

    const refused = await harness();
    refused.writer.willReturn({ kind: 'failed', message: 'EACCES' });
    const result = await refused.commit();
    expect(
      result.ok ? [] : result.diagnostics.map((issue) => issue.code),
    ).toEqual(['commit.write.failed']);
    expect(result.ok ? '' : result.diagnostics[0]?.message).toContain('EACCES');
  });

  it('refuses a proposal that would not create exactly one note', async () => {
    const { writer, proposal, snapshot, vault } = await harness();
    const service = new TaskCreationCommitService(
      () => snapshot,
      vault,
      writer,
    );

    const result = await service.commit({
      ...proposal,
      created_files: [],
    });

    expect(
      result.ok ? [] : result.diagnostics.map((issue) => issue.code),
    ).toEqual(['commit.proposal.unsupported']);
    expect(writer.writes).toEqual([]);
  });

  it('validates the produced note before writing it', async () => {
    const { writer, proposal, snapshot, vault } = await harness();
    const service = new TaskCreationCommitService(
      () => snapshot,
      vault,
      writer,
    );

    const result = await service.commit({
      ...proposal,
      created_files: [{ path: TARGET_PATH, content: 'no frontmatter here' }],
    });

    expect(result.ok).toBe(false);
    expect(
      result.ok ? [] : result.diagnostics.map((issue) => issue.code),
    ).toContain('commit.output.invalid');
    expect(writer.writes).toEqual([]);
  });
});
