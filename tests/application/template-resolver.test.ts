import { describe, expect, it } from 'vitest';

import { TemplateResolver } from '../../src/application/template-resolver';
import { VaultTemplateLibrary } from '../../src/application/vault-template-library';
import { parseMarkdownEntity } from '../../src/domain/markdown-parser';
import type { ProjectEntity, SourceNote } from '../../src/domain/model';
import { PACKAGED_MINIMAL_TEMPLATE_ID } from '../../src/domain/templates/packaged-templates';
import type { VaultReader } from '../../src/ports/vault-reader';
import { sourceNote } from '../helpers/source-note';

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

function project(weave = ''): ProjectEntity {
  const parsed = parseMarkdownEntity(
    sourceNote(
      'Projects/Game/Project.md',
      ['type: project', 'title: Fixture Game', weave]
        .filter(Boolean)
        .join('\n'),
    ),
  );
  if (parsed.entity?.kind !== 'project') {
    throw new Error('Expected project fixture to parse');
  }
  return parsed.entity;
}

function template(
  path: string,
  templateFor = 'task',
  fingerprint = `fingerprint:${path}`,
): SourceNote {
  const content = [
    '---',
    'weave_template: true',
    'template_schema: 1',
    `template_for: ${templateFor}`,
    'type: task',
    'title: "{{title}}"',
    'project: "{{project_link}}"',
    'status: "{{status}}"',
    '---',
    '# {{title}}',
    '',
  ].join('\n');
  return { path, content, fingerprint };
}

function resolver(
  notes: readonly SourceNote[],
  libraryFolder: string | null = null,
): TemplateResolver {
  const vault = new MemoryVault(notes);
  return new TemplateResolver(
    libraryFolder === null
      ? null
      : new VaultTemplateLibrary(vault, libraryFolder),
  );
}

const LIBRARY = 'Templates/Project Weave';

describe('TemplateResolver resolving task templates', () => {
  it('uses the packaged minimal task template when no library entry exists', async () => {
    const result = await resolver([]).resolve('task', project().path);

    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.availableVariants).toEqual(['default']);
    expect(result.selected).toMatchObject({
      source: 'packaged',
      variant: 'default',
      reference: PACKAGED_MINIMAL_TEMPLATE_ID,
    });
  });

  it('does not silently fall back for a missing named variant', async () => {
    const result = await resolver([]).resolve('task', project().path, 'bug');

    expect(result.ok).toBe(false);
    expect(result.selected).toBeNull();
    expect(result.diagnostics.map((issue) => issue.code)).toEqual([
      'template.variant.not_found',
    ]);
  });

  it('allows an explicit packaged-minimal choice', async () => {
    const result = await resolver([]).resolve(
      'task',
      project().path,
      PACKAGED_MINIMAL_TEMPLATE_ID,
    );

    expect(result.ok).toBe(true);
    expect(result.selected?.source).toBe('packaged');
  });

  it('rejects invalid requested keys', async () => {
    const invalidVariant = await resolver([]).resolve(
      'task',
      project().path,
      'Bug Task',
    );

    expect(invalidVariant.diagnostics.map((issue) => issue.code)).toEqual([
      'template.variant.invalid',
    ]);
  });

  it('ignores deferred project-specific template metadata', async () => {
    const result = await resolver([]).resolve(
      'task',
      project(
        ['weave:', '  templates:', '    task:', '      bug: "[[Bug]]"'].join(
          '\n',
        ),
      ).path,
    );

    expect(result.ok).toBe(true);
    expect(result.availableVariants).toEqual(['default']);
    expect(result.diagnostics).toEqual([]);
    expect(result.selected?.source).toBe('packaged');
  });
});

describe('TemplateResolver resolving task templates with a vault library', () => {
  it('uses a vault template when the project maps nothing', async () => {
    const note = template(`${LIBRARY}/task/default.md`);
    const result = await resolver([note], LIBRARY).resolve(
      'task',
      project().path,
    );

    expect(result.ok).toBe(true);
    expect(result.selected).toEqual({
      source: 'vault',
      variant: 'default',
      reference: note.path,
      fingerprint: note.fingerprint,
      template: { path: note.path, content: note.content },
    });
  });

  it('reaches the packaged template only when no rung supplies the default', async () => {
    const result = await resolver([], LIBRARY).resolve('task', project().path);

    expect(result.selected?.source).toBe('packaged');
  });

  it('refuses a vault template declared for another kind rather than falling back', async () => {
    const wrongKind = template(`${LIBRARY}/task/bug.md`, 'epic');
    const result = await resolver([wrongKind], LIBRARY).resolve(
      'task',
      project().path,
      'bug',
    );

    expect(result.ok).toBe(false);
    expect(result.selected).toBeNull();
    expect(result.diagnostics.map((issue) => issue.code)).toContain(
      'template.kind_mismatch',
    );
  });

  it('reports a variant that exists at no rung instead of inventing one', async () => {
    const result = await resolver(
      [template(`${LIBRARY}/task/default.md`)],
      LIBRARY,
    ).resolve('task', project().path, 'bug');

    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((issue) => issue.code)).toContain(
      'template.variant.not_found',
    );
  });

  it('lists every configured variant, default first, all usable', async () => {
    const notes = [
      template(`${LIBRARY}/task/test.md`),
      template(`${LIBRARY}/task/bug.md`),
      template(`${LIBRARY}/project/default.md`, 'project'),
    ];

    const variants = await resolver(notes, LIBRARY).listVariants('task');

    // Another kind's folder is not a task template.
    expect(variants).toEqual([
      { variant: 'default', usable: true, source: 'plugin' },
      { variant: 'bug', usable: true, source: 'vault' },
      { variant: 'test', usable: true, source: 'vault' },
    ]);
  });

  it('offers only the default when no library is configured', async () => {
    expect(await resolver([]).listVariants('task')).toEqual([
      { variant: 'default', usable: true, source: 'plugin' },
    ]);
  });

  it('marks a case-colliding default unusable instead of omitting it', async () => {
    const notes = [
      template(`${LIBRARY}/task/default.md`),
      template(`${LIBRARY}/Task/Default.md`),
    ];

    const variants = await resolver(notes, LIBRARY).listVariants('task');

    // The escape hatch depends on this: a chooser that only ever saw
    // `entries` (never `ambiguous`) would see a single-item list here and
    // conclude, wrongly, that nothing needs a way around it.
    expect(variants).toEqual([
      { variant: 'default', usable: false, source: 'vault' },
    ]);

    const resolution = await resolver(notes, LIBRARY).resolve(
      'task',
      project().path,
    );
    expect(resolution.ok).toBe(false);
  });

  it('marks a case-colliding named variant unusable rather than dropping it', async () => {
    const notes = [
      template(`${LIBRARY}/task/default.md`),
      template(`${LIBRARY}/task/custom.md`),
      template(`${LIBRARY}/Task/Custom.md`),
    ];

    const variants = await resolver(notes, LIBRARY).listVariants('task');

    expect(variants).toEqual([
      { variant: 'default', usable: true, source: 'vault' },
      { variant: 'custom', usable: false, source: 'vault' },
    ]);
  });

  /**
   * Two vault files claim `task/default` case-insensitively. Before this
   * resolver was generalized from `TaskTemplateResolver`, the task path read
   * the vault library through `VaultTemplateLibrary.load()` directly: an
   * ambiguous key is absent from `list().entries` (it is reported separately
   * in `.ambiguous`), so `load()` returned null and the `default` branch
   * quietly fell back to the packaged template with no diagnostic at all —
   * exactly the silent fall-through ADR 0013 forbids. The shared resolver now
   * routes every kind through the merged catalog, which carries an ambiguous
   * key as a broken candidate instead of an absent one, so it fails closed
   * here the same way project creation already did.
   */
  it('fails closed rather than silently using the packaged template when the default is ambiguous', async () => {
    const notes = [
      template(`${LIBRARY}/task/default.md`),
      template(`${LIBRARY}/Task/Default.md`),
    ];
    const result = await resolver(notes, LIBRARY).resolve(
      'task',
      project().path,
    );

    expect(result.ok).toBe(false);
    expect(result.selected).toBeNull();
    expect(result.diagnostics.map((issue) => issue.code)).toEqual([
      'template.library.ambiguous',
    ]);
  });
});

describe('TemplateResolver resolving project templates', () => {
  it('uses the packaged minimal project template when no library entry exists', async () => {
    const result = await resolver([]).resolve('project', 'Projects/New');

    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.selected).toMatchObject({
      source: 'packaged',
      variant: 'default',
      reference: PACKAGED_MINIMAL_TEMPLATE_ID,
      fingerprint: 'builtin:minimal/project@schema-1',
    });
  });

  it('uses a vault project template over the packaged one', async () => {
    const note = template(`${LIBRARY}/project/default.md`, 'project');
    const result = await resolver([note], LIBRARY).resolve(
      'project',
      'Projects/New',
    );

    expect(result.ok).toBe(true);
    expect(result.selected).toEqual({
      source: 'vault',
      variant: 'default',
      reference: note.path,
      fingerprint: note.fingerprint,
      template: { path: note.path, content: note.content },
    });
  });

  /**
   * Two vault files claim `project/default` case-insensitively. Project
   * creation already failed closed on this before the shared resolver
   * existed: `ProjectCreationProposalService` built its own candidate list
   * and merged it by hand (`mergeTemplateCatalog`/`variantsForKind`), the same
   * ladder this resolver now implements once for every kind. The rung that
   * was actually missing belonged to task creation, which read the vault
   * library through `VaultTemplateLibrary.load()` directly: an ambiguous key
   * is absent from `list().entries` (it is reported separately in
   * `.ambiguous`), so `load()` returned null and the `default` branch quietly
   * fell back to the packaged template with no diagnostic at all — see the
   * `task/default` case above. Routing both kinds through the same merged
   * catalog proves this failure mode once, at the one place that resolves
   * every kind, instead of trusting each kind's own reimplementation to get
   * it right.
   */
  it('fails closed rather than falling back to the packaged template when the default is ambiguous', async () => {
    const notes = [
      template(`${LIBRARY}/project/default.md`, 'project'),
      template(`${LIBRARY}/Project/Default.md`, 'project'),
    ];
    const result = await resolver(notes, LIBRARY).resolve(
      'project',
      'Projects/New',
    );

    expect(result.ok).toBe(false);
    expect(result.selected).toBeNull();
    expect(result.diagnostics.map((issue) => issue.code)).toEqual([
      'template.library.ambiguous',
    ]);
  });

  it('refuses a vault template declared for another kind rather than falling back', async () => {
    const wrongKind = template(`${LIBRARY}/project/default.md`, 'task');
    const result = await resolver([wrongKind], LIBRARY).resolve(
      'project',
      'Projects/New',
    );

    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((issue) => issue.code)).toContain(
      'template.kind_mismatch',
    );
  });

  it('does not let an ambiguous task key poison project/default', async () => {
    const notes = [
      template(`${LIBRARY}/task/bug.md`),
      template(`${LIBRARY}/Task/Bug.md`),
    ];
    const result = await resolver(notes, LIBRARY).resolve(
      'project',
      'Projects/New',
    );

    expect(result.ok).toBe(true);
    expect(result.selected?.source).toBe('packaged');
    expect(result.diagnostics).toEqual([]);
  });
});
