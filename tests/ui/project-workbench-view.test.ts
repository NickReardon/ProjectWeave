// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  ProjectWeaveReadSource,
  type ProjectWeaveReadRuntime,
} from '../../src/application/project-weave-read-source';
import type { SourceNote } from '../../src/domain/model';
import { IndexBuilder } from '../../src/indexing/index-builder';
import type { IndexSnapshot } from '../../src/indexing/index-snapshot';
import {
  ProjectWorkbenchView,
  type ProjectWorkbenchActions,
} from '../../src/ui/project-workbench-view';
import { installObsidianDom } from '../helpers/obsidian-dom';
import {
  clearNotices,
  createStubApp,
  createStubLeaf,
  type StubApp,
  type StubLeaf,
} from '../helpers/obsidian-stub';
import { sourceNote } from '../helpers/source-note';

/**
 * Rendering coverage for the workbench states ordinary use does not reach. The
 * model tests prove these states are computed; these prove they are drawn, and
 * drawn distinguishably. What Obsidian itself owns — tab reuse, workspace
 * restoration, live vault events, layout at width, mobile — is not reachable
 * here and remains a manual check.
 */

beforeAll(() => {
  installObsidianDom();
});

class FakeRuntime implements ProjectWeaveReadRuntime {
  #snapshot: IndexSnapshot;
  readonly #listeners = new Set<(snapshot: IndexSnapshot) => void>();

  public constructor(snapshot: IndexSnapshot) {
    this.#snapshot = snapshot;
  }

  public get snapshot(): IndexSnapshot {
    return this.#snapshot;
  }

  public subscribe(listener: (snapshot: IndexSnapshot) => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  public publish(snapshot: IndexSnapshot): void {
    this.#snapshot = snapshot;
    for (const listener of this.#listeners) {
      listener(snapshot);
    }
  }
}

function snapshotOf(notes: readonly SourceNote[]): IndexSnapshot {
  return new IndexBuilder().build(notes, { revision: 1 });
}

interface Harness {
  readonly view: ProjectWorkbenchView;
  readonly content: HTMLElement;
  readonly runtime: FakeRuntime;
  readonly app: StubApp;
  readonly text: () => string;
}

let createProjectCalls = 0;

async function openWorkbench(
  notes: readonly SourceNote[],
  options: {
    readonly selectedProjectPath?: string;
    readonly activeFilePath?: string;
    readonly now?: () => number;
  } = {},
): Promise<Harness> {
  const app = createStubApp(notes.map((note) => note.path));
  app.workspace.activeFilePath = options.activeFilePath ?? null;
  const leaf: StubLeaf = createStubLeaf(app);

  const runtime = new FakeRuntime(snapshotOf(notes));
  const source = new ProjectWeaveReadSource(undefined, options.now);
  source.bind(runtime);

  const actions: ProjectWorkbenchActions = {
    rebuildIndex: () => Promise.resolve(),
    createTask: () => undefined,
    createProject: () => {
      createProjectCalls += 1;
    },
  };

  // The view's real types come from Obsidian; the stub stands in for them.
  const view = new ProjectWorkbenchView(
    leaf as never,
    source,
    actions,
  ) as ProjectWorkbenchView & {
    onOpen(): Promise<void>;
    contentEl: HTMLElement;
  };

  if (options.selectedProjectPath !== undefined) {
    view.selectProject(options.selectedProjectPath);
  }
  await view.onOpen();

  const content = view.contentEl;
  return {
    view,
    content,
    runtime,
    app,
    text: () => content.textContent ?? '',
  };
}

function projectNote(path: string): SourceNote {
  return sourceNote(path, 'type: project');
}

function taskNote(
  path: string,
  projectPath: string,
  frontmatter = 'status: todo',
): SourceNote {
  return sourceNote(
    path,
    ['type: task', `project: '[[${projectPath}]]'`, frontmatter].join('\n'),
  );
}

beforeEach(() => {
  clearNotices();
});

describe('Project Workbench view rendering', () => {
  it('renders an empty-scope state rather than an error when nothing is indexed', async () => {
    const harness = await openWorkbench([]);

    expect(harness.text()).toContain('No projects');
    expect(
      harness.content.querySelector('.project-weave-workbench__empty'),
    ).not.toBeNull();
  });

  it('offers a way out of an empty vault rather than only advice', async () => {
    createProjectCalls = 0;
    const harness = await openWorkbench([]);

    const button = harness.content.querySelector<HTMLButtonElement>(
      '[data-workbench-focus-key="new-project"]',
    );
    expect(button).not.toBeNull();
    button!.click();
    expect(createProjectCalls).toBe(1);

    // Only the state a user can act on carries the button.
    const populated = await openWorkbench([projectNote('Projects/One.md')]);
    expect(
      populated.content.querySelector(
        '[data-workbench-focus-key="new-project"]',
      ),
    ).toBeNull();
  });

  it('keeps an unavailable selection visible instead of falling back to another project', async () => {
    const harness = await openWorkbench([projectNote('Projects/Only.md')], {
      selectedProjectPath: 'Projects/Missing.md',
    });

    expect(harness.text()).toContain('Selected project is unavailable');
    expect(harness.text()).toContain('Unavailable: Projects/Missing.md');

    // The placeholder deliberately carries an empty value: the change handler
    // ignores empty selections, so an unavailable project cannot be re-chosen,
    // and no available project is silently selected in its place.
    const select = harness.content.querySelector('select');
    expect(select).not.toBeNull();
    expect(select?.value).toBe('');

    const placeholder = harness.content.querySelector('option');
    expect(placeholder?.textContent).toBe('Unavailable: Projects/Missing.md');
    expect(placeholder?.hasAttribute('disabled')).toBe(true);
  });

  it('recovers once the previously unavailable project is indexed again', async () => {
    const missing = 'Projects/Later.md';
    const harness = await openWorkbench([projectNote('Projects/Only.md')], {
      selectedProjectPath: missing,
    });
    expect(harness.text()).toContain('Selected project is unavailable');

    harness.runtime.publish(
      snapshotOf([projectNote('Projects/Only.md'), projectNote(missing)]),
    );

    expect(harness.text()).not.toContain('Selected project is unavailable');
    expect(harness.text()).toContain('All Tasks');
  });

  it('distinguishes a project with no tasks from filters that match none', async () => {
    const project = 'Projects/Game/Project.md';
    const empty = await openWorkbench([projectNote(project)], {
      selectedProjectPath: project,
    });
    expect(empty.text()).toContain('No tasks in this project');
    expect(empty.text()).not.toContain('No tasks match these filters');

    const populated = await openWorkbench(
      [projectNote(project), taskNote('Projects/Game/Tasks/One.md', project)],
      { selectedProjectPath: project },
    );

    const search = populated.content.querySelector<HTMLInputElement>(
      'input[data-workbench-focus-key="task-filter-search"]',
    );
    expect(search).not.toBeNull();
    search!.value = 'nothing matches this';
    search!.dispatchEvent(new Event('input'));

    expect(populated.text()).toContain('No tasks match these filters');
    expect(populated.text()).not.toContain('No tasks in this project');
  });

  it('reports how long ago the index updated, keeping exact detail in the tooltip', async () => {
    const project = 'Projects/Game/Project.md';
    const publishedAt = Date.now() - 5 * 60 * 1000;

    const harness = await openWorkbench([projectNote(project)], {
      selectedProjectPath: project,
      now: () => publishedAt,
    });

    expect(harness.text()).toContain('updated 5 minutes ago');
    // The relative label ages in place between publications, so the tooltip
    // carries the absolute time and the revision behind it.
    const title = harness.content
      .querySelector('.project-weave-workbench__revision')
      ?.getAttribute('title');
    expect(title).toContain('index revision 1');
    expect(title).toMatch(/^Updated \d{2}:\d{2} · /u);
  });

  it('names each unit of age from seconds to days', async () => {
    const project = 'Projects/Game/Project.md';
    const at = async (millisecondsAgo: number) =>
      (
        await openWorkbench([projectNote(project)], {
          selectedProjectPath: project,
          now: () => Date.now() - millisecondsAgo,
        })
      ).text();

    expect(await at(0)).toContain('updated just now');
    expect(await at(30 * 1000)).toContain('updated 30 seconds ago');
    expect(await at(60 * 1000)).toContain('updated 1 minute ago');
    expect(await at(3 * 60 * 60 * 1000)).toContain('updated 3 hours ago');
    expect(await at(2 * 24 * 60 * 60 * 1000)).toContain('updated 2 days ago');
  });

  it('pages past the 200-result bound rather than stranding the tail', async () => {
    const project = 'Projects/Game/Project.md';
    const notes: SourceNote[] = [projectNote(project)];
    for (let index = 1; index <= 250; index += 1) {
      notes.push(
        taskNote(
          `Projects/Game/Tasks/Task ${String(index)}.md`,
          project,
          `status: todo\nrank: ${String(index * 1000)}`,
        ),
      );
    }

    const harness = await openWorkbench(notes, {
      selectedProjectPath: project,
    });

    // Each section opens on its first page and says where that page sits.
    expect(harness.text()).toContain('1–10 of 250 ready tasks');
    expect(harness.text()).toContain('1–25 of 250 matching tasks');
    expect(
      harness.content.querySelectorAll('.project-weave-workbench__ready-item')
        .length,
    ).toBe(10);

    const pageSize = harness.content.querySelector<HTMLSelectElement>(
      '[data-workbench-focus-key="all-tasks-page-size"]',
    );
    pageSize!.value = '200';
    pageSize!.dispatchEvent(new Event('change'));
    expect(harness.text()).toContain('1–200 of 250 matching tasks');

    // The 200 bound still holds per request; paging is how the rest is
    // reached, so the tail past 200 is no longer stranded.
    const next = () =>
      harness.content.querySelector<HTMLButtonElement>(
        '[data-workbench-focus-key="all-tasks-page-next"]',
      );
    next()!.click();
    expect(harness.text()).toContain('201–250 of 250 matching tasks');
    expect(harness.text()).toContain('Task 250');
    expect(next()!.disabled).toBe(true);

    const previous = harness.content.querySelector<HTMLButtonElement>(
      '[data-workbench-focus-key="all-tasks-page-previous"]',
    );
    previous!.click();
    expect(harness.text()).toContain('1–200 of 250 matching tasks');
  });

  it('jumps straight to a page instead of clicking Next to reach it', async () => {
    const project = 'Projects/Game/Project.md';
    const notes: SourceNote[] = [projectNote(project)];
    for (let index = 1; index <= 250; index += 1) {
      notes.push(
        taskNote(
          `Projects/Game/Tasks/Task ${String(index)}.md`,
          project,
          `status: todo\nrank: ${String(index * 1000)}`,
        ),
      );
    }

    const harness = await openWorkbench(notes, {
      selectedProjectPath: project,
    });

    const jump = () =>
      harness.content.querySelector<HTMLInputElement>(
        '[data-workbench-focus-key="all-tasks-page-jump"]',
      );
    // 250 tasks at 25 a page, and the field opens on the page being shown.
    expect(jump()!.value).toBe('1');
    expect(jump()!.getAttribute('max')).toBe('10');

    jump()!.value = '7';
    jump()!.dispatchEvent(new Event('change'));
    expect(harness.text()).toContain('151–175 of 250 matching tasks');
    expect(harness.text()).toContain('Task 151');
    expect(jump()!.value).toBe('7');

    // Past the end is clamped to the last page rather than refused.
    jump()!.value = '99';
    jump()!.dispatchEvent(new Event('change'));
    expect(harness.text()).toContain('226–250 of 250 matching tasks');
    expect(jump()!.value).toBe('10');
  });

  it('offers no page jump when everything fits on one page', async () => {
    const project = 'Projects/Game/Project.md';
    const harness = await openWorkbench(
      [projectNote(project), taskNote('Projects/Game/Tasks/One.md', project)],
      { selectedProjectPath: project },
    );

    expect(harness.text()).toContain('1–1 of 1 ready tasks');
    expect(
      harness.content.querySelector(
        '[data-workbench-focus-key="ready-page-jump"]',
      ),
    ).toBeNull();
    expect(
      harness.content.querySelector(
        '[data-workbench-focus-key="all-tasks-page-jump"]',
      ),
    ).toBeNull();
  });

  it('marks a stale last-good index as an alert without hiding its results', async () => {
    const project = 'Projects/Game/Project.md';
    const notes = [
      projectNote(project),
      taskNote('Projects/Game/Tasks/One.md', project),
    ];
    const harness = await openWorkbench(notes, {
      selectedProjectPath: project,
    });

    harness.runtime.publish(snapshotOf(notes).withFreshness('stale_last_good'));

    const banner = harness.content.querySelector(
      '.project-weave-workbench__banner',
    );
    expect(banner).not.toBeNull();
    expect(banner?.getAttribute('role')).toBe('alert');
    expect(harness.text()).toContain('out of date');
    // The stale banner reports freshness; it must not blank the results.
    expect(harness.text()).toContain('One');
  });
});
