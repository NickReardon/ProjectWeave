import { describe, expect, it } from 'vitest';

import { parseMarkdownEntity } from '../../src/domain/markdown-parser';
import type {
  TemplateClock,
  TemplateSource,
} from '../../src/domain/templates/model';
import { PACKAGED_MINIMAL_PROJECT_TEMPLATE } from '../../src/domain/templates/packaged-templates';
import { renderProjectTemplate } from '../../src/domain/templates/project-template';
import type {
  ProjectTemplateContext,
  ProjectTemplateRequest,
} from '../../src/domain/templates/project-template';

/**
 * A project is the root a task hangs off, so this covers the same ground the
 * task renderer's tests do — precedence, invariants, unknown variables, and a
 * result that parses back as the kind it claims to be — for the smaller
 * context a project carries.
 */

const CLOCK: TemplateClock = {
  year: 2026,
  month: 8,
  day: 5,
  hour: 9,
  minute: 5,
  second: 42,
};

const TARGET_PATH = 'Projects/Travel Planner/Project.md';

function context(
  overrides: Partial<ProjectTemplateContext> = {},
): ProjectTemplateContext {
  return { title: 'Travel Planner', clock: CLOCK, ...overrides };
}

function request(
  overrides: Partial<ProjectTemplateRequest> = {},
): ProjectTemplateRequest {
  return {
    template: PACKAGED_MINIMAL_PROJECT_TEMPLATE,
    context: context(),
    invariants: { targetPath: TARGET_PATH },
    ...overrides,
  };
}

function template(frontmatter: string, body = ''): TemplateSource {
  const normalized = frontmatter.trim();
  const includeSchema = !/(?:^|\n)template_schema:/u.test(normalized);
  return {
    path: 'Templates/Project.md',
    content: [
      '---',
      ...(includeSchema ? ['template_schema: 1'] : []),
      normalized,
      '---',
      body,
    ].join('\n'),
  };
}

function codes(result: { diagnostics: readonly { code: string }[] }): string[] {
  return result.diagnostics.map((issue) => issue.code);
}

describe('renderProjectTemplate', () => {
  it('renders the packaged template into a note that parses as a project', () => {
    const result = renderProjectTemplate(request());

    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.note?.targetPath).toBe(TARGET_PATH);

    const content = result.note?.content ?? '';
    expect(content).toContain('type: project');
    expect(content).toContain('title: Travel Planner');
    // The template's own status survives when the context does not choose one.
    expect(content).toContain('status: planned');
    expect(content).toContain('created: 2026-08-05');
    expect(content).toContain('# Travel Planner');

    const parsed = parseMarkdownEntity({
      path: TARGET_PATH,
      content,
      fingerprint: 'render',
    });
    expect(parsed.entity?.kind).toBe('project');
    expect(parsed.diagnostics).toEqual([]);
  });

  it('omits an optional section whose input was not supplied', () => {
    const withSummary = renderProjectTemplate(
      request({ inputs: { summary: 'Two weeks in Norway.' } }),
    );
    expect(withSummary.note?.content).toContain('## Summary');
    expect(withSummary.note?.content).toContain('Two weeks in Norway.');

    expect(renderProjectTemplate(request()).note?.content).not.toContain(
      '## Summary',
    );
  });

  it('lets the creation context override a status the template hard-codes', () => {
    const result = renderProjectTemplate(
      request({ context: context({ status: 'active' }) }),
    );

    expect(result.ok).toBe(true);
    expect(result.note?.content).toContain('status: active');
    expect(result.note?.content).not.toContain('status: planned');
  });

  it('refuses a template that declares itself for another kind', () => {
    const result = renderProjectTemplate(
      request({
        template: template('template_for: task\ntype: project'),
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.note).toBeNull();
    expect(codes(result)).toContain('template.kind_mismatch');
  });

  it('refuses a template that hard-codes a conflicting type', () => {
    const result = renderProjectTemplate(
      request({ template: template('type: task\ntitle: "{{title}}"') }),
    );

    expect(result.ok).toBe(false);
    expect(codes(result)).toContain('template.invariant.type');
  });

  it('refuses an unsafe target path before rendering anything', () => {
    const result = renderProjectTemplate(
      request({ invariants: { targetPath: '../outside/Project.md' } }),
    );

    expect(result.ok).toBe(false);
    expect(result.note).toBeNull();
    expect(codes(result)).toContain('template.invariant.target_path');
  });

  it('rejects a declared input that shadows a built-in variable', () => {
    const result = renderProjectTemplate(
      request({
        template: template(
          [
            'template_for: project',
            'template_inputs:',
            '  title:',
            '    type: string',
            'type: project',
          ].join('\n'),
        ),
      }),
    );

    expect(result.ok).toBe(false);
    expect(codes(result)).toContain('template.input.reserved_name');
  });

  it('reports a variable a project context cannot resolve', () => {
    const result = renderProjectTemplate(
      request({
        template: template('type: project\nowner: "{{project_link}}"'),
      }),
    );

    expect(result.ok).toBe(false);
    expect(codes(result)).toContain('template.variable.unknown');
  });
});
