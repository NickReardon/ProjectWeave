import { describe, expect, it } from 'vitest';

import { TaskTemplateResolver } from '../../src/application/task-template-resolver';
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
): TaskTemplateResolver {
  const vault = new MemoryVault(notes);
  return new TaskTemplateResolver(
    libraryFolder === null
      ? null
      : new VaultTemplateLibrary(vault, libraryFolder),
  );
}

describe('TaskTemplateResolver', () => {
  it('uses the packaged minimal task template when no library entry exists', async () => {
    const result = await resolver([]).resolve(project());

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
    const result = await resolver([]).resolve(project(), 'bug');

    expect(result.ok).toBe(false);
    expect(result.selected).toBeNull();
    expect(result.diagnostics.map((issue) => issue.code)).toEqual([
      'template.variant.not_found',
    ]);
  });

  it('allows an explicit packaged-minimal choice', async () => {
    const result = await resolver([]).resolve(
      project(),
      PACKAGED_MINIMAL_TEMPLATE_ID,
    );

    expect(result.ok).toBe(true);
    expect(result.selected?.source).toBe('packaged');
  });

  it('rejects invalid requested keys', async () => {
    const invalidVariant = await resolver([]).resolve(project(), 'Bug Task');

    expect(invalidVariant.diagnostics.map((issue) => issue.code)).toEqual([
      'template.variant.invalid',
    ]);
  });

  it('ignores deferred project-specific template metadata', async () => {
    const result = await resolver([]).resolve(
      project(
        ['weave:', '  templates:', '    task:', '      bug: "[[Bug]]"'].join(
          '\n',
        ),
      ),
    );

    expect(result.ok).toBe(true);
    expect(result.availableVariants).toEqual(['default']);
    expect(result.diagnostics).toEqual([]);
    expect(result.selected?.source).toBe('packaged');
  });
});

const LIBRARY = 'Templates/Project Weave';

describe('TaskTemplateResolver with a vault template library', () => {
  it('uses a vault template when the project maps nothing', async () => {
    const note = template(`${LIBRARY}/task/default.md`);
    const result = await resolver([note], LIBRARY).resolve(project());

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
    const result = await resolver([], LIBRARY).resolve(project());

    expect(result.selected?.source).toBe('packaged');
  });

  it('refuses a vault template declared for another kind rather than falling back', async () => {
    const wrongKind = template(`${LIBRARY}/task/bug.md`, 'epic');
    const result = await resolver([wrongKind], LIBRARY).resolve(
      project(),
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
    ).resolve(project(), 'bug');

    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((issue) => issue.code)).toContain(
      'template.variant.not_found',
    );
  });

  it('lists every configured variant, default first', async () => {
    const notes = [
      template(`${LIBRARY}/task/test.md`),
      template(`${LIBRARY}/task/bug.md`),
      template(`${LIBRARY}/project/default.md`, 'project'),
    ];

    const variants = await resolver(notes, LIBRARY).listVariants();

    // Another kind's folder is not a task template.
    expect(variants).toEqual(['default', 'bug', 'test']);
  });

  it('offers only the default when no library is configured', async () => {
    expect(await resolver([]).listVariants()).toEqual(['default']);
  });
});
