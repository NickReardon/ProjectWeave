import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { parseMarkdownEntity } from '../../src/domain/markdown-parser';
import {
  PACKAGED_DESIGN_DOCUMENT_TEMPLATE,
  PACKAGED_DESIGN_DOCUMENT_TEMPLATE_FILE,
  PACKAGED_MINIMAL_DOCUMENT_TEMPLATE,
  PACKAGED_MINIMAL_DOCUMENT_TEMPLATE_FILE,
  PACKAGED_MINIMAL_EPIC_TEMPLATE,
  PACKAGED_MINIMAL_EPIC_TEMPLATE_FILE,
  PACKAGED_MINIMAL_MILESTONE_TEMPLATE,
  PACKAGED_MINIMAL_MILESTONE_TEMPLATE_FILE,
  PACKAGED_MINIMAL_PLANNING_PERIOD_TEMPLATE,
  PACKAGED_MINIMAL_PLANNING_PERIOD_TEMPLATE_FILE,
  PACKAGED_MINIMAL_PROJECT_TEMPLATE,
  PACKAGED_MINIMAL_PROJECT_TEMPLATE_FILE,
  PACKAGED_STARTER_TEMPLATES,
  PACKAGED_MINIMAL_TASK_TEMPLATE,
  PACKAGED_MINIMAL_TASK_TEMPLATE_FILE,
} from '../../src/domain/templates/packaged-templates';
import { parseTemplateDocument } from '../../src/domain/templates/template-parser';
import { IndexBuilder } from '../../src/indexing/index-builder';

const repositoryRoot = new URL('../../', import.meta.url);

describe('packaged minimal task template', () => {
  it('matches its editable source file byte for byte', async () => {
    const onDisk = await readFile(
      fileURLToPath(
        new URL(PACKAGED_MINIMAL_TASK_TEMPLATE_FILE, repositoryRoot),
      ),
      'utf8',
    );

    expect(PACKAGED_MINIMAL_TASK_TEMPLATE.content).toBe(onDisk);
  });

  it('parses without diagnostics and declares its inputs', () => {
    const document = parseTemplateDocument(PACKAGED_MINIMAL_TASK_TEMPLATE);

    expect(document.diagnostics).toEqual([]);
    expect(document.metadata.isTemplate).toBe(true);
    expect(document.metadata.templateFor).toBe('task');
    expect(document.metadata.templateName).toBe('default');
    expect(document.metadata.inputs.map((input) => input.name)).toEqual([
      'summary',
      'acceptance_criteria',
    ]);
    expect(document.metadata.inputs.every((input) => !input.required)).toBe(
      true,
    );
  });

  it('stays out of entity indexing when it lives in a vault', () => {
    const note = {
      path: 'Projects/Game/Templates/Task.md',
      content: PACKAGED_MINIMAL_TASK_TEMPLATE.content,
      fingerprint: 'packaged-task-template',
    };

    const parsed = parseMarkdownEntity(note);
    expect(parsed.entity).toBeNull();
    expect(parsed.ignoredReason).toBe('template');
    expect(parsed.diagnostics).toEqual([]);

    const snapshot = new IndexBuilder().build(
      [
        note,
        {
          path: 'Projects/Game/Project.md',
          content: '---\ntype: project\n---\n',
          fingerprint: 'project',
        },
      ],
      { revision: 1 },
    );

    expect(snapshot.getEntity(note.path)).toBeUndefined();
    expect(
      snapshot.diagnostics.filter((issue) => issue.path === note.path),
    ).toEqual([]);
  });
});

describe('packaged minimal project template', () => {
  it('matches its editable source file byte for byte', async () => {
    const onDisk = await readFile(
      fileURLToPath(
        new URL(PACKAGED_MINIMAL_PROJECT_TEMPLATE_FILE, repositoryRoot),
      ),
      'utf8',
    );

    expect(PACKAGED_MINIMAL_PROJECT_TEMPLATE.content).toBe(onDisk);
  });

  it('parses without diagnostics and declares its one input', () => {
    const document = parseTemplateDocument(PACKAGED_MINIMAL_PROJECT_TEMPLATE);

    expect(document.diagnostics).toEqual([]);
    expect(document.metadata.isTemplate).toBe(true);
    expect(document.metadata.templateFor).toBe('project');
    expect(document.metadata.templateName).toBe('default');
    expect(document.metadata.inputs.map((input) => input.name)).toEqual([
      'summary',
    ]);
    expect(document.metadata.inputs.every((input) => !input.required)).toBe(
      true,
    );
  });

  it('stays out of entity indexing when it lives in a vault', () => {
    const note = {
      path: 'Templates/Project.md',
      content: PACKAGED_MINIMAL_PROJECT_TEMPLATE.content,
      fingerprint: 'packaged-project-template',
    };

    const parsed = parseMarkdownEntity(note);
    expect(parsed.entity).toBeNull();
    expect(parsed.ignoredReason).toBe('template');
    expect(parsed.diagnostics).toEqual([]);
  });
});

describe.each([
  {
    label: 'epic default',
    kind: 'epic',
    variant: 'default',
    inputNames: ['outcome'],
    source: PACKAGED_MINIMAL_EPIC_TEMPLATE,
    file: PACKAGED_MINIMAL_EPIC_TEMPLATE_FILE,
  },
  {
    label: 'milestone default',
    kind: 'milestone',
    variant: 'default',
    inputNames: ['outcome'],
    source: PACKAGED_MINIMAL_MILESTONE_TEMPLATE,
    file: PACKAGED_MINIMAL_MILESTONE_TEMPLATE_FILE,
  },
  {
    label: 'planning-period default',
    kind: 'planning_period',
    variant: 'default',
    inputNames: ['review'],
    source: PACKAGED_MINIMAL_PLANNING_PERIOD_TEMPLATE,
    file: PACKAGED_MINIMAL_PLANNING_PERIOD_TEMPLATE_FILE,
  },
  {
    label: 'document default',
    kind: 'document',
    variant: 'default',
    inputNames: ['summary'],
    source: PACKAGED_MINIMAL_DOCUMENT_TEMPLATE,
    file: PACKAGED_MINIMAL_DOCUMENT_TEMPLATE_FILE,
  },
  {
    label: 'document design variant',
    kind: 'document',
    variant: 'design',
    inputNames: ['summary'],
    source: PACKAGED_DESIGN_DOCUMENT_TEMPLATE,
    file: PACKAGED_DESIGN_DOCUMENT_TEMPLATE_FILE,
  },
])(
  'packaged $label template',
  ({ kind, variant, inputNames, source, file }) => {
    it('matches its editable source file byte for byte', async () => {
      const onDisk = await readFile(
        fileURLToPath(new URL(file, repositoryRoot)),
        'utf8',
      );

      expect(source.content).toBe(onDisk);
    });

    it('parses without diagnostics and declares its optional inputs', () => {
      const document = parseTemplateDocument(source);

      expect(document.diagnostics).toEqual([]);
      expect(document.metadata.isTemplate).toBe(true);
      expect(document.metadata.templateFor).toBe(kind);
      expect(document.metadata.templateName).toBe(variant);
      expect(document.metadata.inputs.map((input) => input.name)).toEqual(
        inputNames,
      );
      expect(document.metadata.inputs.every((input) => !input.required)).toBe(
        true,
      );
    });

    it('stays out of entity indexing when it lives in a vault', () => {
      const parsed = parseMarkdownEntity({
        path: `Projects/Game/Templates/${kind}-${variant}.md`,
        content: source.content,
        fingerprint: `${kind}-${variant}`,
      });

      expect(parsed.entity).toBeNull();
      expect(parsed.ignoredReason).toBe('template');
      expect(parsed.diagnostics).toEqual([]);
    });
  },
);

it('publishes one complete packaged starter catalog', () => {
  expect(
    PACKAGED_STARTER_TEMPLATES.map(({ kind, variant }) => `${kind}/${variant}`),
  ).toEqual([
    'task/default',
    'project/default',
    'epic/default',
    'milestone/default',
    'planning_period/default',
    'document/default',
    'document/design',
  ]);
});
