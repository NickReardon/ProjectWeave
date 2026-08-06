import { describe, expect, it } from 'vitest';

import { TaskTemplateResolver } from '../../src/application/task-template-resolver';
import { VaultTemplateLibrary } from '../../src/application/vault-template-library';
import { parseMarkdownEntity } from '../../src/domain/markdown-parser';
import type { ProjectEntity, SourceNote } from '../../src/domain/model';
import { PACKAGED_MINIMAL_TEMPLATE_ID } from '../../src/domain/templates/packaged-templates';
import {
  PathLinkResolver,
  type VaultReader,
} from '../../src/ports/vault-reader';
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
    vault,
    new PathLinkResolver(notes.map((note) => note.path)),
    libraryFolder === null
      ? null
      : new VaultTemplateLibrary(vault, libraryFolder),
  );
}

function taskMap(entries: readonly string[]): string {
  return ['weave:', '  templates:', '    task:', ...entries].join('\n');
}

describe('TaskTemplateResolver', () => {
  it('uses the packaged minimal task template when no mapping exists', async () => {
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

  it('resolves the project default relative to the project note', async () => {
    const note = template('Projects/Game/Templates/Task.md');
    const result = await resolver([note]).resolve(
      project(taskMap(['      default: "[[Templates/Task]]"'])),
    );

    expect(result.ok).toBe(true);
    expect(result.selected).toEqual({
      source: 'project',
      variant: 'default',
      reference: '[[Templates/Task]]',
      fingerprint: note.fingerprint,
      template: { path: note.path, content: note.content },
    });
  });

  it('selects a named variant and reports deterministic availability', async () => {
    const standard = template('Templates/Task.md');
    const bug = template('Templates/Bug.md');
    const result = await resolver([standard, bug]).resolve(
      project(
        taskMap([
          '      research: "[[Templates/Task]]"',
          '      default: "[[Templates/Task]]"',
          '      bug: "[[Templates/Bug]]"',
        ]),
      ),
      'bug',
    );

    expect(result.ok).toBe(true);
    expect(result.availableVariants).toEqual(['bug', 'default', 'research']);
    expect(result.selected?.variant).toBe('bug');
    expect(result.selected?.template.path).toBe('Templates/Bug.md');
  });

  it('does not silently fall back for a missing named variant', async () => {
    const result = await resolver([]).resolve(
      project(taskMap(['      default: "[[Templates/Missing]]"'])),
      'bug',
    );

    expect(result.ok).toBe(false);
    expect(result.selected).toBeNull();
    expect(result.diagnostics.map((issue) => issue.code)).toEqual([
      'template.variant.not_found',
    ]);
  });

  it('allows an explicit packaged-minimal choice around a broken reference', async () => {
    const result = await resolver([]).resolve(
      project(taskMap(['      default: "[[Templates/Missing]]"'])),
      PACKAGED_MINIMAL_TEMPLATE_ID,
    );

    expect(result.ok).toBe(true);
    expect(result.selected?.source).toBe('packaged');
  });

  it('fails closed on unresolved and ambiguous explicit references', async () => {
    const unresolved = await resolver([]).resolve(
      project(taskMap(['      default: "[[Task]]"'])),
    );
    const first = template('One/Task.md');
    const second = template('Two/Task.md');
    const ambiguous = await resolver([first, second]).resolve(
      project(taskMap(['      default: "[[Task]]"'])),
    );

    expect(unresolved.diagnostics.map((issue) => issue.code)).toEqual([
      'template.reference.unresolved',
    ]);
    expect(ambiguous.diagnostics.map((issue) => issue.code)).toEqual([
      'template.reference.ambiguous',
    ]);
    expect(ambiguous.diagnostics[0]?.relatedPaths).toEqual([
      'One/Task.md',
      'Two/Task.md',
    ]);
  });

  it('rejects malformed and incompatible resolved templates', async () => {
    const malformed = sourceNote(
      'Templates/Broken.md',
      ['weave_template: true', 'template_schema: 1'].join('\n'),
    );
    const wrongKind = template('Templates/Document.md', 'document');

    const malformedResult = await resolver([malformed]).resolve(
      project(taskMap(['      default: "[[Templates/Broken]]"'])),
    );
    const wrongKindResult = await resolver([wrongKind]).resolve(
      project(taskMap(['      default: "[[Templates/Document]]"'])),
    );

    expect(malformedResult.ok).toBe(false);
    expect(malformedResult.diagnostics.map((issue) => issue.code)).toContain(
      'template.for.missing',
    );
    expect(wrongKindResult.ok).toBe(false);
    expect(wrongKindResult.diagnostics.map((issue) => issue.code)).toContain(
      'template.kind_mismatch',
    );
  });

  it('rejects malformed map shapes and invalid requested keys', async () => {
    const malformedMap = await resolver([]).resolve(
      project(['weave:', '  templates:', '    task: "[[Task]]"'].join('\n')),
    );
    const invalidVariant = await resolver([]).resolve(project(), 'Bug Task');

    expect(malformedMap.diagnostics.map((issue) => issue.code)).toEqual([
      'template.map.kind_invalid',
    ]);
    expect(invalidVariant.diagnostics.map((issue) => issue.code)).toEqual([
      'template.variant.invalid',
    ]);
  });

  it('keeps an invalid unrelated key unavailable without hiding a valid default', async () => {
    const note = template('Templates/Task.md');
    const result = await resolver([note]).resolve(
      project(
        taskMap([
          '      default: "[[Templates/Task]]"',
          '      "Bug Task": "[[Templates/Task]]"',
        ]),
      ),
    );

    expect(result.ok).toBe(true);
    expect(result.availableVariants).toEqual(['default']);
    expect(result.diagnostics.map((issue) => issue.code)).toEqual([
      'template.map.variant_key_invalid',
    ]);
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

  it('lets a project override one variant without displacing the others', async () => {
    const own = template('Projects/Game/Templates/Bug.md');
    const vaultBug = template(`${LIBRARY}/task/bug.md`);
    const vaultDefault = template(`${LIBRARY}/task/default.md`);
    const notes = [own, vaultBug, vaultDefault];
    const mapped = project(taskMap(['      bug: "[[Templates/Bug]]"']));

    const bug = await resolver(notes, LIBRARY).resolve(mapped, 'bug');
    expect(bug.selected?.source).toBe('project');
    expect(bug.selected?.reference).toBe('[[Templates/Bug]]');

    const fallback = await resolver(notes, LIBRARY).resolve(mapped);
    expect(fallback.selected?.source).toBe('vault');
    expect(fallback.selected?.reference).toBe(vaultDefault.path);
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
      template('Projects/Game/Templates/Spike.md'),
    ];

    const variants = await resolver(notes, LIBRARY).listVariants(
      project(taskMap(['      spike: "[[Templates/Spike]]"'])),
    );

    // Project and vault variants merge; another kind's folder is not a task.
    expect(variants).toEqual(['default', 'bug', 'spike', 'test']);
  });

  it('offers only the default when no library is configured', async () => {
    expect(await resolver([]).listVariants(project())).toEqual(['default']);
  });
});
