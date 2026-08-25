// @vitest-environment happy-dom

import { beforeAll, describe, expect, it, vi } from 'vitest';

import type { ProjectSummary } from '../../src/application/query-api';
import type ProjectWeavePlugin from '../../src/main';
import { ProjectWeaveSettingTab } from '../../src/ui/settings-tab';
import {
  lastListSegment,
  matchingProjects,
  replaceLastListSegment,
} from '../../src/ui/vault-suggest';
import { installObsidianDom } from '../helpers/obsidian-dom';
import { createStubApp } from '../helpers/obsidian-stub';

const openedContexts: { endpoint: string | null }[] = [];
vi.mock('../../src/ui/agent-grant-creation-modal', () => ({
  AgentGrantCreationModal: class {
    constructor(_app: unknown, context: { endpoint: string | null }) {
      openedContexts.push(context);
    }
    open(): void {}
  },
}));

beforeAll(() => installObsidianDom());

describe('ProjectWeaveSettingTab', () => {
  it('shows disabled gateway state and existing one-project grants without exposing secrets', () => {
    const app = createStubApp();
    const plugin = {
      settings: {
        settingsVersion: 2,
        projectRoots: ['Projects'],
        templateScaffoldFolder: 'Templates/Project Weave',
        diagnosticsLogFolder: '',
        taskCategories: [],
        agentGatewayEnabled: false,
        agentVaultId: 'vault-1',
        agentGrants: [
          {
            id: 'game-agent',
            label: 'Game repository',
            vaultId: 'vault-1',
            projectPath: 'Projects/Game/Project.md',
            contentRoots: ['Projects/Game/Documents'],
            secretDigest: 'a'.repeat(64),
            enabled: true,
          },
        ],
      },
      agentGatewayEndpoint: null,
      openProjectWorkbench: vi.fn(),
      updateProjectRoots: vi.fn(),
      updateTemplateScaffoldFolder: vi.fn(),
      updateTaskCategories: vi.fn(),
      updateDiagnosticsLogFolder: vi.fn(),
      rebuildIndex: vi.fn(),
      updateAgentGatewayEnabled: vi.fn(),
      createAgentGrant: vi.fn(),
      removeAgentGrant: vi.fn(),
    } as unknown as ProjectWeavePlugin;
    const tab = new ProjectWeaveSettingTab(app as never, plugin);

    tab.display();

    expect(tab.containerEl.textContent).toContain('Agent access');
    expect(tab.containerEl.textContent).toContain(
      'Disabled. No named pipe or socket is listening.',
    );
    expect(tab.containerEl.textContent).toContain('Game repository');
    expect(tab.containerEl.textContent).toContain('Projects/Game/Project.md');
    expect(tab.containerEl.textContent).toContain(
      'Note text in Projects/Game/Documents',
    );
    expect(tab.containerEl.textContent).not.toContain('a'.repeat(64));
    const gatewayToggle = [...tab.containerEl.querySelectorAll('input')].find(
      (input) => input.type === 'checkbox',
    );
    expect(gatewayToggle?.checked).toBe(false);

    // The multi-field row is gone; only a single "Create grant" button opens
    // the dialog (see [[Tasks/Move agent grant creation into a dialog]]).
    expect(tab.containerEl.textContent).toContain('Agent grants');
    const createGrantButton = [
      ...tab.containerEl.querySelectorAll('button'),
    ].find((button) => button.textContent === 'Create grant');
    expect(createGrantButton).not.toBeUndefined();

    // "Gone" asserted rather than assumed: the retired design collected a
    // label, a project, and content roots in this very row, so the row that
    // opens the dialog must carry no value-collecting control at all.
    const createGrantRow = createGrantButton?.closest('.setting-item');
    expect(createGrantRow).not.toBeNull();
    expect(
      createGrantRow?.querySelectorAll('input, select, textarea'),
    ).toHaveLength(0);

    // The stylesheet's narrow-width handling for the list keys off this class.
    // It guards the hook only; whether the row actually stacks is a visual
    // check in Obsidian.
    const grantRow = [
      ...tab.containerEl.querySelectorAll<HTMLElement>('.setting-item'),
    ].find((row) => row.textContent?.includes('game-agent'));
    expect(grantRow?.classList.contains('project-weave-agent-grant-item')).toBe(
      true,
    );

    // Revoke names the grant it acts on rather than a generic tooltip.
    const revokeButton = [...tab.containerEl.querySelectorAll('button')].find(
      (button) => button.title.includes('Game repository'),
    );
    expect(revokeButton?.title).toBe('Revoke "Game repository"');
  });

  it('describes a metadata-only grant without a content-root list', () => {
    const app = createStubApp();
    const plugin = {
      settings: {
        settingsVersion: 2,
        projectRoots: ['Projects'],
        templateScaffoldFolder: 'Templates/Project Weave',
        diagnosticsLogFolder: '',
        taskCategories: [],
        agentGatewayEnabled: false,
        agentVaultId: 'vault-1',
        agentGrants: [
          {
            id: 'meta-only',
            label: 'Read-only bot',
            vaultId: 'vault-1',
            projectPath: 'Projects/Game/Project.md',
            contentRoots: [],
            secretDigest: 'b'.repeat(64),
            enabled: true,
          },
        ],
      },
      agentGatewayEndpoint: null,
      openProjectWorkbench: vi.fn(),
      updateProjectRoots: vi.fn(),
      updateTemplateScaffoldFolder: vi.fn(),
      updateTaskCategories: vi.fn(),
      updateDiagnosticsLogFolder: vi.fn(),
      rebuildIndex: vi.fn(),
      updateAgentGatewayEnabled: vi.fn(),
      createAgentGrant: vi.fn(),
      removeAgentGrant: vi.fn(),
    } as unknown as ProjectWeavePlugin;
    const tab = new ProjectWeaveSettingTab(app as never, plugin);

    tab.display();

    expect(tab.containerEl.textContent).toContain('Entity metadata only');
  });

  it('hands the dialog the derived endpoint, not the idle bridge', () => {
    // The gateway is off, so `agentGatewayEndpoint` is null — that is the
    // state a user is in when they create their first grant. Reading the
    // bridge here would copy a blank PROJECT_WEAVE_ENDPOINT into a
    // configuration delivered exactly once, and the companion refuses to
    // start on a blank one, so the only repair would be revoking the grant.
    const derived = String.raw`\\.\pipe\project-weave-vault-1`;
    openedContexts.length = 0;
    const app = createStubApp();
    const plugin = {
      settings: {
        settingsVersion: 2,
        projectRoots: ['Projects'],
        templateScaffoldFolder: 'Templates/Project Weave',
        diagnosticsLogFolder: '',
        taskCategories: [],
        agentGatewayEnabled: false,
        agentVaultId: 'vault-1',
        agentGrants: [],
      },
      agentGatewayEndpoint: null,
      agentClientEndpoint: derived,
      openProjectWorkbench: vi.fn(),
      updateProjectRoots: vi.fn(),
      updateTemplateScaffoldFolder: vi.fn(),
      updateTaskCategories: vi.fn(),
      updateDiagnosticsLogFolder: vi.fn(),
      rebuildIndex: vi.fn(),
      updateAgentGatewayEnabled: vi.fn(),
      createAgentGrant: vi.fn(),
      removeAgentGrant: vi.fn(),
    } as unknown as ProjectWeavePlugin;
    const tab = new ProjectWeaveSettingTab(app as never, plugin);

    tab.display();
    const createButton = [...tab.containerEl.querySelectorAll('button')].find(
      (button) => button.textContent === 'Create grant',
    );
    createButton?.click();

    expect(openedContexts).toHaveLength(1);
    expect(openedContexts[0]?.endpoint).toBe(derived);
  });
});

function project(path: string, title: string): ProjectSummary {
  return {
    ref: { kind: 'project', path, fingerprint: 'fingerprint' },
    title,
    status: 'active',
  };
}

describe('matchingProjects', () => {
  const projects = [
    project('Projects/Game/Project.md', 'Game'),
    project('Projects/Tools/Project.md', 'Tools'),
  ];

  it('returns every indexed project for an empty query', () => {
    expect(matchingProjects(projects, '')).toHaveLength(2);
  });

  it('matches on title or path, case-insensitively', () => {
    expect(matchingProjects(projects, 'game')).toEqual([projects[0]]);
    expect(matchingProjects(projects, 'TOOLS/PROJECT')).toEqual([projects[1]]);
  });

  it('sorts matches by title', () => {
    const result = matchingProjects(projects, '');
    expect(result.map((entry) => entry.title)).toEqual(['Game', 'Tools']);
  });
});

describe('lastListSegment', () => {
  it('returns the whole value when there is no comma', () => {
    expect(lastListSegment('Projects/Game/Documents')).toBe(
      'Projects/Game/Documents',
    );
  });

  it('returns the text after the last comma', () => {
    expect(lastListSegment('Projects/Game/Documents, Proj')).toBe(' Proj');
  });
});

describe('replaceLastListSegment', () => {
  it('replaces a single segment', () => {
    expect(replaceLastListSegment('Proj', 'Projects/Game/Documents')).toBe(
      'Projects/Game/Documents',
    );
  });

  it('preserves already-entered segments when completing a later one', () => {
    expect(
      replaceLastListSegment(
        'Projects/Game/Documents, Ass',
        'Projects/Game/Assets',
      ),
    ).toBe('Projects/Game/Documents, Projects/Game/Assets');
  });

  it('trims whitespace consistently with how the grant dialog parses roots', () => {
    expect(
      replaceLastListSegment(
        '  Projects/Game/Documents ,  ',
        'Projects/Game/Assets',
      ),
    ).toBe('Projects/Game/Documents, Projects/Game/Assets');
  });
});
