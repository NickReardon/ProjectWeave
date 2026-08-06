import { describe, expect, it } from 'vitest';

import {
  mergeTemplateCatalog,
  templateCatalogKey,
  variantsForKind,
  type TemplateCatalogCandidate,
} from '../../src/application/template-catalog';
import { VaultTemplateLibrary } from '../../src/application/vault-template-library';
import type { SourceNote } from '../../src/domain/model';
import { CompositeVaultReader } from '../../src/ports/composite-vault-reader';
import type { VaultReader } from '../../src/ports/vault-reader';
import { sourceNote } from '../helpers/source-note';

/**
 * The vault rung of ADR 0013's catalog. Discovery is a path listing, so these
 * cover which paths count, which names are usable, and what happens when two
 * files claim one key — none of which needs a template to be readable.
 */

const LIBRARY = 'Templates/Project Weave';

class MemoryVault implements VaultReader {
  readonly #notes: ReadonlyMap<string, SourceNote>;

  public constructor(notes: readonly SourceNote[]) {
    this.#notes = new Map(notes.map((note) => [note.path, note]));
  }

  public async listMarkdownNotes(): Promise<readonly SourceNote[]> {
    return [...this.#notes.values()];
  }

  public async listMarkdownPaths(): Promise<readonly string[]> {
    return [...this.#notes.keys()];
  }

  public async readMarkdownNote(path: string): Promise<SourceNote | null> {
    return this.#notes.get(path) ?? null;
  }
}

function template(path: string, kind = 'task'): SourceNote {
  return sourceNote(
    path,
    `weave_template: true\ntemplate_schema: 1\ntemplate_for: ${kind}`,
  );
}

function library(notes: readonly SourceNote[], folder = LIBRARY) {
  return new VaultTemplateLibrary(new MemoryVault(notes), folder);
}

describe('VaultTemplateLibrary', () => {
  it('finds one template per kind folder and variant file', async () => {
    const listing = await library([
      template(`${LIBRARY}/task/default.md`),
      template(`${LIBRARY}/task/bug.md`),
      template(`${LIBRARY}/project/default.md`, 'project'),
    ]).list();

    expect(listing.entries).toEqual([
      {
        kind: 'project',
        variant: 'default',
        path: `${LIBRARY}/project/default.md`,
      },
      { kind: 'task', variant: 'bug', path: `${LIBRARY}/task/bug.md` },
      { kind: 'task', variant: 'default', path: `${LIBRARY}/task/default.md` },
    ]);
    expect(listing.diagnostics).toEqual([]);
  });

  it('ignores anything that is not an exact kind-folder child', async () => {
    const listing = await library([
      template(`${LIBRARY}/task/archive/old.md`),
      template(`${LIBRARY}/loose.md`),
      template('Projects/Game/Tasks/Implement request.md'),
      sourceNote(`${LIBRARY}/task/default.md`, 'weave_template: true'),
    ]).list();

    expect(listing.entries.map((entry) => entry.path)).toEqual([
      `${LIBRARY}/task/default.md`,
    ]);
    expect(listing.diagnostics).toEqual([]);
  });

  it('matches the folder and stem case-insensitively', async () => {
    const listing = await library([
      template('Templates/Project Weave/Task/Default.md'),
    ]).list();

    expect(listing.entries).toEqual([
      {
        kind: 'task',
        variant: 'default',
        path: 'Templates/Project Weave/Task/Default.md',
      },
    ]);
  });

  it('reports a name it cannot turn into a key, and keeps the rest', async () => {
    const listing = await library([
      template(`${LIBRARY}/task/default.md`),
      template(`${LIBRARY}/task/Bug Report.md`),
      template(`${LIBRARY}/Design Notes/default.md`),
    ]).list();

    expect(listing.entries.map((entry) => entry.path)).toEqual([
      `${LIBRARY}/task/default.md`,
    ]);
    expect(listing.diagnostics.map((issue) => issue.code).sort()).toEqual([
      'template.library.kind_invalid',
      'template.library.variant_invalid',
    ]);
  });

  it('makes only the colliding key ambiguous', async () => {
    const listing = await library([
      template(`${LIBRARY}/task/bug.md`),
      template(`${LIBRARY}/task/Bug.md`),
      template(`${LIBRARY}/task/default.md`),
    ]).list();

    expect(listing.entries.map((entry) => entry.variant)).toEqual(['default']);
    expect(listing.ambiguous.map((entry) => entry.variant)).toEqual(['bug']);
    const ambiguous = listing.diagnostics[0];
    expect(ambiguous?.code).toBe('template.library.ambiguous');
    expect(ambiguous?.relatedPaths).toEqual([
      `${LIBRARY}/task/Bug.md`,
      `${LIBRARY}/task/bug.md`,
    ]);
  });

  it('contributes nothing when the folder is unset or absent', async () => {
    const disabled = library([template(`${LIBRARY}/task/default.md`)], '  ');
    expect(disabled.enabled).toBe(false);
    expect(await disabled.list()).toEqual({
      entries: [],
      ambiguous: [],
      diagnostics: [],
    });
    expect(await disabled.load('task', 'default')).toBeNull();

    // A configured folder nobody created is a library with nothing in it.
    const missing = library([]);
    expect(missing.enabled).toBe(true);
    expect((await missing.list()).entries).toEqual([]);
    expect((await missing.list()).diagnostics).toEqual([]);
  });

  it('loads a template with the fingerprint a commit will re-check', async () => {
    const note = template(`${LIBRARY}/task/bug.md`);
    const loaded = await library([note]).load('Task', 'BUG');

    expect(loaded?.template.path).toBe(note.path);
    expect(loaded?.template.content).toBe(note.content);
    expect(loaded?.fingerprint).toBe(note.fingerprint);
    expect(await library([]).load('task', 'bug')).toBeNull();
  });
});

describe('mergeTemplateCatalog', () => {
  function candidate(
    kind: string,
    variant: string,
    source: TemplateCatalogCandidate['source'],
    broken = false,
  ): TemplateCatalogCandidate {
    return {
      kind,
      variant,
      source,
      reference: `${source}:${kind}/${variant}`,
      path: `${source}/${kind}/${variant}.md`,
      ...(broken ? { broken: true } : {}),
    };
  }

  it('resolves precedence per key rather than per kind', () => {
    const entries = mergeTemplateCatalog([
      candidate('task', 'default', 'plugin'),
      candidate('task', 'default', 'vault'),
      candidate('task', 'bug', 'vault'),
      candidate('task', 'bug', 'project'),
      candidate('project', 'default', 'plugin'),
    ]);

    const selected = Object.fromEntries(
      entries.map((entry) => [
        templateCatalogKey(entry.kind, entry.variant),
        entry.selected.source,
      ]),
    );
    // The project overrides one task variant without displacing the vault's
    // other one, and the plugin still supplies the kind nobody configured.
    expect(selected).toEqual({
      'project/default': 'plugin',
      'task/bug': 'project',
      'task/default': 'vault',
    });
  });

  it('leaves a key unusable when its winner is broken, rather than falling through', () => {
    const entries = mergeTemplateCatalog([
      candidate('task', 'default', 'plugin'),
      candidate('task', 'default', 'vault', true),
      candidate('task', 'bug', 'vault'),
    ]);

    const byKey = new Map(entries.map((entry) => [entry.variant, entry]));
    expect(byKey.get('default')?.usable).toBe(false);
    expect(byKey.get('default')?.selected.source).toBe('vault');
    // The plugin candidate is still visible, just not silently substituted.
    expect(byKey.get('default')?.candidates.map((one) => one.source)).toEqual([
      'vault',
      'plugin',
    ]);
    expect(byKey.get('bug')?.usable).toBe(true);
  });

  it('lists a kind default first, then its variants alphabetically', () => {
    const entries = mergeTemplateCatalog([
      candidate('task', 'test', 'vault'),
      candidate('task', 'bug', 'vault'),
      candidate('task', 'default', 'plugin'),
      candidate('project', 'default', 'plugin'),
    ]);

    expect(
      variantsForKind(entries, 'Task').map((entry) => entry.variant),
    ).toEqual(['default', 'bug', 'test']);
  });
});

describe('CompositeVaultReader', () => {
  it('reads through to whichever scoped reader holds the note', async () => {
    const projects = new MemoryVault([
      sourceNote('Projects/Game/Project.md', 'type: project'),
    ]);
    const templates = new MemoryVault([template(`${LIBRARY}/task/bug.md`)]);
    const reader = new CompositeVaultReader([projects, templates]);

    expect(
      (await reader.readMarkdownNote('Projects/Game/Project.md'))?.path,
    ).toBe('Projects/Game/Project.md');
    expect(
      (await reader.readMarkdownNote(`${LIBRARY}/task/bug.md`))?.path,
    ).toBe(`${LIBRARY}/task/bug.md`);
    expect(await reader.readMarkdownNote('Elsewhere/Note.md')).toBeNull();

    expect(await reader.listMarkdownPaths()).toEqual([
      'Projects/Game/Project.md',
      `${LIBRARY}/task/bug.md`,
    ]);
  });

  it('prefers the first reader when both hold a path', async () => {
    const first = new MemoryVault([sourceNote('Shared.md', 'type: project')]);
    const second = new MemoryVault([sourceNote('Shared.md', 'type: task')]);
    const reader = new CompositeVaultReader([first, second]);

    expect((await reader.readMarkdownNote('Shared.md'))?.content).toContain(
      'type: project',
    );
    expect(await reader.listMarkdownPaths()).toEqual(['Shared.md']);
    expect(await reader.listMarkdownNotes()).toHaveLength(1);
  });
});
