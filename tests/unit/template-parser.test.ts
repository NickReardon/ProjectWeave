import { describe, expect, it } from 'vitest';

import { parseTemplateDocument } from '../../src/domain/templates/template-parser';
import type { TemplateSource } from '../../src/domain/templates/model';

function template(
  frontmatter: string,
  body = '# {{title}}\n',
  options: { readonly includeSchema?: boolean } = {},
): TemplateSource {
  const normalized = frontmatter.trim();
  const includeSchema =
    options.includeSchema !== false &&
    !/(?:^|\n)template_schema:/u.test(normalized);
  return {
    path: 'Templates/Task.md',
    content: [
      '---',
      ...(includeSchema ? ['template_schema: 1'] : []),
      normalized,
      '---',
      body,
    ].join('\n'),
  };
}

function codes(document: {
  diagnostics: readonly { code: string }[];
}): string[] {
  return document.diagnostics.map((issue) => issue.code);
}

describe('parseTemplateDocument', () => {
  it('separates reserved metadata from output-bound properties', () => {
    const document = parseTemplateDocument(
      template(
        [
          'weave_template: true',
          'template_schema: 1',
          'template_for: task',
          'template_name: bug',
          'template_description: Defect report',
          'template_inputs:',
          '  summary:',
          '    type: markdown',
          '    required: true',
          '    description: What went wrong',
          'type: task',
          'title: "{{title}}"',
          'labels:',
          '  - triage',
        ].join('\n'),
      ),
    );

    expect(document.diagnostics).toEqual([]);
    expect(document.metadata).toEqual({
      isTemplate: true,
      schema: 1,
      templateFor: 'task',
      templateName: 'bug',
      description: 'Defect report',
      inputs: [
        {
          name: 'summary',
          type: 'markdown',
          required: true,
          description: 'What went wrong',
        },
      ],
    });
    expect(document.properties).toEqual([
      { key: 'type', source: 'static', value: 'task' },
      { key: 'title', source: 'placeholder', token: 'title' },
      { key: 'labels', source: 'static', value: ['triage'] },
    ]);
    expect(document.body).toBe('# {{title}}\n');
  });

  it('rejects a note that is not marked as a template', () => {
    const document = parseTemplateDocument(
      template(['type: task', 'title: "{{title}}"'].join('\n')),
    );

    expect(codes(document)).toEqual([
      'template.marker.missing',
      'template.for.missing',
    ]);
  });

  it('rejects a template that omits its schema version', () => {
    const document = parseTemplateDocument(
      template(
        ['weave_template: true', 'template_for: task'].join('\n'),
        '# {{title}}\n',
        { includeSchema: false },
      ),
    );

    expect(codes(document)).toEqual(['template.schema.missing']);
  });

  it('reports invalid template metadata types instead of ignoring them', () => {
    const document = parseTemplateDocument(
      template(
        [
          'weave_template: "yes"',
          'template_schema: 2',
          'template_for: Task Kind',
          'template_description: 5',
        ].join('\n'),
      ),
    );

    expect(codes(document)).toEqual([
      'template.marker.invalid',
      'template.schema.unsupported',
      'template.key.invalid',
      'template.description.invalid',
    ]);
  });

  it('reports unsupported and malformed input declarations', () => {
    const document = parseTemplateDocument(
      template(
        [
          'weave_template: true',
          'template_for: task',
          'template_inputs:',
          '  Summary:',
          '    type: markdown',
          '  effort:',
          '    type: duration',
          '  notes: plain',
          '  release:',
          '    type: date',
          '    default: soon',
          '  owner_hint:',
          '    type: string',
          '    required: maybe',
        ].join('\n'),
      ),
    );

    expect(codes(document)).toEqual([
      'template.input.name_invalid',
      'template.input.type_unsupported',
      'template.input.invalid',
      'template.input.default_invalid',
      'template.input.required_invalid',
    ]);
    expect(document.metadata.inputs).toEqual([]);
  });

  it('keeps a typed static default when it matches the declared type', () => {
    const document = parseTemplateDocument(
      template(
        [
          'weave_template: true',
          'template_for: task',
          'template_inputs:',
          '  effort:',
          '    type: integer',
          '    default: 3',
        ].join('\n'),
      ),
    );

    expect(document.diagnostics).toEqual([]);
    expect(document.metadata.inputs).toEqual([
      {
        name: 'effort',
        type: 'integer',
        required: false,
        defaultValue: { kind: 'integer', value: 3 },
      },
    ]);
  });

  it.each([
    ['date', '2025-02-29'],
    ['date', '2026-04-31'],
    ['datetime', '2026-08-03T24:00'],
    ['datetime', '2026-08-03T09:60:00'],
  ])('rejects an impossible %s input default', (type, value) => {
    const document = parseTemplateDocument(
      template(
        [
          'weave_template: true',
          'template_for: task',
          'template_inputs:',
          '  scheduled:',
          '    type: ' + type,
          '    default: ' + value,
        ].join('\n'),
      ),
    );

    expect(codes(document)).toEqual(['template.input.default_invalid']);
  });

  it.each([
    ['date', '2024-02-29'],
    ['date', '2000-02-29'],
    ['datetime', '2026-08-03T23:59'],
    ['datetime', '2026-08-03T23:59:59'],
  ])('accepts a valid boundary %s input default', (type, value) => {
    const document = parseTemplateDocument(
      template(
        [
          'weave_template: true',
          'template_for: task',
          'template_inputs:',
          '  scheduled:',
          '    type: ' + type,
          '    default: ' + value,
        ].join('\n'),
      ),
    );

    expect(document.diagnostics).toEqual([]);
    expect(document.metadata.inputs[0]?.defaultValue).toEqual({
      kind: 'string',
      value,
    });
  });
  it('rejects frontmatter that mixes static text with a placeholder', () => {
    const document = parseTemplateDocument(
      template(
        [
          'weave_template: true',
          'template_for: task',
          'title: "Task: {{title}}"',
        ].join('\n'),
      ),
    );

    expect(codes(document)).toEqual([
      'template.frontmatter.interpolation_unsupported',
    ]);
    expect(document.properties).toEqual([]);
  });

  it('reports malformed template frontmatter without guessing at a repair', () => {
    const document = parseTemplateDocument({
      path: 'Templates/Task.md',
      content: '---\nweave_template: true\n  broken: [1,\n---\n# Title\n',
    });

    expect(codes(document)).toEqual(['template.frontmatter.invalid']);
    expect(document.properties).toEqual([]);
  });

  it('reports a template note with no frontmatter at all', () => {
    const document = parseTemplateDocument({
      path: 'Templates/Task.md',
      content: '# Just Markdown\n',
    });

    expect(codes(document)).toEqual(['template.frontmatter.missing']);
    expect(document.body).toBe('# Just Markdown\n');
  });
});
