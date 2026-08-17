import { describe, expect, it } from 'vitest';

import {
  parseMarkdownEntity,
  parseWikiLink,
} from '../../src/domain/markdown-parser';
import { sourceNote } from '../helpers/source-note';

describe('parseMarkdownEntity', () => {
  it('parses the minimum task schema including backlog', () => {
    const parsed = parseMarkdownEntity(
      sourceNote(
        'Tasks/Implement travel.md',
        ['type: task', 'project: "[[Projects/Game]]"', 'status: backlog'].join(
          '\n',
        ),
      ),
    );

    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.entity?.kind).toBe('task');
    if (parsed.entity?.kind !== 'task') {
      throw new Error('Expected a task entity');
    }
    expect(parsed.entity.title).toBe('Implement travel');
    expect(parsed.entity.status).toBe('backlog');
    expect(parsed.entity.project?.linkpath).toBe('Projects/Game');
  });

  it('excludes marked templates before interpreting their entity type', () => {
    const parsed = parseMarkdownEntity(
      sourceNote(
        'Templates/Task.md',
        [
          'weave_template: true',
          'template_for: task',
          'type: task',
          'project: "{{project_link}}"',
          'status: "{{status}}"',
        ].join('\n'),
      ),
    );

    expect(parsed.entity).toBeNull();
    expect(parsed.ignoredReason).toBe('template');
    expect(parsed.diagnostics).toEqual([]);
  });

  it('excludes minimal templates by template_for alone', () => {
    const parsed = parseMarkdownEntity(
      sourceNote(
        'Templates/task/bug.md',
        [
          'template_for: task',
          'type: task',
          'project: "[[Projects/Game]]"',
          'status: backlog',
        ].join('\n'),
      ),
    );

    expect(parsed.entity).toBeNull();
    expect(parsed.ignoredReason).toBe('template');
    expect(parsed.diagnostics).toEqual([]);
  });

  it('defaults project workflow policy to enforced without writing metadata', () => {
    const parsed = parseMarkdownEntity(
      sourceNote('Projects/Game.md', 'type: project'),
    );

    expect(parsed.entity?.kind).toBe('project');
    if (parsed.entity?.kind !== 'project') {
      throw new Error('Expected a project entity');
    }
    expect(parsed.entity.status).toBe('active');
    expect(parsed.entity.statusExplicit).toBe(false);
    expect(parsed.entity.workflow.dependencyMode).toBe('enforced');
    expect(parsed.entity.frontmatter).not.toHaveProperty('status');
    expect(parsed.entity.frontmatter).not.toHaveProperty('weave');
  });

  it('parses an explicit advisory workflow without making estimates mandatory', () => {
    const parsed = parseMarkdownEntity(
      sourceNote(
        'Projects/Game.md',
        [
          'type: project',
          'weave:',
          '  dependency_mode: advisory',
          '  planning_period_label: cycle',
          '  estimation: points',
          '  policies:',
          '    estimate_required_in_period: false',
        ].join('\n'),
      ),
    );

    expect(parsed.entity?.kind).toBe('project');
    if (parsed.entity?.kind !== 'project') {
      throw new Error('Expected a project entity');
    }
    expect(parsed.entity.workflow).toMatchObject({
      dependencyMode: 'advisory',
      planningPeriodLabel: 'cycle',
      estimation: 'points',
      estimateRequiredInPeriod: false,
    });
  });

  it('reports malformed frontmatter without hiding other notes at index time', () => {
    const parsed = parseMarkdownEntity(
      sourceNote('Tasks/Broken.md', ['type: [task', 'status: todo'].join('\n')),
    );

    expect(parsed.entity).toBeNull();
    expect(parsed.diagnostics.map((issue) => issue.code)).toContain(
      'note.frontmatter.invalid',
    );
  });

  it('isolates unsafe YAML aliases instead of throwing out the complete index', () => {
    const parsed = parseMarkdownEntity(
      sourceNote(
        'Tasks/Alias.md',
        [
          'type: task',
          'project: &project "[[Projects/Game]]"',
          'status: todo',
          'epic: *project',
        ].join('\n'),
      ),
    );

    expect(parsed.entity).toBeNull();
    expect(parsed.diagnostics.map((issue) => issue.code)).toContain(
      'note.frontmatter.invalid_value',
    );
  });

  it('diagnoses a non-string entity type and a missing sprint scope', () => {
    const invalidType = parseMarkdownEntity(
      sourceNote('Notes/Invalid type.md', 'type: 42'),
    );
    const missingScope = parseMarkdownEntity(
      sourceNote(
        'Periods/Cycle.md',
        ['type: sprint', 'status: planned'].join('\n'),
      ),
    );

    expect(invalidType.diagnostics.map((issue) => issue.code)).toContain(
      'entity.type.invalid',
    );
    expect(missingScope.diagnostics.map((issue) => issue.code)).toContain(
      'sprint.scope.missing',
    );
  });

  it('keeps an intended entity inspectable when controlled values are invalid', () => {
    const parsed = parseMarkdownEntity(
      sourceNote(
        'Tasks/Invalid.md',
        [
          'type: task',
          'project: "[[Projects/Game]]"',
          'status: someday',
          'due_date: 2026-02-30',
        ].join('\n'),
      ),
    );

    expect(parsed.entity?.kind).toBe('task');
    expect(parsed.diagnostics.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['task.status.invalid', 'task.due_date.invalid']),
    );
  });

  it('does not cascade completed-at errors from a missing or invalid task status', () => {
    const task = (statusLine: string | null) =>
      parseMarkdownEntity(
        sourceNote(
          'Tasks/Completion.md',
          [
            'type: task',
            'project: "[[Projects/Game]]"',
            ...(statusLine === null ? [] : [statusLine]),
            'completed_at: "2026-08-02T10:00:00-07:00"',
          ].join('\n'),
        ),
      ).diagnostics.map((issue) => issue.code);

    expect(task(null)).toEqual(['task.status.missing']);
    expect(task('status: complete')).toEqual(['task.status.invalid']);
    expect(task('status: todo')).toEqual(['task.completed_at.status_mismatch']);
    expect(task('status: done')).toEqual([]);
  });

  it('does not cascade achieved-at errors from a missing or invalid milestone status', () => {
    const milestone = (statusLine: string | null) =>
      parseMarkdownEntity(
        sourceNote(
          'Milestones/Release.md',
          [
            'type: milestone',
            'project: "[[Projects/Game]]"',
            ...(statusLine === null ? [] : [statusLine]),
            'due_date: 2026-08-01',
            'achieved_at: "2026-08-02T10:00:00-07:00"',
          ].join('\n'),
        ),
      ).diagnostics.map((issue) => issue.code);

    expect(milestone(null)).toEqual(['milestone.status.missing']);
    expect(milestone('status: complete')).toEqual(['milestone.status.invalid']);
    expect(milestone('status: planned')).toEqual([
      'milestone.achieved_at.status_mismatch',
    ]);
    expect(milestone('status: achieved')).toEqual([]);
  });

  it('accepts an undated milestone and still rejects a malformed date', () => {
    const milestone = (dueDateLine: string | null) =>
      parseMarkdownEntity(
        sourceNote(
          'Milestones/Release.md',
          [
            'type: milestone',
            'project: "[[Projects/Game]]"',
            'status: planned',
            ...(dueDateLine === null ? [] : [dueDateLine]),
          ].join('\n'),
        ),
      );

    // the Scheduling and milestones spec / ADR 0024: order comes from `rank`, so a date is optional.
    expect(milestone(null).diagnostics).toEqual([]);
    expect(milestone('due_date:').diagnostics).toEqual([]);
    expect(milestone('due_date: 2026-08-01').diagnostics).toEqual([]);
    expect(
      milestone('due_date: 2026-02-30').diagnostics.map((issue) => issue.code),
    ).toEqual(['milestone.due_date.invalid']);
    expect(
      milestone('due_date: soon').diagnostics.map((issue) => issue.code),
    ).toEqual(['milestone.due_date.invalid']);
  });

  it('reads no due date for an undated milestone', () => {
    const entity = parseMarkdownEntity(
      sourceNote(
        'Milestones/Release.md',
        [
          'type: milestone',
          'project: "[[Projects/Game]]"',
          'status: planned',
        ].join('\n'),
      ),
    ).entity;

    expect(entity?.kind).toBe('milestone');
    expect(
      entity?.kind === 'milestone' ? entity.dueDate : undefined,
    ).toBeNull();
  });
});

describe('parseWikiLink', () => {
  it('separates path, heading, and alias', () => {
    expect(parseWikiLink('[[Design/Travel#Requirements|travel spec]]')).toEqual(
      {
        raw: '[[Design/Travel#Requirements|travel spec]]',
        linkpath: 'Design/Travel',
        heading: 'Requirements',
        alias: 'travel spec',
      },
    );
  });

  it('rejects plain paths and empty targets', () => {
    expect(parseWikiLink('Design/Travel')).toBeNull();
    expect(parseWikiLink('[[]]')).toBeNull();
  });
});
