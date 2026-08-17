// @vitest-environment happy-dom

import { beforeAll, describe, expect, it, vi } from 'vitest';

import type ProjectWeavePlugin from '../../src/main';
import { ProjectWeaveSettingTab } from '../../src/ui/settings-tab';
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
