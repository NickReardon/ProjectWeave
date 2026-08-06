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
import { ProjectCreationPreviewService } from '../../src/application/project-creation-preview';
import { ProjectCreationProposalService } from '../../src/application/project-creation-proposal';
import type { SourceNote } from '../../src/domain/model';
import { IndexBuilder } from '../../src/indexing/index-builder';
import type { IndexSnapshot } from '../../src/indexing/index-snapshot';
import { ProjectCreationPreviewModal } from '../../src/ui/project-creation-preview-modal';
import { MemoryVault } from '../helpers/memory-vault';
import { installObsidianDom } from '../helpers/obsidian-dom';
import { clearNotices, createStubApp } from '../helpers/obsidian-stub';
import { sourceNote } from '../helpers/source-note';

/**
 * What the create-project modal shows before anything is written. The services
 * are real, so a folder allocated correctly but never shown still fails here;
 * the commit runner is a double, because the write path has its own tests.
 */

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

function openModal(
  options: {
    readonly notes?: readonly SourceNote[];
    readonly roots?: readonly string[];
    readonly commit?: () => Promise<NoteCreationCommitResult>;
  } = {},
) {
  const notes = options.notes ?? [];
  const vault = new MemoryVault(notes);
  const snapshot: IndexSnapshot = new IndexBuilder().build(notes, {
    revision: 5,
  });
  const getSnapshot = (): IndexSnapshot => snapshot;
  const previews = new ProjectCreationPreviewService(
    getSnapshot,
    vault,
    new ProjectCreationProposalService(getSnapshot, vault),
  );

  const committed: unknown[] = [];
  const app = createStubApp(notes.map((note) => note.path));
  const modal = new ProjectCreationPreviewModal(app as never, {
    roots: options.roots ?? ['Projects'],
    run: (request) =>
      previews.preview({
        ...request,
        clock: { year: 2026, month: 8, day: 5, hour: 9, minute: 0, second: 0 },
      }),
    commit: async (proposal) => {
      committed.push(proposal);
      return await (options.commit?.() ??
        Promise.resolve({
          ok: true as const,
          operation_id: 'test',
          created_path: 'Projects/Travel Planner/Project.md',
          diagnostics: [],
        }));
    },
    openNote: async () => {
      // Nothing to open in a test; the modal decides whether to call this.
    },
  });

  modal.open();
  const content = modal.contentEl;

  return {
    content,
    committed,
    text: () => content.textContent ?? '',
    type(value: string) {
      const field = content.querySelector<HTMLInputElement>(
        'input[placeholder="Travel Planner"]',
      );
      if (field === null) {
        throw new Error('The modal has no title field.');
      }
      field.value = value;
      field.dispatchEvent(new Event('input'));
    },
    async settle() {
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    },
    createButton() {
      const button = [
        ...content.querySelectorAll<HTMLButtonElement>('button'),
      ].find((candidate) => candidate.textContent?.startsWith('Create'));
      if (button === undefined) {
        throw new Error('The modal has no create button.');
      }
      return button;
    },
  };
}

describe('Create project modal', () => {
  it('writes nothing and explains itself before a title is entered', async () => {
    const harness = openModal();

    expect(harness.text()).toContain(
      'Enter a title to see the note that would be created',
    );
    expect(harness.text()).toContain('Nothing is written until you choose');

    const button = harness.createButton();
    expect(button.disabled).toBe(true);
    expect(button.title).toBe('Enter a title first');

    button.click();
    await harness.settle();
    expect(harness.committed).toHaveLength(0);
  });

  it('shows the folder, the path, and the exact bytes it would write', async () => {
    const harness = openModal();

    harness.type('Travel Planner');
    await harness.settle();

    expect(harness.text()).toContain('Projects/Travel Planner/Project.md');
    expect(harness.text()).toContain('Projects/Travel Planner');
    expect(harness.text()).toContain('Create project');
    expect(harness.text()).toContain('type: project');
    expect(harness.text()).toContain('title: Travel Planner');
    expect(harness.text()).toContain('project indexed at');
    expect(harness.createButton().disabled).toBe(false);
  });

  it('says when a folder of that name is already in use', async () => {
    const harness = openModal({
      notes: [sourceNote('Projects/Game/Project.md', 'type: project')],
    });

    harness.type('Game');
    await harness.settle();

    expect(harness.text()).toContain('Projects/Game 2/Project.md');
    expect(harness.text()).toContain('a numbered folder is suggested');
  });

  it('reports an unusable title instead of inventing a folder name', async () => {
    const harness = openModal();

    harness.type('///');
    await harness.settle();

    expect(harness.text()).toContain('allocation.title.unusable');
    expect(harness.createButton().disabled).toBe(true);
  });

  it('offers a folder chooser only when more than one root is indexed', async () => {
    const single = openModal({ roots: ['Projects'] });
    expect(single.content.querySelector('select')).toBeNull();

    const several = openModal({ roots: ['Projects', 'Work/Projects'] });
    const chooser = several.content.querySelector<HTMLSelectElement>('select');
    expect(chooser).not.toBeNull();

    chooser!.value = 'Work/Projects';
    chooser!.dispatchEvent(new Event('change'));
    several.type('Travel Planner');
    await several.settle();

    expect(several.text()).toContain('Work/Projects/Travel Planner/Project.md');
  });

  it('commits the previewed proposal only when asked', async () => {
    const harness = openModal();

    harness.type('Travel Planner');
    await harness.settle();
    expect(harness.committed).toHaveLength(0);

    harness.createButton().click();
    await harness.settle();

    expect(harness.committed).toHaveLength(1);
  });
});
