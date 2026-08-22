import { describe, expect, it } from 'vitest';

import { NoteCreationCommitService } from '../../src/application/note-creation-commit';
import { ProjectCreationPreviewService } from '../../src/application/project-creation-preview';
import { ProjectCreationProposalService } from '../../src/application/project-creation-proposal';
import { TemplateResolver } from '../../src/application/template-resolver';
import { VaultTemplateLibrary } from '../../src/application/vault-template-library';
import type { SourceNote } from '../../src/domain/model';
import { IndexBuilder } from '../../src/indexing/index-builder';
import type { IndexSnapshot } from '../../src/indexing/index-snapshot';
import type {
  NoteCreateOutcome,
  NoteWriter,
} from '../../src/ports/note-writer';
import type { VaultReader } from '../../src/ports/vault-reader';
import { sourceNote } from '../helpers/source-note';

/**
 * The project creation chain end to end, short of Obsidian: allocate a folder,
 * render the packaged template, and commit exactly the previewed bytes.
 */

class MemoryVault implements VaultReader {
  readonly #notes: Map<string, SourceNote>;

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

  public add(note: SourceNote): void {
    this.#notes.set(note.path, note);
  }
}

class RecordingWriter implements NoteWriter {
  public readonly written: { path: string; content: string }[] = [];

  public async createNote(
    path: string,
    content: string,
  ): Promise<NoteCreateOutcome> {
    this.written.push({ path, content });
    return { kind: 'created' };
  }
}

const CLOCK = {
  year: 2026,
  month: 8,
  day: 5,
  hour: 9,
  minute: 5,
  second: 7,
} as const;

function build(
  notes: readonly SourceNote[] = [],
  libraryFolder: string | null = null,
): {
  previews: ProjectCreationPreviewService;
  vault: MemoryVault;
  snapshot: () => IndexSnapshot;
} {
  const vault = new MemoryVault(notes);
  const snapshot = new IndexBuilder().build(notes, { revision: 3 });
  const getSnapshot = (): IndexSnapshot => snapshot;
  return {
    previews: new ProjectCreationPreviewService(
      getSnapshot,
      vault,
      new ProjectCreationProposalService(
        getSnapshot,
        vault,
        new TemplateResolver(
          libraryFolder === null
            ? null
            : new VaultTemplateLibrary(vault, libraryFolder),
        ),
      ),
    ),
    vault,
    snapshot: () => snapshot,
  };
}

describe('ProjectCreationPreviewService', () => {
  it('previews a project note in a folder of its own', async () => {
    const { previews } = build();

    const result = await previews.preview({
      root: 'Projects',
      title: 'Travel Planner',
      clock: CLOCK,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.allocation).toEqual({
      targetPath: 'Projects/Travel Planner/Project.md',
      projectFolder: 'Projects/Travel Planner',
      renamedForCollision: false,
    });
    expect(result.proposal.action).toBe('Create project');
    expect(result.proposal.created_files).toHaveLength(1);
    expect(result.content).toContain('type: project');
    expect(result.content).toContain('title: Travel Planner');
    expect(result.byteLength).toBe(
      new TextEncoder().encode(result.content).length,
    );
    expect(result.diagnostics).toEqual([]);

    // The template is the packaged one, since a project-owned mapping would
    // live in the note this creates.
    expect(result.proposal.template.source).toBe('packaged');
    expect(result.proposal.read_set).toEqual([
      {
        role: 'template',
        path: 'builtin:minimal/project',
        fingerprint: 'builtin:minimal/project@schema-1',
      },
    ]);
  });

  it('suggests a suffixed folder rather than reusing an occupied one', async () => {
    const { previews } = build([
      sourceNote('Projects/Game/Tasks/Implement request.md', 'type: task'),
    ]);

    const result = await previews.preview({
      root: 'Projects',
      title: 'Game',
      clock: CLOCK,
    });

    expect(result.ok && result.allocation).toEqual({
      targetPath: 'Projects/Game 2/Project.md',
      projectFolder: 'Projects/Game 2',
      renamedForCollision: true,
    });
  });

  it('reports a title that cannot become a folder without proposing anything', async () => {
    const { previews } = build();

    const result = await previews.preview({
      root: 'Projects',
      title: '   ',
      clock: CLOCK,
    });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.allocation).toBeNull();
    expect(!result.ok && result.diagnostics[0]?.code).toBe(
      'allocation.title.unusable',
    );
  });

  it('writes exactly the previewed bytes, and only on commit', async () => {
    const { previews, vault, snapshot } = build();
    const writer = new RecordingWriter();
    const commits = new NoteCreationCommitService(snapshot, vault, writer);

    const preview = await previews.preview({
      root: 'Projects',
      title: 'Travel Planner',
      clock: CLOCK,
    });
    expect(preview.ok).toBe(true);
    if (!preview.ok) {
      return;
    }
    // Previewing wrote nothing.
    expect(writer.written).toEqual([]);

    const outcome = await commits.commit(preview.proposal);

    expect(outcome.ok).toBe(true);
    expect(outcome.ok && outcome.created_path).toBe(
      'Projects/Travel Planner/Project.md',
    );
    expect(writer.written).toEqual([
      {
        path: 'Projects/Travel Planner/Project.md',
        content: preview.content,
      },
    ]);
  });

  it('refuses to commit when a note appeared at the target since the preview', async () => {
    const { previews, vault, snapshot } = build();
    const writer = new RecordingWriter();
    const commits = new NoteCreationCommitService(snapshot, vault, writer);

    const preview = await previews.preview({
      root: 'Projects',
      title: 'Travel Planner',
      clock: CLOCK,
    });
    expect(preview.ok).toBe(true);
    if (!preview.ok) {
      return;
    }

    vault.add(
      sourceNote('Projects/Travel Planner/Project.md', 'type: project'),
    );
    const outcome = await commits.commit(preview.proposal);

    expect(outcome.ok).toBe(false);
    expect(!outcome.ok && outcome.vault_unchanged).toBe(true);
    expect(!outcome.ok && outcome.diagnostics[0]?.code).toBe(
      'commit.target.exists',
    );
    expect(writer.written).toEqual([]);
  });

  it('refuses to propose while the index is not current', async () => {
    const vault = new MemoryVault([]);
    const stale = new IndexBuilder()
      .build([], { revision: 4 })
      .withFreshness('stale_last_good');
    const previews = new ProjectCreationPreviewService(
      () => stale,
      vault,
      new ProjectCreationProposalService(() => stale, vault),
    );

    const result = await previews.preview({
      root: 'Projects',
      title: 'Travel Planner',
      clock: CLOCK,
    });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.diagnostics[0]?.code).toBe(
      'proposal.index.not_current',
    );
    // The allocation still ran, so the user can see where it would have gone.
    expect(!result.ok && result.allocation?.targetPath).toBe(
      'Projects/Travel Planner/Project.md',
    );
  });
});

describe('ProjectCreationPreviewService with a vault template library', () => {
  const LIBRARY = 'Templates/Project Weave';

  function projectTemplate(
    templateFor = 'project',
    heading = 'House style',
    path = `${LIBRARY}/project/default.md`,
  ) {
    return sourceNote(
      path,
      [
        'weave_template: true',
        'template_schema: 1',
        `template_for: ${templateFor}`,
      ].join('\n'),
      [`# {{title}}`, '', `## ${heading}`, ''].join('\n'),
    );
  }

  it('prefers the vault project template over the packaged one', async () => {
    const note = projectTemplate();
    const { previews } = build([note], LIBRARY);

    const result = await previews.preview({
      root: 'Projects',
      title: 'Travel Planner',
      clock: CLOCK,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.proposal.template.source).toBe('vault');
    expect(result.content).toContain('## House style');
    // The creation profile still supplies what makes it a project.
    expect(result.content).toContain('type: project');
    expect(result.content).toContain('title: Travel Planner');
    expect(result.content).toContain('status: planned');
    // A vault template is re-read at commit, so it is in the read set.
    expect(result.proposal.read_set).toEqual([
      { role: 'template', path: note.path, fingerprint: note.fingerprint },
    ]);
  });

  it('falls back to the packaged template when the library has none', async () => {
    const { previews } = build([], LIBRARY);

    const result = await previews.preview({
      root: 'Projects',
      title: 'Travel Planner',
      clock: CLOCK,
    });

    expect(result.ok && result.proposal.template.source).toBe('packaged');
  });

  it('selects the catalog entry by normalized key but reads its exact path', async () => {
    const note = projectTemplate(
      'project',
      'Case-preserved house style',
      `${LIBRARY}/Project/Default.md`,
    );
    const { previews } = build([note], LIBRARY);

    const result = await previews.preview({
      root: 'Projects',
      title: 'Travel Planner',
      clock: CLOCK,
    });

    expect(result.ok).toBe(true);
    expect(result.ok && result.proposal.template).toMatchObject({
      source: 'vault',
      path: note.path,
      reference: note.path,
    });
    expect(result.ok && result.content).toContain(
      '## Case-preserved house style',
    );
  });

  it('fails closed when two vault files claim project/default', async () => {
    const { previews } = build(
      [
        projectTemplate(),
        projectTemplate(
          'project',
          'Conflicting house style',
          `${LIBRARY}/Project/Default.md`,
        ),
      ],
      LIBRARY,
    );

    const result = await previews.preview({
      root: 'Projects',
      title: 'Travel Planner',
      clock: CLOCK,
    });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.diagnostics.map((issue) => issue.code)).toEqual(
      ['template.library.ambiguous'],
    );
  });

  it('does not let an ambiguous task key poison project/default', async () => {
    const notes = [
      sourceNote(
        `${LIBRARY}/task/bug.md`,
        'weave_template: true\ntemplate_schema: 1\ntemplate_for: task',
      ),
      sourceNote(
        `${LIBRARY}/Task/Bug.md`,
        'weave_template: true\ntemplate_schema: 1\ntemplate_for: task',
      ),
    ];
    const { previews } = build(notes, LIBRARY);

    const result = await previews.preview({
      root: 'Projects',
      title: 'Travel Planner',
      clock: CLOCK,
    });

    expect(result.ok).toBe(true);
    expect(result.ok && result.proposal.template.source).toBe('packaged');
    expect(result.diagnostics).toEqual([]);
  });

  it('refuses a vault template declared for another kind', async () => {
    const { previews } = build([projectTemplate('task')], LIBRARY);

    const result = await previews.preview({
      root: 'Projects',
      title: 'Travel Planner',
      clock: CLOCK,
    });

    expect(result.ok).toBe(false);
    expect(
      !result.ok && result.diagnostics.map((issue) => issue.code),
    ).toContain('template.kind_mismatch');
  });

  it('refuses to commit when the vault template changed after the preview', async () => {
    const { previews, vault, snapshot } = build([projectTemplate()], LIBRARY);
    const writer = new RecordingWriter();
    const commits = new NoteCreationCommitService(snapshot, vault, writer);

    const preview = await previews.preview({
      root: 'Projects',
      title: 'Travel Planner',
      clock: CLOCK,
    });
    expect(preview.ok).toBe(true);
    if (!preview.ok) {
      return;
    }

    vault.add(projectTemplate('project', 'Rewritten while the modal was open'));
    const outcome = await commits.commit(preview.proposal);

    expect(outcome.ok).toBe(false);
    expect(!outcome.ok && outcome.diagnostics[0]?.code).toBe(
      'commit.read_set.changed',
    );
    expect(writer.written).toEqual([]);
  });
});
