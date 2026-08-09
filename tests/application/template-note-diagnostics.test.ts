import { describe, expect, it } from 'vitest';

import {
  diagnoseTemplateNote,
  isInTemplateLibrary,
} from '../../src/application/template-note-diagnostics';

const LIBRARY = 'Templates/Project Weave';

describe('template note diagnostics', () => {
  it('validates a template note in the configured library', () => {
    expect(
      diagnoseTemplateNote(
        `${LIBRARY}/task/bug.md`,
        ['---', 'template_for: task', '---', '', '# {{title}}'].join('\n'),
        LIBRARY,
      ),
    ).toEqual([]);
  });

  it('reports a missing template_for on the template note itself', () => {
    const diagnostics = diagnoseTemplateNote(
      `${LIBRARY}/task/bug.md`,
      '---\ntemplate_name: bug\n---\n# {{title}}\n',
      LIBRARY,
    );

    expect(diagnostics.map((issue) => issue.code)).toEqual([
      'template.for.missing',
    ]);
    expect(diagnostics[0]?.path).toBe(`${LIBRARY}/task/bug.md`);
  });

  it('does not suggest removing an invalid marker from a library template', () => {
    const diagnostics = diagnoseTemplateNote(
      `${LIBRARY}/task/bug.md`,
      [
        '---',
        'weave_template: "true"',
        'template_schema: 1',
        'template_for: task',
        '---',
      ].join('\n'),
      LIBRARY,
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'template.marker.invalid',
        recovery:
          'Remove the optional `weave_template` key, or set it to the Boolean `true`.',
      }),
    );
  });

  it('reports a folder and metadata kind mismatch', () => {
    const diagnostics = diagnoseTemplateNote(
      `${LIBRARY}/task/bug.md`,
      [
        '---',
        'weave_template: true',
        'template_schema: 1',
        'template_for: epic',
        '---',
      ].join('\n'),
      LIBRARY,
    );

    expect(diagnostics.map((issue) => issue.code)).toContain(
      'template.kind_mismatch',
    );
  });

  it('reports a template note at an invalid library path', () => {
    const diagnostics = diagnoseTemplateNote(
      `${LIBRARY}/bug.md`,
      '---\nweave_template: true\ntemplate_schema: 1\ntemplate_for: task\n---\n',
      LIBRARY,
    );

    expect(diagnostics.map((issue) => issue.code)).toEqual([
      'template.library.path_invalid',
    ]);
  });

  it('ignores notes outside the configured template library', () => {
    expect(
      diagnoseTemplateNote(
        'Projects/Game/Tasks/Not a template.md',
        'not a template',
        LIBRARY,
      ),
    ).toEqual([]);
    expect(isInTemplateLibrary('Templates/Other/task/bug.md', LIBRARY)).toBe(
      false,
    );
  });
});
