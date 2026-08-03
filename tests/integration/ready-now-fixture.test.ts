import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { ProjectWeaveQueryApi } from '../../src/application/query-api';
import { IndexBuilder } from '../../src/indexing/index-builder';
import type { SourceNote } from '../../src/domain/model';

const fixtureRoot = fileURLToPath(
  new URL('../fixtures/vault/', import.meta.url),
);

describe('Ready Now fixture walking slice', () => {
  it('returns only ready todo work and leaves every fixture byte unchanged', async () => {
    const before = await loadFixture();
    const snapshot = new IndexBuilder().build(before, { revision: 1 });
    const api = new ProjectWeaveQueryApi(() => snapshot);

    const result = await api.getReadyNow({
      projectPath: 'Projects/Game/Project.md',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected a Ready Now result');
    }
    expect(result.items.map((item) => item.ref.path)).toEqual([
      'Projects/Game/Tasks/Implement request.md',
    ]);
    expect(snapshot.getEntity('Templates/Task.md')).toBeUndefined();

    const after = await loadFixture();
    expect(
      after.map((note) => [note.path, note.content, note.fingerprint]),
    ).toEqual(
      before.map((note) => [note.path, note.content, note.fingerprint]),
    );
  });
});

async function loadFixture(): Promise<readonly SourceNote[]> {
  const paths = await walk(fixtureRoot);
  return Promise.all(
    paths
      .filter((path) => extname(path).toLowerCase() === '.md')
      .sort()
      .map(async (absolutePath) => {
        const content = await readFile(absolutePath, 'utf8');
        const vaultPath = relative(fixtureRoot, absolutePath).replaceAll(
          '\\',
          '/',
        );
        return {
          path: vaultPath,
          content,
          fingerprint: 'fixture:' + String(content.length) + ':' + vaultPath,
        };
      }),
  );
}

async function walk(directory: string): Promise<readonly string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? walk(path) : Promise.resolve([path]);
    }),
  );
  return nested.flat();
}
