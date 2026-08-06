// @vitest-environment happy-dom

import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { NoteCreationCommitResult } from '../../src/application/note-creation-commit';
import { TaskCreationPreviewService } from '../../src/application/task-creation-preview';
import { TaskCreationProposalService } from '../../src/application/task-creation-proposal';
import { TaskTemplateResolver } from '../../src/application/task-template-resolver';
import { VaultTemplateLibrary } from '../../src/application/vault-template-library';
import type { SourceNote } from '../../src/domain/model';
import { IndexBuilder } from '../../src/indexing/index-builder';
import type { IndexSnapshot } from '../../src/indexing/index-snapshot';
import { PathLinkResolver } from '../../src/ports/vault-reader';
import { TaskCreationPreviewModal } from '../../src/ui/task-creation-preview-modal';
import { MemoryVault } from '../helpers/memory-vault';
import { installObsidianDom } from '../helpers/obsidian-dom';
import {
  clearNotices,
  createStubApp,
  recordedNotices,
} from '../helpers/obsidian-stub';
import { sourceNote } from '../helpers/source-note';

/**
 * What the create-task modal actually shows. The allocator and preview service
 * are tested directly; these drive the real services through the modal, so a
 * correct allocation that never reaches the user still fails.
 *
 * Nothing here writes: the commit runner is a double, because the write path
 * has its own tests and a modal test should not depend on one.
 */

const PROJECT_PATH = 'Projects/Game/Project.md';

/** Longer than the modal's internal debounce. */
const DEBOUNCE_MS = 400;

beforeAll(() => {
  installObsidianDom();
});

beforeEach(() => {
  clearNotices();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function task(path: string, frontmatter: string): SourceNote {
  return sourceNote(
    path,
    `type: task\nproject: "[[Projects/Game/Project]]"\n${frontmatter}`,
  );
}

/** The fixture vault's shape: ranks 1000 through 4000 under Tasks/. */
function fixtureNotes(): readonly SourceNote[] {
  return [
    sourceNote(PROJECT_PATH, 'type: project\ntitle: Fixture Game'),
    task('Projects/Game/Tasks/Define request.md', 'status: done\nrank: 1000'),
    task(
      'Projects/Game/Tasks/Implement request.md',
      'status: todo\nrank: 2000',
    ),
    task(
      'Projects/Game/Tasks/External prerequisite.md',
      'status: in-progress\nrank: 3000',
    ),
    task('Projects/Game/Tasks/Blocked request.md', 'status: todo\nrank: 4000'),
  ];
}

interface ModalHarness {
  readonly modal: TaskCreationPreviewModal;
  readonly content: HTMLElement;
  readonly text: () => string;
  readonly type: (placeholder: string, value: string) => void;
  readonly settle: () => Promise<void>;
  readonly createButton: () => HTMLButtonElement;
  readonly openedNotes: string[];
  /**
   * Whether the modal is still open. Typechecking sees Obsidian's real `Modal`,
   * which has no such member, so the stub's flag is read through a cast.
   */
  readonly isOpen: () => boolean;
}

function openModal(
  notes: readonly SourceNote[] = fixtureNotes(),
  commit: (proposal: unknown) => Promise<NoteCreationCommitResult> = () =>
    Promise.resolve({
      ok: true,
      operation_id: 'test',
      created_path: 'Projects/Game/Tasks/Untitled.md',
      diagnostics: [],
    }),
  options: {
    readonly libraryFolder?: string;
    readonly variants?: readonly string[];
  } = {},
): ModalHarness {
  const vault = new MemoryVault(notes);
  const links = new PathLinkResolver(notes.map((note) => note.path));
  const snapshot: IndexSnapshot = new IndexBuilder().build(notes, {
    revision: 7,
    resolver: links,
  });
  const getSnapshot = (): IndexSnapshot => snapshot;
  const preview = new TaskCreationPreviewService(
    getSnapshot,
    vault,
    new TaskCreationProposalService(
      getSnapshot,
      vault,
      new TaskTemplateResolver(
        vault,
        links,
        options.libraryFolder === undefined
          ? null
          : new VaultTemplateLibrary(vault, options.libraryFolder),
      ),
    ),
  );

  const openedNotes: string[] = [];
  const app = createStubApp(notes.map((note) => note.path));
  const variants = options.variants ?? ['default'];
  const modal = new TaskCreationPreviewModal(app as never, {
    projectTitle: 'Fixture Game',
    projectPath: PROJECT_PATH,
    templateVariants: variants,
    run: (request) =>
      preview.preview({
        ...request,
        projectPath: PROJECT_PATH,
        clock: { year: 2026, month: 8, day: 4, hour: 9, minute: 0, second: 0 },
      }),
    commit: (proposal) => commit(proposal),
    openNote: async (path) => {
      openedNotes.push(path);
    },
  });

  modal.open();
  const content = modal.contentEl;

  return {
    modal,
    content,
    openedNotes,
    isOpen: () => (modal as unknown as { isOpen: boolean }).isOpen,
    text: () => content.textContent ?? '',
    type(placeholder, value) {
      const field = content.querySelector<HTMLInputElement>(
        `input[placeholder="${placeholder}"]`,
      );
      if (field === null) {
        throw new Error(`No field with placeholder "${placeholder}".`);
      }
      field.value = value;
      field.dispatchEvent(new Event('input'));
    },
    async settle() {
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    },
    createButton() {
      const buttons = [
        ...content.querySelectorAll<HTMLButtonElement>('button'),
      ].filter((button) => button.textContent?.startsWith('Create'));
      const button = buttons[0];
      if (button === undefined) {
        throw new Error('The modal has no create button.');
      }
      return button;
    },
  };
}

describe('Create task modal', () => {
  it('writes nothing and explains itself before a title is entered', async () => {
    const harness = openModal();

    expect(harness.text()).toContain(
      'Enter a title to see the note that would be created',
    );
    expect(harness.text()).toContain('Nothing is written until you choose');

    const button = harness.createButton();
    expect(button.disabled).toBe(true);
    expect(button.title).toBe('Enter a title first');

    // A disabled create button must not reach the commit runner at all.
    button.click();
    await harness.settle();
    expect(harness.openedNotes).toHaveLength(0);
  });

  it('surfaces the allocated path and the rank one gap past the largest', async () => {
    const harness = openModal();

    harness.type('Implement request', 'Write the design');
    await harness.settle();

    expect(harness.text()).toContain('Projects/Game/Tasks/Write the design.md');
    // Fixture ranks run to 4000, so the next allocation is 5000.
    expect(harness.text()).toContain('5000');
    expect(harness.text()).toContain('Exact note contents');
    expect(harness.text()).toContain(
      'Creating writes exactly these bytes to that path',
    );
    expect(harness.createButton().disabled).toBe(false);
  });

  it('nests a requested subfolder under the project task folder', async () => {
    const harness = openModal();

    harness.type('Implement request', 'Parry window');
    harness.type('Combat', 'Combat');
    await harness.settle();

    expect(harness.text()).toContain(
      'Projects/Game/Tasks/Combat/Parry window.md',
    );
  });

  it('suggests a numbered name for a collision and says nothing is overwritten', async () => {
    const harness = openModal();

    harness.type('Implement request', 'Implement request');
    await harness.settle();

    expect(harness.text()).toContain(
      'Projects/Game/Tasks/Implement request 2.md',
    );
    expect(harness.text()).toContain('a numbered name is suggested');
    expect(harness.text()).toContain('Nothing would be overwritten');
  });

  it('reports a diagnostic instead of inventing a filename', async () => {
    const harness = openModal();

    harness.type('Implement request', '///');
    await harness.settle();

    expect(harness.text()).toContain('Diagnostics');
    expect(harness.text()).not.toContain('Exact note contents');
    expect(harness.createButton().disabled).toBe(true);
  });

  it('closes and reports the created path once the commit succeeds', async () => {
    let committed = 0;
    const harness = openModal(fixtureNotes(), () => {
      committed += 1;
      return Promise.resolve({
        ok: true,
        operation_id: 'test',
        created_path: 'Projects/Game/Tasks/Write the design.md',
        diagnostics: [],
      });
    });

    harness.type('Implement request', 'Write the design');
    await harness.settle();
    harness.createButton().click();
    await vi.advanceTimersByTimeAsync(0);

    expect(committed).toBe(1);
    expect(harness.isOpen()).toBe(false);
    expect(recordedNotices).toContain(
      'Created Projects/Game/Tasks/Write the design.md',
    );
    // The note opens only when the user asked for it, which is off by default.
    expect(harness.openedNotes).toHaveLength(0);
  });

  it('keeps the modal open and shows why when the commit refuses', async () => {
    const harness = openModal(fixtureNotes(), () =>
      Promise.resolve({
        ok: false,
        operation_id: 'test',
        vault_unchanged: true,
        diagnostics: [
          {
            severity: 'error',
            code: 'commit.read_set.changed',
            message: 'The project note changed while the preview was open.',
            path: PROJECT_PATH,
          },
        ],
      }),
    );

    harness.type('Implement request', 'Write the design');
    await harness.settle();
    harness.createButton().click();
    await vi.advanceTimersByTimeAsync(0);

    expect(harness.isOpen()).toBe(true);
    expect(harness.text()).toContain(
      'The project note changed while the preview was open.',
    );
    expect(recordedNotices).toHaveLength(0);
  });
});

describe('Create task modal template chooser', () => {
  const LIBRARY = 'Templates/Project Weave';

  function libraryTemplate(variant: string, heading: string): SourceNote {
    return sourceNote(
      `${LIBRARY}/task/${variant}.md`,
      [
        'weave_template: true',
        'template_schema: 1',
        'template_for: task',
        'type: task',
        'project: "{{project_link}}"',
        'status: "{{status}}"',
        'rank: "{{rank}}"',
      ].join('\n'),
      [`# {{title}}`, '', `## ${heading}`, ''].join('\n'),
    );
  }

  it('offers no chooser when only the default template exists', () => {
    const harness = openModal();

    expect([...harness.content.querySelectorAll('select')].length).toBe(0);
  });

  it('renders the chosen variant, and the packaged escape hatch', async () => {
    const notes = [
      ...fixtureNotes(),
      libraryTemplate('default', 'House style'),
      libraryTemplate('bug', 'Steps to reproduce'),
    ];
    const harness = openModal(notes, undefined, {
      libraryFolder: LIBRARY,
      variants: ['default', 'bug'],
    });

    const chooser = harness.content.querySelector('select');
    expect(chooser).not.toBeNull();
    expect(
      [...(chooser?.querySelectorAll('option') ?? [])].map(
        (option) => option.value,
      ),
    ).toEqual(['default', 'bug', 'builtin:minimal']);

    harness.type('Implement request', 'Fix the crash');
    await harness.settle();
    // Distinctive on purpose: the packaged template also ends in "## Notes",
    // so a heading it does not have is what proves the vault rung was used.
    expect(harness.text()).toContain('## House style');

    chooser!.value = 'bug';
    chooser!.dispatchEvent(new Event('change'));
    await harness.settle();
    // The preview follows the selection: these are the bytes that get written.
    expect(harness.text()).toContain('## Steps to reproduce');
    expect(harness.text()).not.toContain('## House style');

    chooser!.value = 'builtin:minimal';
    chooser!.dispatchEvent(new Event('change'));
    await harness.settle();
    expect(harness.text()).toContain('builtin:minimal (packaged)');
  });

  it('shows the diagnostic and refuses to create when the chosen variant is broken', async () => {
    const broken = sourceNote(
      `${LIBRARY}/task/bug.md`,
      ['weave_template: true', 'template_schema: 1', 'template_for: epic'].join(
        '\n',
      ),
    );
    const harness = openModal([...fixtureNotes(), broken], undefined, {
      libraryFolder: LIBRARY,
      variants: ['default', 'bug'],
    });

    const chooser = harness.content.querySelector('select');
    chooser!.value = 'bug';
    chooser!.dispatchEvent(new Event('change'));
    harness.type('Implement request', 'Fix the crash');
    await harness.settle();

    expect(harness.text()).toContain('template.kind_mismatch');
    expect(harness.createButton().disabled).toBe(true);
  });
});
