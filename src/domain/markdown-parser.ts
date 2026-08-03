import { parseDocument } from 'yaml';

import {
  ENTITY_TYPES,
  EPIC_STATUSES,
  MILESTONE_STATUSES,
  PROJECT_STATUSES,
  SPRINT_STATUSES,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from './model';
import type {
  Diagnostic,
  EntityRecord,
  EntityType,
  EpicEntity,
  MilestoneEntity,
  ParsedMarkdownNote,
  ProjectEntity,
  ProjectWorkflow,
  SourceNote,
  SprintEntity,
  TaskEntity,
  WikiLink,
} from './model';

const FRONTMATTER_PATTERN =
  /^\uFEFF?---[\t ]*\r?\n([\s\S]*?)\r?\n---[\t ]*(?:\r?\n|$)/u;
const WIKI_LINK_PATTERN = /^\s*\[\[([^\]]+)\]\]\s*$/u;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/u;
const TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/u;

type Frontmatter = Record<string, unknown>;

export function normalizeVaultPath(path: string): string {
  return path.replaceAll('\\', '/').replace(/^\/+|\/+$/gu, '');
}

/** A note's leading YAML frontmatter and the Markdown body that follows it. */
export interface FrontmatterSplit {
  readonly yaml: string;
  readonly body: string;
}

/**
 * Split leading YAML frontmatter from the Markdown body, or return null when a
 * note has none. Every Project Weave reader — entity parsing and template
 * parsing alike — recognizes frontmatter through this one function.
 */
export function splitFrontmatter(content: string): FrontmatterSplit | null {
  const match = FRONTMATTER_PATTERN.exec(content);
  if (match === null) {
    return null;
  }
  return { yaml: match[1] ?? '', body: content.slice(match[0].length) };
}

export type FrontmatterMapping =
  | { readonly ok: true; readonly value: Readonly<Record<string, unknown>> }
  | {
      readonly ok: false;
      readonly reason: 'invalid' | 'invalid_value' | 'invalid_shape';
      readonly detail: string;
    };

/**
 * Parse frontmatter YAML into a plain mapping without resolving aliases.
 * Callers own the diagnostic codes so entity and template parsing keep their
 * own stable code namespaces.
 */
export function readFrontmatterMapping(yamlSource: string): FrontmatterMapping {
  const document = parseDocument(yamlSource, {
    prettyErrors: false,
    uniqueKeys: true,
  });

  if (document.errors.length > 0) {
    return {
      ok: false,
      reason: 'invalid',
      detail: document.errors[0]?.message ?? 'unknown YAML error',
    };
  }

  let parsed: unknown;
  try {
    parsed = document.toJS({ maxAliasCount: 0 }) as unknown;
  } catch (error) {
    return {
      ok: false,
      reason: 'invalid_value',
      detail: errorMessage(error),
    };
  }

  if (!isRecord(parsed)) {
    return { ok: false, reason: 'invalid_shape', detail: 'not a mapping' };
  }
  return { ok: true, value: parsed };
}

export function parseMarkdownEntity(source: SourceNote): ParsedMarkdownNote {
  const path = normalizeVaultPath(source.path);
  const split = splitFrontmatter(source.content);

  if (split === null) {
    return {
      entity: null,
      diagnostics: [],
      ignoredReason: 'ordinary_markdown',
    };
  }

  const mapping = readFrontmatterMapping(split.yaml);
  if (!mapping.ok) {
    return {
      entity: null,
      diagnostics: [frontmatterDiagnostic(path, mapping)],
    };
  }
  const parsed = mapping.value;

  if (parsed.weave_template === true) {
    return {
      entity: null,
      diagnostics: [],
      ignoredReason: 'template',
    };
  }

  if (parsed.type === undefined) {
    return {
      entity: null,
      diagnostics: [],
      ignoredReason: 'ordinary_markdown',
    };
  }

  if (typeof parsed.type !== 'string') {
    return {
      entity: null,
      diagnostics: [
        diagnostic(
          path,
          'entity.type.invalid',
          'error',
          'Frontmatter field `type` must be a string.',
          'type',
          'Use a supported entity type or remove the field from an ordinary note.',
        ),
      ],
    };
  }

  if (!isOneOf(parsed.type, ENTITY_TYPES)) {
    return {
      entity: null,
      diagnostics: [],
      ignoredReason: 'unsupported_type',
    };
  }

  const diagnostics: Diagnostic[] = [];
  const title = readTitle(parsed, path, diagnostics);
  const base = {
    path,
    title,
    fingerprint: source.fingerprint,
    frontmatter: parsed,
    diagnostics,
  } as const;

  let entity: EntityRecord;
  switch (parsed.type) {
    case 'project':
      entity = parseProject(base, parsed, diagnostics);
      break;
    case 'epic':
      entity = parseEpic(base, parsed, diagnostics);
      break;
    case 'task':
      entity = parseTask(base, parsed, diagnostics);
      break;
    case 'milestone':
      entity = parseMilestone(base, parsed, diagnostics);
      break;
    case 'sprint':
      entity = parseSprint(base, parsed, diagnostics);
      break;
  }

  return {
    entity: { ...entity, diagnostics: [...diagnostics] },
    diagnostics: [...diagnostics],
  };
}

export function parseWikiLink(value: unknown): WikiLink | null {
  if (typeof value !== 'string') {
    return null;
  }

  const match = WIKI_LINK_PATTERN.exec(value);
  const inner = match?.[1]?.trim();
  if (inner === undefined || inner.length === 0) {
    return null;
  }

  const aliasIndex = inner.indexOf('|');
  const target = (aliasIndex >= 0 ? inner.slice(0, aliasIndex) : inner).trim();
  const alias =
    aliasIndex >= 0 ? inner.slice(aliasIndex + 1).trim() : undefined;
  const headingIndex = target.indexOf('#');
  const linkpath = (
    headingIndex >= 0 ? target.slice(0, headingIndex) : target
  ).trim();
  const heading =
    headingIndex >= 0 ? target.slice(headingIndex + 1).trim() : undefined;

  if (linkpath.length === 0) {
    return null;
  }

  return {
    raw: value,
    linkpath,
    ...(heading === undefined || heading.length === 0 ? {} : { heading }),
    ...(alias === undefined || alias.length === 0 ? {} : { alias }),
  };
}

function parseProject(
  base: Omit<ProjectEntity, 'kind' | 'status' | 'statusExplicit' | 'workflow'>,
  frontmatter: Frontmatter,
  diagnostics: Diagnostic[],
): ProjectEntity {
  const statusExplicit = frontmatter.status !== undefined;
  const status = statusExplicit
    ? readControlled(
        frontmatter.status,
        PROJECT_STATUSES,
        base.path,
        'status',
        'project.status.invalid',
        diagnostics,
      )
    : 'active';

  return {
    ...base,
    kind: 'project',
    status: status ?? 'active',
    statusExplicit,
    workflow: parseWorkflow(frontmatter.weave, base.path, diagnostics),
  };
}

function parseEpic(
  base: Omit<EpicEntity, 'kind' | 'project' | 'status' | 'owner' | 'origin'>,
  frontmatter: Frontmatter,
  diagnostics: Diagnostic[],
): EpicEntity {
  return {
    ...base,
    kind: 'epic',
    project: readRequiredLink(
      frontmatter.project,
      base.path,
      'project',
      'epic.project',
      diagnostics,
    ),
    status: readRequiredControlled(
      frontmatter.status,
      EPIC_STATUSES,
      base.path,
      'status',
      'epic.status',
      diagnostics,
    ),
    owner: readOptionalString(
      frontmatter.owner,
      base.path,
      'owner',
      diagnostics,
    ),
    origin: readOptionalLink(
      frontmatter.origin,
      base.path,
      'origin',
      diagnostics,
    ),
  };
}

function parseTask(
  base: Omit<
    TaskEntity,
    | 'kind'
    | 'project'
    | 'status'
    | 'epic'
    | 'milestone'
    | 'planningPeriod'
    | 'owner'
    | 'points'
    | 'rank'
    | 'priority'
    | 'dueDate'
    | 'completedAt'
    | 'dependsOn'
    | 'origin'
  >,
  frontmatter: Frontmatter,
  diagnostics: Diagnostic[],
): TaskEntity {
  const status = readRequiredControlled(
    frontmatter.status,
    TASK_STATUSES,
    base.path,
    'status',
    'task.status',
    diagnostics,
  );
  const completedAt = readOptionalTimestamp(
    frontmatter.completed_at,
    base.path,
    'completed_at',
    'task.completed_at.invalid',
    diagnostics,
  );

  if (completedAt !== null && status !== null && status !== 'done') {
    diagnostics.push(
      diagnostic(
        base.path,
        'task.completed_at.status_mismatch',
        'error',
        '`completed_at` is valid only when task status is `done`.',
        'completed_at',
        'Set status to done or remove completed_at through an explicit edit.',
      ),
    );
  }

  return {
    ...base,
    kind: 'task',
    project: readRequiredLink(
      frontmatter.project,
      base.path,
      'project',
      'task.project',
      diagnostics,
    ),
    status,
    epic: readOptionalLink(frontmatter.epic, base.path, 'epic', diagnostics),
    milestone: readOptionalLink(
      frontmatter.milestone,
      base.path,
      'milestone',
      diagnostics,
    ),
    planningPeriod: readOptionalLink(
      frontmatter.sprint,
      base.path,
      'sprint',
      diagnostics,
    ),
    owner: readOptionalString(
      frontmatter.owner,
      base.path,
      'owner',
      diagnostics,
    ),
    points: readOptionalPositiveInteger(
      frontmatter.points,
      base.path,
      'points',
      'task.points.invalid',
      diagnostics,
    ),
    rank: readOptionalPositiveInteger(
      frontmatter.rank,
      base.path,
      'rank',
      'task.rank.invalid',
      diagnostics,
    ),
    priority: readControlled(
      frontmatter.priority,
      TASK_PRIORITIES,
      base.path,
      'priority',
      'task.priority.invalid',
      diagnostics,
      true,
    ),
    dueDate: readOptionalDate(
      frontmatter.due_date,
      base.path,
      'due_date',
      'task.due_date.invalid',
      diagnostics,
    ),
    completedAt,
    dependsOn: readLinkList(
      frontmatter.depends_on,
      base.path,
      'depends_on',
      diagnostics,
    ),
    origin: readOptionalLink(
      frontmatter.origin,
      base.path,
      'origin',
      diagnostics,
    ),
  };
}

function parseMilestone(
  base: Omit<
    MilestoneEntity,
    | 'kind'
    | 'project'
    | 'status'
    | 'dueDate'
    | 'achievedAt'
    | 'owner'
    | 'origin'
  >,
  frontmatter: Frontmatter,
  diagnostics: Diagnostic[],
): MilestoneEntity {
  const status = readRequiredControlled(
    frontmatter.status,
    MILESTONE_STATUSES,
    base.path,
    'status',
    'milestone.status',
    diagnostics,
  );
  const achievedAt = readOptionalTimestamp(
    frontmatter.achieved_at,
    base.path,
    'achieved_at',
    'milestone.achieved_at.invalid',
    diagnostics,
  );

  if (achievedAt !== null && status !== null && status !== 'achieved') {
    diagnostics.push(
      diagnostic(
        base.path,
        'milestone.achieved_at.status_mismatch',
        'error',
        '`achieved_at` is valid only when milestone status is `achieved`.',
        'achieved_at',
      ),
    );
  }

  return {
    ...base,
    kind: 'milestone',
    project: readRequiredLink(
      frontmatter.project,
      base.path,
      'project',
      'milestone.project',
      diagnostics,
    ),
    status,
    dueDate: readRequiredDate(
      frontmatter.due_date,
      base.path,
      'due_date',
      'milestone.due_date',
      diagnostics,
    ),
    achievedAt,
    owner: readOptionalString(
      frontmatter.owner,
      base.path,
      'owner',
      diagnostics,
    ),
    origin: readOptionalLink(
      frontmatter.origin,
      base.path,
      'origin',
      diagnostics,
    ),
  };
}

function parseSprint(
  base: Omit<
    SprintEntity,
    | 'kind'
    | 'scope'
    | 'project'
    | 'projects'
    | 'status'
    | 'startDate'
    | 'endDate'
    | 'goal'
  >,
  frontmatter: Frontmatter,
  diagnostics: Diagnostic[],
): SprintEntity {
  const scope = readRequiredControlled(
    frontmatter.scope,
    ['project', 'portfolio'] as const,
    base.path,
    'scope',
    'sprint.scope',
    diagnostics,
  );

  return {
    ...base,
    kind: 'sprint',
    scope,
    project:
      scope === 'project'
        ? readRequiredLink(
            frontmatter.project,
            base.path,
            'project',
            'sprint.project',
            diagnostics,
          )
        : readOptionalLink(
            frontmatter.project,
            base.path,
            'project',
            diagnostics,
          ),
    projects:
      scope === 'portfolio'
        ? readLinkList(
            frontmatter.projects,
            base.path,
            'projects',
            diagnostics,
            true,
          )
        : [],
    status: readRequiredControlled(
      frontmatter.status,
      SPRINT_STATUSES,
      base.path,
      'status',
      'sprint.status',
      diagnostics,
    ),
    startDate: readOptionalDate(
      frontmatter.start_date,
      base.path,
      'start_date',
      'sprint.start_date.invalid',
      diagnostics,
    ),
    endDate: readOptionalDate(
      frontmatter.end_date,
      base.path,
      'end_date',
      'sprint.end_date.invalid',
      diagnostics,
    ),
    goal: readOptionalString(frontmatter.goal, base.path, 'goal', diagnostics),
  };
}

function parseWorkflow(
  value: unknown,
  path: string,
  diagnostics: Diagnostic[],
): ProjectWorkflow {
  const defaults: ProjectWorkflow = {
    dependencyMode: 'enforced',
    planningPeriodLabel: 'sprint',
    estimation: null,
    ownerRequiredOnBoard: false,
    estimateRequiredInPeriod: false,
  };

  if (value === undefined) {
    return defaults;
  }

  if (!isRecord(value)) {
    diagnostics.push(
      diagnostic(
        path,
        'project.weave.invalid',
        'error',
        '`weave` must be a mapping when present.',
        'weave',
      ),
    );
    return defaults;
  }

  const dependencyMode = readControlled(
    value.dependency_mode,
    ['enforced', 'advisory'] as const,
    path,
    'weave.dependency_mode',
    'project.weave.dependency_mode.invalid',
    diagnostics,
    true,
  );
  const planningPeriodLabel = readControlled(
    value.planning_period_label,
    ['sprint', 'cycle', 'period'] as const,
    path,
    'weave.planning_period_label',
    'project.weave.planning_period_label.invalid',
    diagnostics,
    true,
  );
  const estimation = readControlled(
    value.estimation,
    ['points'] as const,
    path,
    'weave.estimation',
    'project.weave.estimation.invalid',
    diagnostics,
    true,
  );
  const policies = value.policies;

  if (policies !== undefined && !isRecord(policies)) {
    diagnostics.push(
      diagnostic(
        path,
        'project.weave.policies.invalid',
        'error',
        '`weave.policies` must be a mapping when present.',
        'weave.policies',
      ),
    );
  }

  return {
    dependencyMode: dependencyMode ?? defaults.dependencyMode,
    planningPeriodLabel: planningPeriodLabel ?? defaults.planningPeriodLabel,
    estimation,
    ownerRequiredOnBoard: readOptionalBoolean(
      isRecord(policies) ? policies.owner_required_on_board : undefined,
      path,
      'weave.policies.owner_required_on_board',
      diagnostics,
    ),
    estimateRequiredInPeriod: readOptionalBoolean(
      isRecord(policies) ? policies.estimate_required_in_period : undefined,
      path,
      'weave.policies.estimate_required_in_period',
      diagnostics,
    ),
  };
}

function readTitle(
  frontmatter: Frontmatter,
  path: string,
  diagnostics: Diagnostic[],
): string {
  if (frontmatter.title === undefined) {
    return filenameStem(path);
  }
  if (
    typeof frontmatter.title === 'string' &&
    frontmatter.title.trim().length > 0
  ) {
    return frontmatter.title.trim();
  }
  diagnostics.push(
    diagnostic(
      path,
      'entity.title.invalid',
      'warning',
      '`title` must be a non-empty string; the filename is used for display.',
      'title',
    ),
  );
  return filenameStem(path);
}

function readRequiredLink(
  value: unknown,
  path: string,
  field: string,
  codePrefix: string,
  diagnostics: Diagnostic[],
): WikiLink | null {
  if (value === undefined || value === null || value === '') {
    diagnostics.push(
      diagnostic(
        path,
        `${codePrefix}.missing`,
        'error',
        `Required field \`${field}\` is missing.`,
        field,
      ),
    );
    return null;
  }
  const link = parseWikiLink(value);
  if (link === null) {
    diagnostics.push(
      diagnostic(
        path,
        `${codePrefix}.invalid`,
        'error',
        `Field \`${field}\` must be one Obsidian wiki link.`,
        field,
      ),
    );
  }
  return link;
}

function readOptionalLink(
  value: unknown,
  path: string,
  field: string,
  diagnostics: Diagnostic[],
): WikiLink | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const link = parseWikiLink(value);
  if (link === null) {
    diagnostics.push(
      diagnostic(
        path,
        `${field}.invalid_link`,
        'error',
        `Field \`${field}\` must be one Obsidian wiki link when present.`,
        field,
      ),
    );
  }
  return link;
}

function readLinkList(
  value: unknown,
  path: string,
  field: string,
  diagnostics: Diagnostic[],
  required = false,
): readonly WikiLink[] {
  if (value === undefined || value === null || value === '') {
    if (required) {
      diagnostics.push(
        diagnostic(
          path,
          `${field}.missing`,
          'error',
          `Required field \`${field}\` is missing.`,
          field,
        ),
      );
    }
    return [];
  }

  const values = Array.isArray(value) ? value : [value];
  const links: WikiLink[] = [];
  for (const item of values) {
    const link = parseWikiLink(item);
    if (link === null) {
      diagnostics.push(
        diagnostic(
          path,
          `${field}.invalid_link`,
          'error',
          `Every value in \`${field}\` must be an Obsidian wiki link.`,
          field,
        ),
      );
      continue;
    }
    links.push(link);
  }
  return links;
}

function readRequiredControlled<T extends string>(
  value: unknown,
  allowed: readonly T[],
  path: string,
  field: string,
  codePrefix: string,
  diagnostics: Diagnostic[],
): T | null {
  if (value === undefined || value === null || value === '') {
    diagnostics.push(
      diagnostic(
        path,
        `${codePrefix}.missing`,
        'error',
        `Required field \`${field}\` is missing.`,
        field,
      ),
    );
    return null;
  }
  return readControlled(
    value,
    allowed,
    path,
    field,
    `${codePrefix}.invalid`,
    diagnostics,
  );
}

function readControlled<T extends string>(
  value: unknown,
  allowed: readonly T[],
  path: string,
  field: string,
  code: string,
  diagnostics: Diagnostic[],
  optional = false,
): T | null {
  if (value === undefined || value === null || value === '') {
    return optional ? null : null;
  }
  if (typeof value === 'string' && isOneOf(value, allowed)) {
    return value;
  }
  diagnostics.push(
    diagnostic(
      path,
      code,
      'error',
      `Field \`${field}\` must be one of: ${allowed.join(', ')}.`,
      field,
    ),
  );
  return null;
}

function readOptionalPositiveInteger(
  value: unknown,
  path: string,
  field: string,
  code: string,
  diagnostics: Diagnostic[],
): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }
  diagnostics.push(
    diagnostic(
      path,
      code,
      'error',
      `Field \`${field}\` must be a positive integer.`,
      field,
    ),
  );
  return null;
}

function readRequiredDate(
  value: unknown,
  path: string,
  field: string,
  codePrefix: string,
  diagnostics: Diagnostic[],
): string | null {
  if (value === undefined || value === null || value === '') {
    diagnostics.push(
      diagnostic(
        path,
        `${codePrefix}.missing`,
        'error',
        `Required field \`${field}\` is missing.`,
        field,
      ),
    );
    return null;
  }
  return readOptionalDate(
    value,
    path,
    field,
    `${codePrefix}.invalid`,
    diagnostics,
  );
}

function readOptionalDate(
  value: unknown,
  path: string,
  field: string,
  code: string,
  diagnostics: Diagnostic[],
): string | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value === 'string' && isCalendarDate(value)) {
    return value;
  }
  diagnostics.push(
    diagnostic(
      path,
      code,
      'error',
      `Field \`${field}\` must be a real calendar date in YYYY-MM-DD form.`,
      field,
    ),
  );
  return null;
}

function readOptionalTimestamp(
  value: unknown,
  path: string,
  field: string,
  code: string,
  diagnostics: Diagnostic[],
): string | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (
    typeof value === 'string' &&
    TIMESTAMP_PATTERN.test(value) &&
    Number.isFinite(Date.parse(value))
  ) {
    return value;
  }
  diagnostics.push(
    diagnostic(
      path,
      code,
      'error',
      `Field \`${field}\` must be an ISO 8601 timestamp with an offset.`,
      field,
    ),
  );
  return null;
}

function readOptionalString(
  value: unknown,
  path: string,
  field: string,
  diagnostics: Diagnostic[],
): string | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  diagnostics.push(
    diagnostic(
      path,
      `${field}.invalid`,
      'error',
      `Field \`${field}\` must be a non-empty string when present.`,
      field,
    ),
  );
  return null;
}

function readOptionalBoolean(
  value: unknown,
  path: string,
  field: string,
  diagnostics: Diagnostic[],
): boolean {
  if (value === undefined || value === null || value === '') {
    return false;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  diagnostics.push(
    diagnostic(
      path,
      `${field}.invalid`,
      'error',
      `Field \`${field}\` must be true or false when present.`,
      field,
    ),
  );
  return false;
}

function isCalendarDate(value: string): boolean {
  const match = DATE_PATTERN.exec(value);
  if (match === null) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function filenameStem(path: string): string {
  const filename = path.split('/').at(-1) ?? path;
  return filename.toLowerCase().endsWith('.md')
    ? filename.slice(0, -3)
    : filename;
}

function diagnostic(
  path: string,
  code: string,
  severity: Diagnostic['severity'],
  message: string,
  field?: string,
  recovery?: string,
): Diagnostic {
  return {
    path,
    code,
    severity,
    message,
    ...(field === undefined ? {} : { field }),
    ...(recovery === undefined ? {} : { recovery }),
  };
}

function frontmatterDiagnostic(
  path: string,
  mapping: Extract<FrontmatterMapping, { ok: false }>,
): Diagnostic {
  switch (mapping.reason) {
    case 'invalid':
      return diagnostic(
        path,
        'note.frontmatter.invalid',
        'error',
        `Frontmatter could not be parsed: ${mapping.detail}`,
        undefined,
        'Correct the YAML frontmatter, then rebuild the Project Weave index.',
      );
    case 'invalid_value':
      return diagnostic(
        path,
        'note.frontmatter.invalid_value',
        'error',
        `Frontmatter could not be converted safely: ${mapping.detail}`,
        undefined,
        'Remove YAML aliases or unsupported values, then rebuild the index.',
      );
    case 'invalid_shape':
      return diagnostic(
        path,
        'note.frontmatter.invalid_shape',
        'error',
        'Frontmatter must be a YAML mapping.',
        undefined,
        'Replace the frontmatter value with key-value properties.',
      );
  }
}

function isRecord(value: unknown): value is Frontmatter {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isOneOf<T extends string>(
  value: string,
  choices: readonly T[],
): value is T {
  return choices.some((choice) => choice === value);
}

export function isSupportedEntityType(value: string): value is EntityType {
  return isOneOf(value, ENTITY_TYPES);
}
