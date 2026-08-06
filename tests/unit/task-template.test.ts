import { describe, expect, it } from 'vitest';

import { parseMarkdownEntity } from '../../src/domain/markdown-parser';
import type { Diagnostic } from '../../src/domain/model';
import { PACKAGED_MINIMAL_TASK_TEMPLATE } from '../../src/domain/templates/packaged-templates';
import { renderTaskTemplate } from '../../src/domain/templates/task-template';
import type {
  TaskTemplateContext,
  TaskTemplateRequest,
} from '../../src/domain/templates/task-template';
import type {
  TemplateClock,
  TemplateRenderResult,
  TemplateSource,
} from '../../src/domain/templates/model';

const CLOCK: TemplateClock = {
  year: 2026,
  month: 8,
  day: 3,
  hour: 9,
  minute: 5,
  second: 42,
};

const PROJECT_LINK = '[[Projects/Game/Project]]';
const TARGET_PATH = 'Projects/Game/Tasks/Implement travel request.md';

function context(
  overrides: Partial<TaskTemplateContext> = {},
): TaskTemplateContext {
  return {
    title: 'Implement travel request',
    status: 'todo',
    clock: CLOCK,
    ...overrides,
  };
}

function request(
  overrides: Partial<TaskTemplateRequest> = {},
): TaskTemplateRequest {
  return {
    template: PACKAGED_MINIMAL_TASK_TEMPLATE,
    context: context(),
    invariants: { projectLink: PROJECT_LINK, targetPath: TARGET_PATH },
    ...overrides,
  };
}

function template(frontmatter: string, body = ''): TemplateSource {
  const normalized = frontmatter.trim();
  const includeSchema = !/(?:^|\n)template_schema:/u.test(normalized);
  return {
    path: 'Projects/Game/Templates/Task.md',
    content: [
      '---',
      ...(includeSchema ? ['template_schema: 1'] : []),
      normalized,
      '---',
      body,
    ].join('\n'),
  };
}

function codes(result: TemplateRenderResult): string[] {
  return result.diagnostics.map((issue: Diagnostic) => issue.code);
}

function content(result: TemplateRenderResult): string {
  if (result.note === null) {
    throw new Error(
      `Expected a rendered note, got: ${codes(result).join(', ')}`,
    );
  }
  return result.note.content;
}

describe('renderTaskTemplate with the packaged minimal template', () => {
  it('renders a valid task, keeping the planning properties and omitting the rest', () => {
    const result = renderTaskTemplate(request());

    expect(result.diagnostics).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.note?.targetPath).toBe(TARGET_PATH);
    // The planning properties are empty statics, so an unset one renders as
    // null rather than disappearing: a new task shows its shape in Obsidian's
    // property editor. `rank`, `depends_on`, and `origin` stay placeholders
    // and are still omitted when unset.
    expect(content(result)).toBe(
      [
        '---',
        'type: task',
        'title: Implement travel request',
        'project: "[[Projects/Game/Project]]"',
        'status: todo',
        'epic: null',
        'milestone: null',
        'sprint: null',
        'owner: null',
        'category: null',
        'priority: null',
        'points: null',
        'due_date: null',
        'created: 2026-08-03',
        '---',
        '# Implement travel request',
        '',
        '## Notes',
        '',
      ].join('\n'),
    );
  });

  it('removes template-only metadata from the rendered note', () => {
    const rendered = content(renderTaskTemplate(request()));

    for (const key of [
      'weave_template',
      'template_schema',
      'template_for',
      'template_name',
      'template_description',
      'template_inputs',
    ]) {
      expect(rendered).not.toContain(key);
    }
  });

  it('substitutes typed context values rather than textual YAML', () => {
    const result = renderTaskTemplate(
      request({
        context: context({
          points: 3,
          rank: 2000,
          priority: 'high',
          owner: 'nick',
          dueDate: '2026-09-01',
          epicLink: '[[Projects/Game/Epics/Travel]]',
          originLink: '[[Projects/Game/Design/Travel#Requirements]]',
          dependencyLinks: [
            '[[Projects/Game/Tasks/Define request]]',
            '[[Projects/Game/Tasks/External prerequisite]]',
          ],
        }),
      }),
    );

    expect(result.diagnostics).toEqual([]);
    expect(content(result)).toBe(
      [
        '---',
        'type: task',
        'title: Implement travel request',
        'project: "[[Projects/Game/Project]]"',
        'status: todo',
        'epic: "[[Projects/Game/Epics/Travel]]"',
        'milestone: null',
        'sprint: null',
        'owner: nick',
        'category: null',
        'priority: high',
        'points: 3',
        'rank: 2000',
        'due_date: 2026-09-01',
        'depends_on:',
        '  - "[[Projects/Game/Tasks/Define request]]"',
        '  - "[[Projects/Game/Tasks/External prerequisite]]"',
        'origin: "[[Projects/Game/Design/Travel#Requirements]]"',
        'created: 2026-08-03',
        '---',
        '# Implement travel request',
        '',
        '## Notes',
        '',
      ].join('\n'),
    );

    const parsed = parseMarkdownEntity({
      path: TARGET_PATH,
      content: content(result),
      fingerprint: 'test',
    });
    expect(parsed.diagnostics).toEqual([]);
    if (parsed.entity?.kind !== 'task') {
      throw new Error('Expected the rendered note to parse as a task');
    }
    expect(parsed.entity.points).toBe(3);
    expect(parsed.entity.dependsOn.map((link) => link.linkpath)).toEqual([
      'Projects/Game/Tasks/Define request',
      'Projects/Game/Tasks/External prerequisite',
    ]);
  });

  it('renders declared inputs into the body and drops unfilled sections', () => {
    const result = renderTaskTemplate(
      request({
        inputs: {
          acceptance_criteria:
            '- [ ] Request validates destination\n- [ ] Invalid requests fail safely',
        },
      }),
    );

    expect(result.diagnostics).toEqual([]);
    expect(content(result).split('---\n')[2]).toBe(
      [
        '# Implement travel request',
        '',
        '## Acceptance criteria',
        '',
        '- [ ] Request validates destination',
        '- [ ] Invalid requests fail safely',
        '',
        '## Notes',
        '',
      ].join('\n'),
    );
  });

  it('renders identical output for identical inputs', () => {
    const first = renderTaskTemplate(request({ inputs: { summary: 'One.' } }));
    const second = renderTaskTemplate(request({ inputs: { summary: 'One.' } }));

    expect(content(first)).toBe(content(second));
  });

  it('rejects an input the template does not declare', () => {
    const result = renderTaskTemplate(
      request({ inputs: { arbitrary_note: 'injected' } }),
    );

    expect(codes(result)).toEqual(['template.input.undeclared']);
    expect(result.note).toBeNull();
  });

  it('rejects an input value that does not match its declared type', () => {
    const result = renderTaskTemplate(request({ inputs: { summary: 12 } }));

    expect(codes(result)).toEqual(['template.input.value_invalid']);
    expect(result.note).toBeNull();
  });

  it.each([
    ['markdown', ''],
    ['links', []],
  ])('rejects an empty required %s input', (type, value) => {
    const result = renderTaskTemplate(
      request({
        template: template(
          [
            'weave_template: true',
            'template_for: task',
            'template_inputs:',
            '  required_value:',
            '    type: ' + type,
            '    required: true',
            'type: task',
            'title: "{{title}}"',
            'project: "{{project_link}}"',
            'status: "{{status}}"',
          ].join('\n'),
          '{{required_value}}\n',
        ),
        inputs: { required_value: value },
      }),
    );

    expect(codes(result)).toEqual(['template.input.required']);
    expect(result.note).toBeNull();
  });

  it.each([
    ['markdown', '""'],
    ['links', '[]'],
  ])('rejects an empty required %s default', (type, defaultValue) => {
    const result = renderTaskTemplate(
      request({
        template: template(
          [
            'weave_template: true',
            'template_for: task',
            'template_inputs:',
            '  required_value:',
            '    type: ' + type,
            '    required: true',
            '    default: ' + defaultValue,
            'type: task',
            'title: "{{title}}"',
            'project: "{{project_link}}"',
            'status: "{{status}}"',
          ].join('\n'),
          '{{required_value}}\n',
        ),
      }),
    );

    expect(codes(result)).toEqual(['template.input.required']);
    expect(result.note).toBeNull();
  });

  it('accepts false and zero as supplied required values', () => {
    const result = renderTaskTemplate(
      request({
        template: template(
          [
            'weave_template: true',
            'template_for: task',
            'template_inputs:',
            '  enabled:',
            '    type: boolean',
            '    required: true',
            '  count:',
            '    type: integer',
            '    required: true',
            'type: task',
            'title: "{{title}}"',
            'project: "{{project_link}}"',
            'status: "{{status}}"',
          ].join('\n'),
          '{{enabled}} {{count}}\n',
        ),
        inputs: { enabled: false, count: 0 },
      }),
    );

    expect(result.diagnostics).toEqual([]);
    expect(content(result)).toContain('false 0');
  });

  it.each([
    ['date', '2025-02-29'],
    ['datetime', '2026-08-03T09:60'],
  ])('rejects an impossible supplied %s input', (type, value) => {
    const result = renderTaskTemplate(
      request({
        template: template(
          [
            'weave_template: true',
            'template_for: task',
            'template_inputs:',
            '  scheduled:',
            '    type: ' + type,
            'type: task',
            'title: "{{title}}"',
            'project: "{{project_link}}"',
            'status: "{{status}}"',
          ].join('\n'),
          '{{scheduled}}\n',
        ),
        inputs: { scheduled: value },
      }),
    );

    expect(codes(result)).toEqual(['template.input.value_invalid']);
    expect(result.note).toBeNull();
  });
});

describe('renderTaskTemplate precedence and invariants', () => {
  it('prefers creation context over a static template default', () => {
    const result = renderTaskTemplate(
      request({
        template: template(
          [
            'weave_template: true',
            'template_for: task',
            'type: task',
            'title: Placeholder title',
            'project: "{{project_link}}"',
            'status: backlog',
            'priority: low',
          ].join('\n'),
        ),
        context: context({ priority: 'critical' }),
      }),
    );

    expect(result.diagnostics).toEqual([]);
    expect(content(result)).toContain('title: Implement travel request');
    expect(content(result)).toContain('status: todo');
    expect(content(result)).toContain('priority: critical');
  });

  it('keeps a static template default the context leaves unset', () => {
    const result = renderTaskTemplate(
      request({
        template: template(
          [
            'weave_template: true',
            'template_for: task',
            'type: task',
            'title: "{{title}}"',
            'project: "{{project_link}}"',
            'status: "{{status}}"',
            'priority: low',
          ].join('\n'),
        ),
      }),
    );

    expect(result.diagnostics).toEqual([]);
    expect(content(result)).toContain('priority: low');
  });

  it('preserves unknown non-reserved static properties', () => {
    const result = renderTaskTemplate(
      request({
        template: template(
          [
            'weave_template: true',
            'template_for: task',
            'type: task',
            'title: "{{title}}"',
            'project: "{{project_link}}"',
            'status: "{{status}}"',
            'team: rendering',
            'labels:',
            '  - triage',
            '  - travel',
            'review_required: true',
            'integration:',
            '  tracker: internal',
            '  ticket: 42',
          ].join('\n'),
        ),
      }),
    );

    expect(result.diagnostics).toEqual([]);
    expect(content(result).split('---\n')[1]).toBe(
      [
        'type: task',
        'title: Implement travel request',
        'project: "[[Projects/Game/Project]]"',
        'status: todo',
        'team: rendering',
        'labels:',
        '  - triage',
        '  - travel',
        'review_required: true',
        'integration:',
        '  tracker: internal',
        '  ticket: 42',
        // The seven planning properties arrive from the task creation profile
        // rather than the template, appended after what the template declared.
        'epic: null',
        'milestone: null',
        'sprint: null',
        'owner: null',
        'category: null',
        'priority: null',
        'points: null',
        'due_date: null',
        '',
      ].join('\n'),
    );
  });

  it('keeps a template property the author explicitly left empty', () => {
    const result = renderTaskTemplate(
      request({
        template: template(
          [
            'weave_template: true',
            'template_for: task',
            'type: task',
            'title: "{{title}}"',
            'project: "{{project_link}}"',
            'status: "{{status}}"',
            'epic:',
          ].join('\n'),
        ),
      }),
    );

    expect(result.diagnostics).toEqual([]);
    expect(content(result)).toContain('epic: null');
  });

  it('rejects a template that contradicts the selected project', () => {
    const result = renderTaskTemplate(
      request({
        template: template(
          [
            'weave_template: true',
            'template_for: task',
            'type: task',
            'title: "{{title}}"',
            'project: "[[Projects/Other/Project]]"',
            'status: "{{status}}"',
          ].join('\n'),
        ),
      }),
    );

    expect(codes(result)).toEqual(['template.invariant.project']);
    expect(result.note).toBeNull();
  });

  it('rejects a template that contradicts the task entity type', () => {
    const result = renderTaskTemplate(
      request({
        template: template(
          [
            'weave_template: true',
            'template_for: task',
            'type: epic',
            'title: "{{title}}"',
            'project: "{{project_link}}"',
            'status: "{{status}}"',
          ].join('\n'),
        ),
      }),
    );

    expect(codes(result)).toEqual(['template.invariant.type']);
    expect(result.note).toBeNull();
  });

  it('supplies invariant properties a template omits', () => {
    const result = renderTaskTemplate(
      request({
        template: template(
          [
            'weave_template: true',
            'template_for: task',
            'title: "{{title}}"',
            'status: "{{status}}"',
          ].join('\n'),
        ),
      }),
    );

    expect(result.diagnostics).toEqual([]);
    expect(content(result)).toBe(
      [
        '---',
        'project: "[[Projects/Game/Project]]"',
        'type: task',
        'title: Implement travel request',
        'status: todo',
        'epic: null',
        'milestone: null',
        'sprint: null',
        'owner: null',
        'category: null',
        'priority: null',
        'points: null',
        'due_date: null',
        '---',
        '',
      ].join('\n'),
    );
  });

  it('rejects a template declared for another note kind', () => {
    const result = renderTaskTemplate(
      request({
        template: template(
          ['weave_template: true', 'template_for: milestone'].join('\n'),
        ),
      }),
    );

    expect(codes(result)).toContain('template.kind_mismatch');
    expect(result.note).toBeNull();
  });

  it('rejects an unsafe target path', () => {
    const result = renderTaskTemplate(
      request({
        invariants: {
          projectLink: PROJECT_LINK,
          targetPath: 'Projects/../../etc/passwd',
        },
      }),
    );

    expect(codes(result)).toEqual(['template.invariant.target_path']);
    expect(result.note).toBeNull();
  });

  it.each(['/Projects/Game/Tasks/Task.md', 'Projects\\Game\\Tasks\\Task.md'])(
    'rejects a target path that is not already normalized: %s',
    (targetPath) => {
      const result = renderTaskTemplate(
        request({ invariants: { projectLink: PROJECT_LINK, targetPath } }),
      );

      expect(codes(result)).toEqual(['template.invariant.target_path']);
      expect(result.note).toBeNull();
    },
  );

  it('renders the exact validated target path through its built-in variable', () => {
    const result = renderTaskTemplate(
      request({
        template: template(
          [
            'weave_template: true',
            'template_for: task',
            'type: task',
            'title: "{{title}}"',
            'project: "{{project_link}}"',
            'status: "{{status}}"',
          ].join('\n'),
          'Target: {{target_path}}\n',
        ),
      }),
    );

    expect(result.note?.targetPath).toBe(TARGET_PATH);
    expect(content(result)).toContain('Target: ' + TARGET_PATH);
  });

  it('reports a rendered note that would not parse as a valid task', () => {
    const result = renderTaskTemplate(
      request({
        template: template(
          [
            'weave_template: true',
            'template_for: task',
            'type: task',
            'title: "{{title}}"',
            'project: "{{project_link}}"',
            'status: "{{status}}"',
            'completed_at: 2026-08-03T09:05:00Z',
          ].join('\n'),
        ),
      }),
    );

    expect(codes(result)).toEqual(['task.completed_at.status_mismatch']);
    expect(result.note).toBeNull();
  });
});

describe('renderTaskTemplate body rendering', () => {
  function body(source: string, overrides: Partial<TaskTemplateRequest> = {}) {
    return renderTaskTemplate(
      request({
        template: template(
          [
            'weave_template: true',
            'template_for: task',
            'template_inputs:',
            '  summary:',
            '    type: markdown',
            'type: task',
            'title: "{{title}}"',
            'project: "{{project_link}}"',
            'status: "{{status}}"',
          ].join('\n'),
          source,
        ),
        ...overrides,
      }),
    );
  }

  it('interpolates variables and formatted dates inside ordinary Markdown', () => {
    const result = body(
      [
        '# {{title}}',
        '',
        'Opened {{date}} at {{time}} in {{project_title}}.',
        'Compact: {{date:YYYYMMDD}}, stamp {{datetime}}, literal {{date:[on] MM/DD}}.',
        '',
        '- item one',
        '- item two',
        '',
      ].join('\n'),
      { context: context({ projectTitle: 'Game' }) },
    );

    expect(result.diagnostics).toEqual([]);
    expect(content(result).split('---\n')[2]).toBe(
      [
        '# Implement travel request',
        '',
        'Opened 2026-08-03 at 09:05 in Game.',
        'Compact: 20260803, stamp 2026-08-03T09:05, literal on 08/03.',
        '',
        '- item one',
        '- item two',
        '',
      ].join('\n'),
    );
  });

  it('normalizes template line endings so output stays byte-stable', () => {
    const lf = body(['# {{title}}', '', 'Body text.', ''].join('\n'));
    const crlf = body(['# {{title}}', '', 'Body text.', ''].join('\r\n'));

    expect(crlf.diagnostics).toEqual([]);
    expect(content(crlf)).toBe(content(lf));
    expect(content(crlf)).not.toContain('\r');
  });

  it('emits a literal brace pair for an escaped placeholder', () => {
    const result = body(
      ['Use \\{{title}} to insert the title.', ''].join('\n'),
    );

    expect(result.diagnostics).toEqual([]);
    expect(content(result)).toContain('Use {{title}} to insert the title.');
  });

  it('renders a conditional block only when its variable has a value', () => {
    const source = [
      '{{#if summary}}',
      '## Summary',
      '',
      '{{summary}}',
      '{{/if}}',
      '## Notes',
      '',
    ].join('\n');

    expect(content(body(source))).toContain('---\n## Notes\n');
    expect(
      content(body(source, { inputs: { summary: 'Handle the request.' } })),
    ).toContain('## Summary\n\nHandle the request.\n## Notes\n');
  });

  it('validates variables inside a block that does not render', () => {
    const result = body(
      ['{{#if summary}}', '{{mystery}}', '{{/if}}', ''].join('\n'),
    );

    expect(codes(result)).toEqual(['template.variable.unknown']);
  });

  it('rejects an unknown variable', () => {
    const result = body(['{{invented_variable}}', ''].join('\n'));

    expect(codes(result)).toEqual(['template.variable.unknown']);
    expect(result.note).toBeNull();
  });

  it('rejects nested conditional blocks once', () => {
    const result = body(
      [
        '{{#if summary}}',
        '{{#if title}}',
        'nested',
        '{{/if}}',
        '{{/if}}',
        '',
      ].join('\n'),
    );

    expect(codes(result)).toEqual(['template.block.nested']);
  });

  it('rejects an unterminated conditional block', () => {
    const result = body(['{{#if summary}}', 'text', ''].join('\n'));

    expect(codes(result)).toEqual(['template.block.unterminated']);
  });

  it('rejects a close tag with no open block', () => {
    const result = body(['text', '{{/if}}', ''].join('\n'));

    expect(codes(result)).toEqual(['template.block.unmatched']);
  });

  it('rejects an unsupported directive', () => {
    const result = body(['{{#each tasks}}', '{{/each}}', ''].join('\n'));

    expect(codes(result)).toEqual([
      'template.directive.unsupported',
      'template.directive.unsupported',
    ]);
  });

  it('rejects a placeholder that is never closed', () => {
    const result = body(['Title is {{title', ''].join('\n'));

    expect(codes(result)).toEqual(['template.placeholder.malformed']);
  });

  it('rejects a format suffix on a variable that has no format', () => {
    const result = body(['{{title:YYYY}}', ''].join('\n'));

    expect(codes(result)).toEqual(['template.variable.format_unsupported']);
  });

  it('rejects an unsupported date format', () => {
    const result = body(['{{date:MMMM Do}}', ''].join('\n'));

    expect(codes(result)).toEqual(['template.variable.format_invalid']);
  });
});

describe('the task creation profile', () => {
  const bodyOnly = [
    'weave_template: true',
    'template_schema: 1',
    'template_for: task',
  ].join('\n');

  it('renders a valid task from a template that declares no frontmatter', () => {
    const result = renderTaskTemplate(
      request({
        template: template(
          bodyOnly,
          ['# {{title}}', '', '## Problem', ''].join('\n'),
        ),
        context: context({ rank: 5000 }),
      }),
    );

    expect(result.diagnostics).toEqual([]);
    const rendered = content(result);
    // Identity from the invariants, everything else from the profile.
    expect(rendered).toContain('type: task');
    expect(rendered).toContain('project: "[[Projects/Game/Project]]"');
    expect(rendered).toContain('title: Implement travel request');
    expect(rendered).toContain('status: todo');
    expect(rendered).toContain('rank: 5000');
    for (const key of [
      'epic',
      'milestone',
      'sprint',
      'owner',
      'priority',
      'points',
      'due_date',
    ]) {
      expect(rendered).toContain(`${key}: null`);
    }
    // Absence carries meaning for these two, so they stay omitted.
    expect(rendered).not.toContain('depends_on');
    expect(rendered).not.toContain('origin');

    const parsed = parseMarkdownEntity({
      path: TARGET_PATH,
      content: rendered,
      fingerprint: 'render',
    });
    expect(parsed.entity?.kind).toBe('task');
    expect(parsed.diagnostics).toEqual([]);
  });

  it('leaves a template that declares the planning shape byte-identical', () => {
    // The packaged template declares all seven, so the profile must add
    // nothing: this is the guard that ADR 0010's bytes did not move.
    const packaged = renderTaskTemplate(request());

    expect(packaged.diagnostics).toEqual([]);
    expect(
      content(packaged)
        .split('---\n')[1]
        ?.split('\n')
        .filter((line) => line.endsWith(': null')),
    ).toHaveLength(8);
  });

  it('supplies a context value for a field the template omits', () => {
    const result = renderTaskTemplate(
      request({
        template: template(bodyOnly),
        context: context({ owner: 'Robin', priority: 'high' }),
      }),
    );

    expect(result.diagnostics).toEqual([]);
    expect(content(result)).toContain('owner: Robin');
    expect(content(result)).toContain('priority: high');
  });
});
