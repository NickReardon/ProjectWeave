import { describe, expect, it } from 'vitest';

import {
  isWithinContentRoot,
  mintAgentGrant,
  projectContentRoot,
  type MintAgentGrantDependencies,
} from '../../src/application/agent-grants';

const PROJECT_PATH = 'Projects/Game/Project.md';

function fakeDependencies(
  identifiers: readonly string[] = ['id-1', 'secret-a', 'secret-b'],
): MintAgentGrantDependencies & { readonly digested: string[] } {
  const queue = [...identifiers];
  const digested: string[] = [];
  return {
    nextIdentifier: () => {
      const next = queue.shift();
      if (next === undefined) {
        throw new Error('fakeDependencies: ran out of identifiers');
      }
      return next;
    },
    digestSecret: async (secret) => {
      digested.push(secret);
      return `digest:${secret}`;
    },
    digested,
  };
}

describe('mintAgentGrant', () => {
  it('mints a grant from injected identifiers and a digested secret', async () => {
    const dependencies = fakeDependencies();
    const { grant, secret } = await mintAgentGrant(
      {
        label: 'Game repository',
        fallbackLabel: 'Game',
        vaultId: 'vault-1',
        projectPath: PROJECT_PATH,
        contentRoots: ['Projects/Game/Documents'],
      },
      dependencies,
    );

    expect(secret).toBe('secret-a.secret-b');
    expect(grant).toEqual({
      id: 'id-1',
      label: 'Game repository',
      vaultId: 'vault-1',
      projectPath: PROJECT_PATH,
      contentRoots: ['Projects/Game/Documents'],
      secretDigest: 'digest:secret-a.secret-b',
      enabled: true,
    });
    // The digester saw the plaintext secret and nothing else was digested.
    expect(dependencies.digested).toEqual(['secret-a.secret-b']);
  });

  it('never persists the plaintext secret, only its digest', async () => {
    const { grant, secret } = await mintAgentGrant(
      {
        label: 'Game repository',
        fallbackLabel: 'Game',
        vaultId: 'vault-1',
        projectPath: PROJECT_PATH,
        contentRoots: [],
      },
      fakeDependencies(),
    );

    expect(grant.secretDigest).not.toBe(secret);
    expect(Object.keys(grant)).not.toContain('secret');
    expect(Object.values(grant)).not.toContain(secret);
  });

  it('falls back to the project title when the label is blank', async () => {
    const { grant } = await mintAgentGrant(
      {
        label: '   ',
        fallbackLabel: 'Game',
        vaultId: 'vault-1',
        projectPath: PROJECT_PATH,
        contentRoots: [],
      },
      fakeDependencies(),
    );

    expect(grant.label).toBe('Game');
  });

  it('trims a non-blank label rather than falling back', async () => {
    const { grant } = await mintAgentGrant(
      {
        label: '  Custom label  ',
        fallbackLabel: 'Game',
        vaultId: 'vault-1',
        projectPath: PROJECT_PATH,
        contentRoots: [],
      },
      fakeDependencies(),
    );

    expect(grant.label).toBe('Custom label');
  });

  it('accepts a content root equal to the project root itself', async () => {
    const { grant } = await mintAgentGrant(
      {
        label: 'Game repository',
        fallbackLabel: 'Game',
        vaultId: 'vault-1',
        projectPath: PROJECT_PATH,
        contentRoots: ['Projects/Game'],
      },
      fakeDependencies(),
    );

    expect(grant.contentRoots).toEqual(['Projects/Game']);
  });

  it.each([
    ['upward traversal out of the project', '../Projects/Game'],
    ['traversal escaping from inside the project', 'Projects/Game/../Other'],
    [
      'traversal disguised behind a current-directory segment',
      'Projects/Game/./../../Secret',
    ],
    ['an absolute path', '/Projects/Game'],
    ['a Windows-drive absolute path', 'C:/Projects/Game'],
    ['a sibling folder sharing the project name as a prefix', 'Projects/Game2'],
    ['a case-differing spelling of the project root', 'projects/game'],
    ['an unrelated project entirely', 'Projects/Other'],
  ])('rejects a grant content root using %s', async (_label, contentRoot) => {
    await expect(
      mintAgentGrant(
        {
          label: 'Game repository',
          fallbackLabel: 'Game',
          vaultId: 'vault-1',
          projectPath: PROJECT_PATH,
          contentRoots: [contentRoot],
        },
        fakeDependencies(),
      ),
    ).rejects.toThrow(
      'Grant content folders must stay inside the selected project.',
    );
  });

  it('rejects when only one of several content roots escapes the project', async () => {
    await expect(
      mintAgentGrant(
        {
          label: 'Game repository',
          fallbackLabel: 'Game',
          vaultId: 'vault-1',
          projectPath: PROJECT_PATH,
          contentRoots: ['Projects/Game/Documents', '../Projects/Other'],
        },
        fakeDependencies(),
      ),
    ).rejects.toThrow(
      'Grant content folders must stay inside the selected project.',
    );
  });
});

describe('projectContentRoot', () => {
  it('drops the trailing /Project.md for the ADR-0012 project note convention', () => {
    expect(projectContentRoot('Projects/Game/Project.md')).toBe(
      'Projects/Game',
    );
  });

  it('matches the /Project.md suffix case-insensitively', () => {
    expect(projectContentRoot('Projects/Game/PROJECT.MD')).toBe(
      'Projects/Game',
    );
  });

  it('otherwise just drops the .md extension', () => {
    expect(projectContentRoot('Projects/Game.md')).toBe('Projects/Game');
  });

  it('normalizes backslashes before deriving the root', () => {
    expect(projectContentRoot('Projects\\Game\\Project.md')).toBe(
      'Projects/Game',
    );
  });
});

describe('isWithinContentRoot', () => {
  it('accepts the root itself', () => {
    expect(isWithinContentRoot('Projects/Game', 'Projects/Game')).toBe(true);
  });

  it('accepts a path nested under the root', () => {
    expect(
      isWithinContentRoot('Projects/Game/Documents', 'Projects/Game'),
    ).toBe(true);
  });

  it('rejects a sibling whose name shares the root as a text prefix', () => {
    // Without the separator check, `startsWith` alone would let
    // "Projects/Game2" through as if it were nested under "Projects/Game".
    expect(isWithinContentRoot('Projects/Game2', 'Projects/Game')).toBe(false);
  });

  it('rejects a case-differing path', () => {
    expect(isWithinContentRoot('projects/game', 'Projects/Game')).toBe(false);
  });

  it('rejects an unrelated path', () => {
    expect(isWithinContentRoot('Projects/Other', 'Projects/Game')).toBe(false);
  });

  // Prefix matching cannot see through traversal: these escape the project
  // yet still start with the root plus a separator, so they must be refused
  // on the segment rather than on the prefix.
  it.each([
    ['Projects/Game/../Other'],
    ['Projects/Game/./../../Secret'],
    ['Projects/Game/Documents/..'],
  ])('rejects %s, which escapes the root it appears to be under', (path) => {
    expect(path.startsWith('Projects/Game/')).toBe(true);
    expect(isWithinContentRoot(path, 'Projects/Game')).toBe(false);
  });

  it('refuses a root that itself contains a traversal segment', () => {
    expect(
      isWithinContentRoot('Projects/Game/Documents', 'Projects/Game/..'),
    ).toBe(false);
  });
});
