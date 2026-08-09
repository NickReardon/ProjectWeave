import { describe, expect, it } from 'vitest';

import { ProjectWeaveQueryApi } from '../../src/application/query-api';
import {
  READ_ONLY_AGENT_OPERATIONS,
  ReadOnlyAgentGateway,
  type AgentGrant,
} from '../../src/application/read-only-agent-gateway';
import { IndexBuilder } from '../../src/indexing/index-builder';
import { sourceNote } from '../helpers/source-note';

const GRANT: AgentGrant = {
  id: 'game-agent',
  label: 'Game repository',
  vaultId: 'vault-1',
  projectPath: 'Projects/Game/Project.md',
  contentRoots: ['Projects/Game/Documents'],
  secretDigest: 'digest:correct',
  enabled: true,
};

describe('ReadOnlyAgentGateway', () => {
  it('exposes only the read-only Slice A operation inventory', () => {
    expect(READ_ONLY_AGENT_OPERATIONS).toEqual([
      'projects_list',
      'project_context',
      'search',
      'read_note',
      'related_work',
      'focus',
      'sequence',
      'action_context',
      'creation_context',
      'diagnostics',
    ]);
    expect(
      READ_ONLY_AGENT_OPERATIONS.some((name) => name.includes('commit')),
    ).toBe(false);
  });

  it('rejects every request while disabled and invalid credentials while enabled', async () => {
    let enabled = false;
    const gateway = createGateway(() => enabled);
    const disabled = await gateway.handle(request('project_context'));
    expect(disabled.ok ? '' : disabled.error.code).toBe('gateway.disabled');

    enabled = true;
    const invalid = await gateway.handle({
      ...request('project_context'),
      secret: 'wrong',
    });
    expect(invalid.ok ? '' : invalid.error.code).toBe(
      'gateway.authentication_failed',
    );
  });

  it('overwrites caller project scope with the authenticated one-project grant', async () => {
    const gateway = createGateway(() => true);
    const response = await gateway.handle({
      ...request('search'),
      input: {
        projectPath: 'Projects/Other/Project.md',
        contentRoots: ['Projects/Other'],
        query: '',
      },
    });
    expect(response.ok).toBe(true);
    if (!response.ok) throw new Error('Expected gateway response');
    const result = response.result as {
      readonly project_ref: { readonly path: string };
      readonly items: readonly { readonly path: string }[];
    };
    expect(result.project_ref.path).toBe('Projects/Game/Project.md');
    expect(result.items.map((item) => item.path)).toContain(
      'Projects/Game/Tasks/Game.md',
    );
    expect(result.items.map((item) => item.path)).not.toContain(
      'Projects/Other/Tasks/Other.md',
    );
  });

  it('lists only the granted project even when another project is indexed', async () => {
    const response = await createGateway(() => true).handle(
      request('projects_list'),
    );
    expect(response.ok).toBe(true);
    if (!response.ok) throw new Error('Expected gateway response');
    const result = response.result as {
      readonly items: readonly { readonly ref: { readonly path: string } }[];
    };
    expect(result.items.map((item) => item.ref.path)).toEqual([
      'Projects/Game/Project.md',
    ]);
  });

  it('cannot widen document roots into another project through request input', async () => {
    const response = await createGateway(() => true).handle({
      ...request('read_note'),
      input: {
        path: 'Projects/Other/Project.md',
        contentRoots: ['Projects/Other'],
      },
    });
    expect(response.ok).toBe(true);
    if (!response.ok) throw new Error('Expected gateway response');
    const result = response.result as {
      readonly ok: boolean;
      readonly diagnostics?: readonly { readonly code: string }[];
    };
    expect(result.ok).toBe(false);
    expect(result.diagnostics?.[0]?.code).toBe('query.read.out_of_scope');
  });
});

function createGateway(enabled: () => boolean): ReadOnlyAgentGateway {
  const snapshot = new IndexBuilder().build(
    [
      sourceNote('Projects/Game/Project.md', 'type: project'),
      sourceNote('Projects/Other/Project.md', 'type: project'),
      sourceNote(
        'Projects/Game/Tasks/Game.md',
        'type: task\nproject: "[[Projects/Game/Project]]"\nstatus: todo',
      ),
      sourceNote(
        'Projects/Other/Tasks/Other.md',
        'type: task\nproject: "[[Projects/Other/Project]]"\nstatus: todo',
      ),
    ],
    { revision: 7 },
  );
  return new ReadOnlyAgentGateway({
    enabled,
    vaultId: () => 'vault-1',
    grants: () => [GRANT],
    queryApi: () => new ProjectWeaveQueryApi(() => snapshot),
    digestSecret: async (secret) => `digest:${secret}`,
  });
}

function request(operation: (typeof READ_ONLY_AGENT_OPERATIONS)[number]): {
  readonly requestId: string;
  readonly grantId: string;
  readonly secret: string;
  readonly operation: typeof operation;
} {
  return {
    requestId: 'request-1',
    grantId: GRANT.id,
    secret: 'correct',
    operation,
  };
}
