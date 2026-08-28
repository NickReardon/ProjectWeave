// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { ProjectSummary } from '../../src/application/query-api';
import type { AgentGrant } from '../../src/application/read-only-agent-gateway';
import { AgentGrantCreationModal } from '../../src/ui/agent-grant-creation-modal';
import { installObsidianDom } from '../helpers/obsidian-dom';
import {
  clearNotices,
  createStubApp,
  recordedNotices,
} from '../helpers/obsidian-stub';

beforeAll(() => installObsidianDom());
beforeEach(() => clearNotices());

/**
 * The endpoint the plugin derives from the vault id. It is the same value
 * whether or not the gateway is listening, which is what lets a grant created
 * while the gateway is off still carry a configuration a client can launch.
 */
const DERIVED_ENDPOINT = String.raw`\\.\pipe\project-weave-vault-1`;

function project(path: string, title: string): ProjectSummary {
  return {
    ref: { kind: 'project', path, fingerprint: 'fingerprint' },
    title,
    status: 'active',
  };
}

const GAME_PROJECT = project('Projects/Game/Project.md', 'Game');

/** Lets the modal's async project-list load and in-flight creates settle. */
async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

interface Harness {
  readonly content: HTMLElement;
  readonly createdInputs: {
    readonly label: string;
    readonly projectPath: string;
    readonly contentRoots: readonly string[];
  }[];
  readonly removedIds: string[];
  readonly copied: string[];
  readonly createdCount: () => number;
  labelField(): HTMLInputElement;
  projectField(): HTMLInputElement;
  scopeField(): HTMLSelectElement;
  contentRootsField(): HTMLInputElement | null;
  createButton(): HTMLButtonElement;
  type(field: HTMLInputElement, value: string): void;
  select(field: HTMLSelectElement, value: string): void;
}

function openModal(
  options: {
    readonly folderPaths?: readonly string[];
    readonly writeTextImpl?: (text: string) => Promise<void>;
    readonly removeGrantImpl?: (id: string) => Promise<void>;
    readonly endpoint?: string | null;
    readonly grant?: AgentGrant;
  } = {},
): Harness {
  const app = createStubApp(
    [],
    options.folderPaths ?? ['Projects/Game/Documents'],
  );

  const grant: AgentGrant = options.grant ?? {
    id: 'grant-1',
    label: 'Claude Desktop',
    vaultId: 'vault-1',
    projectPath: 'Projects/Game/Project.md',
    contentRoots: [],
    secretDigest: 'digest',
    enabled: true,
  };

  const createdInputs: Harness['createdInputs'] = [];
  const removedIds: string[] = [];
  const copied: string[] = [];
  let createdCount = 0;

  Object.defineProperty(globalThis.navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: async (text: string) => {
        if (options.writeTextImpl) {
          await options.writeTextImpl(text);
        }
        copied.push(text);
      },
    },
  });

  const modal = new AgentGrantCreationModal(app as never, {
    listIndexedProjects: async () => [GAME_PROJECT],
    // `??` would fold an explicitly disabled gateway back into the enabled
    // default, which is the state a test needs to be able to ask for.
    endpoint:
      'endpoint' in options ? (options.endpoint ?? null) : DERIVED_ENDPOINT,
    createGrant: async (input) => {
      createdInputs.push(input);
      createdCount += 1;
      return { grant, secret: 'secret-value' };
    },
    removeGrant: async (id) => {
      removedIds.push(id);
      if (options.removeGrantImpl) {
        await options.removeGrantImpl(id);
      }
    },
    onCreated: () => undefined,
  });

  modal.open();
  const content = modal.contentEl;

  return {
    content,
    createdInputs,
    removedIds,
    copied,
    createdCount: () => createdCount,
    labelField() {
      const field = content.querySelector<HTMLInputElement>(
        'input[placeholder="Claude Desktop"]',
      );
      if (field === null) {
        throw new Error('The modal has no label field.');
      }
      return field;
    },
    projectField() {
      const field = content.querySelector<HTMLInputElement>(
        'input[placeholder="Projects/Game/Project.md"]',
      );
      if (field === null) {
        throw new Error('The modal has no project field.');
      }
      return field;
    },
    scopeField() {
      const field = content.querySelector<HTMLSelectElement>('select');
      if (field === null) {
        throw new Error('The modal has no scope field.');
      }
      return field;
    },
    contentRootsField() {
      return content.querySelector<HTMLInputElement>(
        'input[placeholder="Projects/Game/Documents"]',
      );
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
    type(field, value) {
      field.value = value;
      field.dispatchEvent(new Event('input'));
    },
    select(field, value) {
      field.value = value;
      field.dispatchEvent(new Event('change'));
    },
  };
}

describe('AgentGrantCreationModal', () => {
  it('labels every field with a description distinguishing required from optional', () => {
    const harness = openModal();
    const text = harness.content.textContent ?? '';

    expect(text).toContain('Which tool is this for');
    expect(text).toContain(
      'Required: only you know which tool this is for, so there is no default.',
    );
    expect(text).toContain('Project');
    expect(text).toContain(
      'The one indexed project this grant may read. Required.',
    );
    expect(text).toContain('What this grant can read');
    expect(text).toContain('Metadata only');
    expect(text).toContain('Metadata and note text');
  });

  it('gives every field its own row with a single control, rather than hanging inputs off one setting', () => {
    const harness = openModal();
    harness.select(harness.scopeField(), 'content');

    const fieldRows = [
      ...harness.content.querySelectorAll<HTMLElement>('.setting-item'),
    ].filter((row) => row.querySelectorAll('input, select').length > 0);

    // Four fields, four rows. The retired design hung three inputs off one
    // `Setting`, which is the shape this asserts is gone: a row carrying more
    // than one control means its single label is again explaining several
    // values at once.
    expect(fieldRows).toHaveLength(4);
    for (const row of fieldRows) {
      expect(row.querySelectorAll('input, select')).toHaveLength(1);
    }
    expect(fieldRows.map((row) => row.textContent ?? '')).toEqual([
      expect.stringContaining('Which tool is this for'),
      expect.stringContaining('Project'),
      expect.stringContaining('What this grant can read'),
      expect.stringContaining('Content folders'),
    ]);
  });

  it('states the permission consequence beside the scope choice, not only in the option names', () => {
    const harness = openModal();

    const scopeRow = harness.scopeField().closest('.setting-item');
    if (scopeRow === null) {
      throw new Error('The scope field is not inside a setting row.');
    }
    // The option labels alone say which level is chosen but not what choosing
    // it exposes, so this asserts the explanation that sits with the choice.
    const scopeText = scopeRow.textContent ?? '';
    expect(scopeText).toContain(
      'Metadata only reads titles, statuses, structure, and links.',
    );
    expect(scopeText).toContain('additionally exposes Markdown bodies');
    expect(scopeText).toContain('this is the actual permission boundary');
  });

  it('carries the class the stylesheet keys its narrow-width handling off', () => {
    const harness = openModal();

    // This guards the hook, not the layout: whether the fields actually stack
    // is a visual check in Obsidian. The hook is what silently disappeared
    // when the inline row was retired, taking its responsive rule with it.
    expect(
      harness.content.classList.contains('project-weave-agent-grant-modal'),
    ).toBe(true);
  });

  it('reveals the content-folder field only once note text is chosen', () => {
    const harness = openModal();
    expect(harness.contentRootsField()).toBeNull();

    harness.select(harness.scopeField(), 'content');

    expect(harness.contentRootsField()).not.toBeNull();
  });

  it('keeps create unavailable and names the missing name first', async () => {
    const harness = openModal();
    await flush();

    const button = harness.createButton();
    expect(button.disabled).toBe(true);
    expect(button.title).toBe('Name which tool this grant is for.');
    expect(harness.content.textContent).toContain(
      'Name which tool this grant is for.',
    );
  });

  it('has no prefilled or defaulted name — a whitespace-only one stays unresolved', async () => {
    const harness = openModal();
    await flush();
    expect(harness.labelField().value).toBe('');

    harness.type(harness.labelField(), '   ');
    await flush();

    const button = harness.createButton();
    expect(button.disabled).toBe(true);
    expect(button.title).toBe('Name which tool this grant is for.');
  });

  it('names the unresolved project once a name is given', async () => {
    const harness = openModal();
    await flush();
    harness.type(harness.labelField(), 'Claude Desktop');
    await flush();

    const button = harness.createButton();
    expect(button.disabled).toBe(true);
    expect(button.title).toBe('Choose a project.');
    expect(harness.content.textContent).toContain('Choose a project.');
  });

  it('becomes available once a name and an indexed project are given, metadata-only by default', async () => {
    const harness = openModal();
    await flush();

    harness.type(harness.labelField(), 'Claude Desktop');
    harness.type(harness.projectField(), 'Projects/Game/Project.md');
    await flush();

    expect(harness.createButton().disabled).toBe(false);
  });

  it('does not resolve content-readable scope with an empty folder list', async () => {
    const harness = openModal();
    await flush();
    harness.type(harness.labelField(), 'Claude Desktop');
    harness.type(harness.projectField(), 'Projects/Game/Project.md');
    harness.select(harness.scopeField(), 'content');
    await flush();

    const button = harness.createButton();
    expect(button.disabled).toBe(true);
    expect(button.title).toContain('at least one content folder');
  });

  it('names a content folder that does not exist in the vault', async () => {
    const harness = openModal({ folderPaths: [] });
    await flush();
    harness.type(harness.labelField(), 'Claude Desktop');
    harness.type(harness.projectField(), 'Projects/Game/Project.md');
    harness.select(harness.scopeField(), 'content');
    const folderField = harness.contentRootsField();
    if (folderField === null) {
      throw new Error('Expected the content-folder field to be visible.');
    }
    harness.type(folderField, 'Projects/Game/Documents');
    await flush();

    const button = harness.createButton();
    expect(button.disabled).toBe(true);
    expect(button.title).toContain('Projects/Game/Documents');
    expect(button.title).toContain('not an existing vault folder');
  });

  it('resolves content-readable scope once the folder exists', async () => {
    const harness = openModal({ folderPaths: ['Projects/Game/Documents'] });
    await flush();
    harness.type(harness.labelField(), 'Claude Desktop');
    harness.type(harness.projectField(), 'Projects/Game/Project.md');
    harness.select(harness.scopeField(), 'content');
    const folderField = harness.contentRootsField();
    if (folderField === null) {
      throw new Error('Expected the content-folder field to be visible.');
    }
    harness.type(folderField, 'Projects/Game/Documents');
    await flush();

    expect(harness.createButton().disabled).toBe(false);
  });

  it('resolves and creates with the gateway disabled, still emitting a launchable endpoint', async () => {
    // Resolution is local to the vault and index, so switching the gateway
    // off must not change it — a grant is created before the gateway is
    // turned on, not after.
    //
    // The endpoint stays present while disabled because the plugin derives it
    // from the vault id rather than reading the running bridge. That is
    // load-bearing rather than cosmetic: the companion refuses to start on a
    // blank PROJECT_WEAVE_ENDPOINT, and the configuration is delivered once,
    // so a blank one here would cost the user the grant.
    const harness = openModal({
      endpoint: DERIVED_ENDPOINT,
      folderPaths: ['Projects/Game/Documents'],
    });
    await flush();
    harness.type(harness.labelField(), 'Claude Desktop');
    harness.type(harness.projectField(), 'Projects/Game/Project.md');
    harness.select(harness.scopeField(), 'content');
    const folderField = harness.contentRootsField();
    if (folderField === null) {
      throw new Error('Expected the content-folder field to be visible.');
    }
    harness.type(folderField, 'Projects/Game/Documents');
    await flush();

    expect(harness.createButton().disabled).toBe(false);

    harness.createButton().click();
    await flush();

    expect(harness.createdCount()).toBe(1);
    expect(harness.createdInputs[0]).toEqual({
      label: 'Claude Desktop',
      projectPath: 'Projects/Game/Project.md',
      contentRoots: ['Projects/Game/Documents'],
    });
    expect(harness.removedIds).toHaveLength(0);
    const copied = JSON.parse(harness.copied[0]!) as {
      mcpServers: Record<string, { env: Record<string, string> }>;
    };
    expect(copied.mcpServers['project-weave']?.env).toEqual({
      PROJECT_WEAVE_ENDPOINT: DERIVED_ENDPOINT,
      PROJECT_WEAVE_GRANT_ID: 'grant-1',
      PROJECT_WEAVE_GRANT_SECRET: 'secret-value',
    });
  });

  it('creates nothing when the dialog is dismissed without pressing create', async () => {
    const harness = openModal();
    await flush();
    harness.type(harness.labelField(), 'Claude Desktop');
    harness.type(harness.projectField(), 'Projects/Game/Project.md');
    await flush();

    // No click on create — simulate dismissal by closing directly.
    expect(harness.createdCount()).toBe(0);
  });

  it('creates the grant and copies the complete client configuration atomically', async () => {
    const harness = openModal();
    await flush();
    harness.type(harness.labelField(), 'Claude Desktop');
    harness.type(harness.projectField(), 'Projects/Game/Project.md');
    await flush();

    harness.createButton().click();
    await flush();

    expect(harness.createdCount()).toBe(1);
    expect(harness.createdInputs[0]).toEqual({
      label: 'Claude Desktop',
      projectPath: 'Projects/Game/Project.md',
      contentRoots: [],
    });
    expect(harness.copied).toHaveLength(1);
    expect(JSON.parse(harness.copied[0]!)).toEqual({
      mcpServers: {
        'project-weave': {
          command: 'node',
          args: ['<path to project-weave-mcp.cjs>'],
          env: {
            PROJECT_WEAVE_ENDPOINT: '\\\\.\\pipe\\project-weave-vault-1',
            PROJECT_WEAVE_GRANT_ID: 'grant-1',
            PROJECT_WEAVE_GRANT_SECRET: 'secret-value',
          },
        },
      },
    });
    expect(harness.removedIds).toHaveLength(0);
    expect(
      recordedNotices.some((notice) => notice.includes('grant id grant-1')),
    ).toBe(true);
  });

  it('rolls back the grant when the clipboard write fails', async () => {
    const harness = openModal({
      writeTextImpl: async () => {
        throw new Error('denied');
      },
    });
    await flush();
    harness.type(harness.labelField(), 'Claude Desktop');
    harness.type(harness.projectField(), 'Projects/Game/Project.md');
    await flush();

    harness.createButton().click();
    await flush();

    expect(harness.createdCount()).toBe(1);
    expect(harness.removedIds).toEqual(['grant-1']);
    expect(harness.content.textContent).toContain('was not kept');
    expect(recordedNotices.some((notice) => notice.includes('grant id'))).toBe(
      false,
    );
  });

  it('says the grant survived when the rollback save fails too', async () => {
    // The rollback is a save, and a save can fail — the plugin refuses one
    // outright once it has been unloaded. Reporting "the grant was not kept"
    // there would describe a grant that is still stored and still authorized,
    // with its secret never delivered, as gone.
    const harness = openModal({
      writeTextImpl: async () => {
        throw new Error('denied');
      },
      removeGrantImpl: async () => {
        throw new Error(
          'Project Weave was unloaded before the change could be saved.',
        );
      },
    });
    await flush();
    harness.type(harness.labelField(), 'Claude Desktop');
    harness.type(harness.projectField(), 'Projects/Game/Project.md');
    await flush();

    harness.createButton().click();
    await flush();

    expect(harness.removedIds).toEqual(['grant-1']);
    const status = harness.content.textContent ?? '';
    expect(status).toContain('grant-1');
    expect(status).toContain('revoke it in settings');
    expect(status).not.toContain('was not kept');
  });
});
