import { describe, expect, it } from 'vitest';

import {
  AGENT_MCP_COMPANION_PATH_PLACEHOLDER,
  AGENT_MCP_SERVER_KEY,
  agentClientConfigurationJson,
  describeAgentGrantScope,
  parseContentRoots,
  resolveAgentGrantForm,
} from '../../src/ui/agent-grant-form';

const isIndexedProject = (path: string): boolean =>
  path === 'Projects/Game/Project.md';
const folderExists = (path: string): boolean =>
  path === 'Projects/Game/Documents';

/** A valid name, so tests targeting a different field aren't blocked by this one. */
const VALID_LABEL = 'Claude Desktop';

describe('resolveAgentGrantForm', () => {
  it('requires a name before anything else', () => {
    const result = resolveAgentGrantForm(
      {
        label: '',
        projectPath: 'Projects/Game/Project.md',
        scope: 'metadata',
        contentRootsRaw: '',
      },
      isIndexedProject,
      folderExists,
    );
    expect(result.ready).toBe(false);
    expect(result.problem).toBe('Name which tool this grant is for.');
    expect(result.contentRoots).toEqual([]);
  });

  it('treats a whitespace-only name as unresolved, the same as an empty one', () => {
    const result = resolveAgentGrantForm(
      {
        label: '   ',
        projectPath: 'Projects/Game/Project.md',
        scope: 'metadata',
        contentRootsRaw: '',
      },
      isIndexedProject,
      folderExists,
    );
    expect(result.ready).toBe(false);
    expect(result.problem).toBe('Name which tool this grant is for.');
  });

  it('requires a project once a name is given', () => {
    const result = resolveAgentGrantForm(
      {
        label: VALID_LABEL,
        projectPath: '',
        scope: 'metadata',
        contentRootsRaw: '',
      },
      isIndexedProject,
      folderExists,
    );
    expect(result.ready).toBe(false);
    expect(result.problem).toBe('Choose a project.');
    expect(result.contentRoots).toEqual([]);
  });

  it('names the project as the problem when it is not indexed', () => {
    const result = resolveAgentGrantForm(
      {
        label: VALID_LABEL,
        projectPath: 'Projects/Ghost/Project.md',
        scope: 'metadata',
        contentRootsRaw: '',
      },
      isIndexedProject,
      folderExists,
    );
    expect(result.ready).toBe(false);
    expect(result.problem).toContain('Projects/Ghost/Project.md');
    expect(result.problem).toContain('not an indexed project');
  });

  it('resolves metadata-only once a name and the project are given, carrying no content roots', () => {
    const result = resolveAgentGrantForm(
      {
        label: VALID_LABEL,
        projectPath: 'Projects/Game/Project.md',
        scope: 'metadata',
        // Even a populated field is ignored for metadata-only: the scope
        // choice — not the emptiness of this field — decides readability.
        contentRootsRaw: 'Projects/Game/Documents',
      },
      isIndexedProject,
      folderExists,
    );
    expect(result.ready).toBe(true);
    expect(result.contentRoots).toEqual([]);
    expect(result.problem).toBeNull();
  });

  it('does not resolve content-readable scope with an empty folder list', () => {
    const result = resolveAgentGrantForm(
      {
        label: VALID_LABEL,
        projectPath: 'Projects/Game/Project.md',
        scope: 'content',
        contentRootsRaw: '   ',
      },
      isIndexedProject,
      folderExists,
    );
    expect(result.ready).toBe(false);
    expect(result.contentRoots).toEqual([]);
    expect(result.problem).toContain('at least one content folder');
  });

  it('resolves content-readable scope once every folder exists', () => {
    const result = resolveAgentGrantForm(
      {
        label: VALID_LABEL,
        projectPath: 'Projects/Game/Project.md',
        scope: 'content',
        contentRootsRaw: 'Projects/Game/Documents',
      },
      isIndexedProject,
      folderExists,
    );
    expect(result.ready).toBe(true);
    expect(result.contentRoots).toEqual(['Projects/Game/Documents']);
    expect(result.problem).toBeNull();
  });

  it('names the missing folder distinctly from a project problem', () => {
    const result = resolveAgentGrantForm(
      {
        label: VALID_LABEL,
        projectPath: 'Projects/Game/Project.md',
        scope: 'content',
        contentRootsRaw: 'Projects/Game/Documents, Projects/Game/Ghost',
      },
      isIndexedProject,
      folderExists,
    );
    expect(result.ready).toBe(false);
    expect(result.problem).toContain('Projects/Game/Ghost');
    expect(result.problem).toContain('not an existing vault folder');
  });
});

describe('parseContentRoots', () => {
  it('trims and drops empty comma-separated segments', () => {
    expect(
      parseContentRoots('  Projects/Game/Documents ,, Projects/Game/Art '),
    ).toEqual(['Projects/Game/Documents', 'Projects/Game/Art']);
  });
});

describe('describeAgentGrantScope', () => {
  it('describes an empty content-root list as metadata only', () => {
    expect(describeAgentGrantScope([])).toBe('Entity metadata only');
  });

  it('lists content roots when the grant can read note text', () => {
    expect(
      describeAgentGrantScope([
        'Projects/Game/Documents',
        'Projects/Game/Design',
      ]),
    ).toBe('Note text in Projects/Game/Documents, Projects/Game/Design');
  });
});

interface ParsedAgentClientConfiguration {
  readonly mcpServers: {
    readonly [server: string]: {
      readonly command: string;
      readonly args: readonly string[];
      readonly env: {
        readonly PROJECT_WEAVE_ENDPOINT: string;
        readonly PROJECT_WEAVE_GRANT_ID: string;
        readonly PROJECT_WEAVE_GRANT_SECRET: string;
      };
    };
  };
}

function parseAgentClientConfiguration(
  json: string,
): ParsedAgentClientConfiguration {
  return JSON.parse(json) as ParsedAgentClientConfiguration;
}

describe('agentClientConfigurationJson', () => {
  it('parses as JSON and assembles a complete, ready-to-paste mcpServers entry', () => {
    const json = agentClientConfigurationJson({
      endpoint: '\\\\.\\pipe\\project-weave-vault-1',
      grantId: 'grant-1',
      secret: 'secret-value',
    });

    expect(parseAgentClientConfiguration(json)).toEqual({
      mcpServers: {
        [AGENT_MCP_SERVER_KEY]: {
          command: 'node',
          args: [AGENT_MCP_COMPANION_PATH_PLACEHOLDER],
          env: {
            PROJECT_WEAVE_ENDPOINT: '\\\\.\\pipe\\project-weave-vault-1',
            PROJECT_WEAVE_GRANT_ID: 'grant-1',
            PROJECT_WEAVE_GRANT_SECRET: 'secret-value',
          },
        },
      },
    });
  });

  it('carries an unmistakable placeholder for the one value it cannot know', () => {
    const json = agentClientConfigurationJson({
      endpoint: '\\\\.\\pipe\\project-weave-vault-1',
      grantId: 'grant-1',
      secret: 'secret-value',
    });

    const { args } =
      parseAgentClientConfiguration(json).mcpServers[AGENT_MCP_SERVER_KEY]!;
    expect(args).toEqual(['<path to project-weave-mcp.cjs>']);
    // Angle brackets make it unmistakable in the copied text itself, not
    // only in the README that explains it.
    expect(args[0]).toMatch(/^<.*>$/);
  });

  it('carries the three environment values a working entry needs', () => {
    const json = agentClientConfigurationJson({
      endpoint: '\\\\.\\pipe\\project-weave-vault-1',
      grantId: 'grant-1',
      secret: 'secret-value',
    });

    const { env } =
      parseAgentClientConfiguration(json).mcpServers[AGENT_MCP_SERVER_KEY]!;
    expect(env).toEqual({
      PROJECT_WEAVE_ENDPOINT: '\\\\.\\pipe\\project-weave-vault-1',
      PROJECT_WEAVE_GRANT_ID: 'grant-1',
      PROJECT_WEAVE_GRANT_SECRET: 'secret-value',
    });
  });

  it('emits an empty endpoint rather than omitting it when the gateway is disabled', () => {
    const json = agentClientConfigurationJson({
      endpoint: null,
      grantId: 'grant-1',
      secret: 'secret-value',
    });

    const { env } =
      parseAgentClientConfiguration(json).mcpServers[AGENT_MCP_SERVER_KEY]!;
    expect(env).toEqual({
      PROJECT_WEAVE_ENDPOINT: '',
      PROJECT_WEAVE_GRANT_ID: 'grant-1',
      PROJECT_WEAVE_GRANT_SECRET: 'secret-value',
    });
  });
});
