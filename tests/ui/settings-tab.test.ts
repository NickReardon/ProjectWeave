// @vitest-environment happy-dom

import { beforeAll, describe, expect, it, vi } from 'vitest';

import type { ProjectSummary } from '../../src/application/query-api';
import type ProjectWeavePlugin from '../../src/main';
import {
  lastListSegment,
  matchingProjects,
  ProjectWeaveSettingTab,
  replaceLastListSegment,
} from '../../src/ui/settings-tab';
import { installObsidianDom } from '../helpers/obsidian-dom';
import { createStubApp } from '../helpers/obsidian-stub';

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
    expect(tab.containerEl.textContent).not.toContain('a'.repeat(64));
    const gatewayToggle = [...tab.containerEl.querySelectorAll('input')].find(
      (input) => input.type === 'checkbox',
    );
    expect(gatewayToggle?.checked).toBe(false);

    const grantForm = tab.containerEl.querySelector(
      '.project-weave-agent-grant-setting',
    );
    expect(grantForm).not.toBeNull();
    expect(grantForm?.querySelectorAll('input')).toHaveLength(3);
    expect(grantForm?.querySelector('button')?.textContent).toBe(
      'Create and copy secret',
    );
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
    expect(matchingProjects(projects, 'TOOLS/PROJECT')).toEqual([
      projects[1],
    ]);
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

  it('trims whitespace consistently with how #createAgentGrant parses roots', () => {
    expect(
      replaceLastListSegment(
        '  Projects/Game/Documents ,  ',
        'Projects/Game/Assets',
      ),
    ).toBe('Projects/Game/Documents, Projects/Game/Assets');
  });
});
