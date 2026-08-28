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

  it('fails closed with same-tag guidance for an incompatible companion', async () => {
    const response = await createGateway(() => true).handle({
      ...request('project_context'),
      companionVersion: '0.6.0',
    });
    expect(response.ok).toBe(false);
    if (response.ok) throw new Error('Expected incompatible response');
    expect(response.error.code).toBe('gateway.companion_incompatible');
    expect(response.error.message).toContain('Project Weave 0.7.0-beta.1');
    expect(response.error.message).toContain('same release tag');
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

  /**
   * The request-time boundary, not the helper. A persisted grant is the one
   * input the gateway cannot re-validate on the way in: it was minted by an
   * earlier build, or edited in `data.json` by hand.
   * `Projects/Game/../Other` is the shape that defeats prefix matching, since
   * it starts with `Projects/Game/` while naming a sibling project, so the
   * filter must drop it rather than resolve it.
   */
  describe.each([
    ['upward traversal into a sibling', 'Projects/Game/../Other'],
    [
      'traversal behind a current-directory segment',
      'Projects/Game/./../Other',
    ],
  ])('a stored grant root using %s', (_label, contentRoot) => {
    const grant: AgentGrant = { ...GRANT, contentRoots: [contentRoot] };

    it('starts with the project root, so prefix matching alone would admit it', () => {
      expect(contentRoot.startsWith('Projects/Game/')).toBe(true);
    });

    it.each(['search', 'read_note'] as const)(
      'never forwards the root to %s',
      async (operation) => {
        expect(
          await forwardedContentRoots(grant, operation, {
            path: 'Projects/Other/Tasks/Other.md',
            query: '',
          }),
        ).toEqual([]);
      },
    );

    it('cannot read the sibling project through read_note', async () => {
      const response = await createGateway(() => true, grant).handle({
        ...request('read_note'),
        input: { path: 'Projects/Other/Tasks/Other.md' },
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

    it('cannot reach the sibling project through search', async () => {
      const response = await createGateway(() => true, grant).handle({
        ...request('search'),
        input: { query: '' },
      });

      expect(response.ok).toBe(true);
      if (!response.ok) throw new Error('Expected gateway response');
      const result = response.result as {
        readonly items: readonly { readonly path: string }[];
      };
      expect(result.items.map((item) => item.path)).not.toContain(
        'Projects/Other/Tasks/Other.md',
      );
    });
  });

  // The control for the assertions above: an empty forwarded list only means
  // something if a legitimate root does survive the same filter.
  it('still forwards a content root that is genuinely inside the project', async () => {
    expect(await forwardedContentRoots(GRANT, 'search', { query: '' })).toEqual(
      ['Projects/Game/Documents'],
    );
  });

  it('stops authorizing a grant as soon as it is revoked, without a restart', async () => {
    // A grant revoked on another device reaches this one as a rewritten
    // data.json, which the plugin adopts through onExternalSettingsChange.
    // Nothing restarts the gateway, so revocation only takes effect if the
    // grant list is read per request rather than captured at construction.
    // Without that, a withdrawn credential keeps working until Obsidian
    // restarts — which is the promise the settings surface makes when it
    // offers revoke on a platform that cannot create.
    // Rebound, not mutated in place: mutating the array a captured callback
    // already holds would pass either way, so it would not tell a per-request
    // read apart from one snapshot taken at construction.
    let live: readonly AgentGrant[] = [GRANT];
    const gateway = new ReadOnlyAgentGateway({
      enabled: () => true,
      vaultId: () => 'vault-1',
      grants: () => live,
      pluginVersion: () => '0.7.0-beta.1',
      queryApi: () => new ProjectWeaveQueryApi(() => buildSnapshot()),
      digestSecret: async (secret) => `digest:${secret}`,
    });

    expect((await gateway.handle(request('projects_list'))).ok).toBe(true);

    live = [];

    const afterRevoke = await gateway.handle(request('projects_list'));
    expect(afterRevoke.ok).toBe(false);
    if (afterRevoke.ok) throw new Error('Expected the revoked grant to fail');
    expect(afterRevoke.error.code).toBe('gateway.authentication_failed');
  });
});

function createGateway(
  enabled: () => boolean,
  grant: AgentGrant = GRANT,
  queryApi: () => ProjectWeaveQueryApi = () =>
    new ProjectWeaveQueryApi(() => buildSnapshot()),
): ReadOnlyAgentGateway {
  return new ReadOnlyAgentGateway({
    enabled,
    vaultId: () => 'vault-1',
    grants: () => [grant],
    pluginVersion: () => '0.7.0-beta.1',
    queryApi,
    digestSecret: async (secret) => `digest:${secret}`,
  });
}

function buildSnapshot(): ReturnType<IndexBuilder['build']> {
  return new IndexBuilder().build(
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
}

/**
 * The content roots the gateway actually forwards for one operation.
 *
 * This is the observable that pins the containment guard. Asserting only that
 * a sibling note stays unreadable passes either way: a traversal root that
 * survives the filter still fails the downstream scope check, because
 * `Projects/Other/Tasks/Other.md` does not literally start with
 * `Projects/Game/../Other`. What must be true is narrower - the root never
 * leaves the boundary at all.
 */
async function forwardedContentRoots(
  grant: AgentGrant,
  operation: 'search' | 'read_note',
  input: Readonly<Record<string, unknown>>,
): Promise<readonly string[] | undefined> {
  let seen: readonly string[] | undefined;
  const real = new ProjectWeaveQueryApi(() => buildSnapshot());
  const recording = {
    search: async (value: { readonly contentRoots?: readonly string[] }) => {
      seen = value.contentRoots;
      return await real.search(value as Parameters<typeof real.search>[0]);
    },
    readNote: async (value: { readonly contentRoots?: readonly string[] }) => {
      seen = value.contentRoots;
      return await real.readNote(value as Parameters<typeof real.readNote>[0]);
    },
  } as unknown as ProjectWeaveQueryApi;

  const response = await createGateway(
    () => true,
    grant,
    () => recording,
  ).handle({ ...request(operation), input });
  if (!response.ok) throw new Error('Expected gateway response');
  return seen;
}

function request(operation: (typeof READ_ONLY_AGENT_OPERATIONS)[number]): {
  readonly requestId: string;
  readonly companionVersion: string;
  readonly grantId: string;
  readonly secret: string;
  readonly operation: typeof operation;
} {
  return {
    requestId: 'request-1',
    companionVersion: '0.7.0-beta.1',
    grantId: GRANT.id,
    secret: 'correct',
    operation,
  };
}
