import {
  normalizeVaultPath,
  parseMarkdownEntity,
  parseWikiLink,
} from '../markdown-parser';
import type { Diagnostic, TaskPriority, TaskStatus } from '../model';
import { formatClock, hasError, templateDiagnostic } from './model';
import type {
  ResolvedVariable,
  TemplateClock,
  TemplateInputDeclaration,
  TemplateRenderResult,
  TemplateSource,
  TemplateValue,
  VariableResolver,
} from './model';
import { renderBody, resolveProperties, serializeNote } from './render-engine';
import type { RenderedProperty } from './render-engine';
import { coerceInputValue, parseTemplateDocument } from './template-parser';
import type { TemplateMetadata, TemplateProperty } from './template-parser';

/**
 * Deterministic creation context for one task. Context defaults and explicit
 * typed fields are already merged here by the caller, in that precedence
 * order. The renderer reads no ambient time, environment, network, or files:
 * every value it can use arrives through this request.
 */
export interface TaskTemplateContext {
  readonly title: string;
  readonly status: TaskStatus;
  readonly clock: TemplateClock;
  readonly projectTitle?: string | null;
  readonly projectPath?: string | null;
  readonly epicLink?: string | null;
  readonly milestoneLink?: string | null;
  readonly planningPeriodLink?: string | null;
  readonly originLink?: string | null;
  readonly owner?: string | null;
  readonly priority?: TaskPriority | null;
  readonly points?: number | null;
  readonly rank?: number | null;
  readonly dueDate?: string | null;
  readonly dependencyLinks?: readonly string[];
}

/**
 * Values a template can never override. Design 18 fixes the entity type, the
 * selected project relation, and a safe normalized target path; its remaining
 * invariants depend on services this slice does not implement.
 */
export interface TaskTemplateInvariants {
  readonly projectLink: string;
  readonly targetPath: string;
}

export interface TaskTemplateRequest {
  readonly template: TemplateSource;
  readonly context: TaskTemplateContext;
  readonly invariants: TaskTemplateInvariants;
  readonly inputs?: Readonly<Record<string, unknown>>;
}

/** Built-in variables a task creation context can resolve (Design 18). */
const BUILTIN_TASK_VARIABLES = new Set([
  'title',
  'date',
  'time',
  'datetime',
  'project_title',
  'project_link',
  'project_path',
  'target_path',
  'template_name',
  'status',
  'origin_link',
  'epic_link',
  'milestone_link',
  'planning_period_link',
  'owner',
  'priority',
  'points',
  'rank',
  'due_date',
  'dependency_links',
]);

/** Default formats for the date and time variables. */
const CLOCK_VARIABLES: Readonly<Record<string, string>> = {
  date: 'YYYY-MM-DD',
  time: 'HH:mm',
  datetime: 'YYYY-MM-DD[T]HH:mm',
};

/**
 * Task frontmatter properties whose value the creation context owns. Where a
 * template hard-codes one of these and the context supplies a value, the
 * context wins: that is the Design 18 precedence ladder applied to a static
 * template default.
 */
const CONTEXT_OWNED_PROPERTIES: Readonly<Record<string, string>> = {
  title: 'title',
  status: 'status',
  epic: 'epic_link',
  milestone: 'milestone_link',
  sprint: 'planning_period_link',
  owner: 'owner',
  priority: 'priority',
  points: 'points',
  rank: 'rank',
  due_date: 'due_date',
  depends_on: 'dependency_links',
  origin: 'origin_link',
};

/**
 * Render one task note from a template.
 *
 * Precedence runs from template static values, through creation-context
 * defaults and explicit typed inputs, to the invariant overlay. Template-only
 * metadata is removed, unset optional properties are omitted, and a clean
 * result is re-parsed as a task before it is returned. Diagnostics are
 * returned rather than thrown; `ok` is false when any of them is an error, in
 * which case no note is produced.
 */
export function renderTaskTemplate(
  request: TaskTemplateRequest,
): TemplateRenderResult {
  const { context, invariants } = request;
  const document = parseTemplateDocument(request.template);
  const path = document.path;
  const diagnostics: Diagnostic[] = [...document.diagnostics];

  validateKind(document.metadata, path, diagnostics);
  const targetPath = validateTargetPath(
    invariants.targetPath,
    path,
    diagnostics,
  );
  validateProjectLink(invariants.projectLink, path, diagnostics);

  const inputs = resolveInputs(
    document.metadata.inputs,
    request.inputs ?? {},
    path,
    diagnostics,
  );
  const resolve = taskResolver(document.metadata, context, invariants, inputs);

  const properties = applyContextPrecedence(document.properties, resolve);
  const resolved = resolveProperties(path, properties, resolve, diagnostics);
  const overlaid = applyInvariants(resolved, invariants, path, diagnostics);
  const body = renderBody(path, document.body, resolve, diagnostics);
  const content = serializeNote(overlaid, body);

  // Validate the assembled note only once it is worth validating: a template
  // error already explains why fields are missing, and re-reporting them as
  // note errors would bury the actionable cause.
  if (targetPath !== null && !hasError(diagnostics)) {
    diagnostics.push(...validateRenderedTask(targetPath, content));
  }

  const ok = !hasError(diagnostics);
  return {
    ok,
    note: ok && targetPath !== null ? { targetPath, content } : null,
    diagnostics,
  };
}

function validateKind(
  metadata: TemplateMetadata,
  path: string,
  diagnostics: Diagnostic[],
): void {
  if (metadata.templateFor !== null && metadata.templateFor !== 'task') {
    diagnostics.push(
      templateDiagnostic(
        path,
        'template.kind_mismatch',
        'error',
        `This template declares \`template_for: ${metadata.templateFor}\` but is being rendered as a task.`,
        'template_for',
        'Select a task template, or render this template for its declared kind.',
      ),
    );
  }
}

/**
 * The rendered note must land on a safe, normalized vault path to a Markdown
 * file. Returns that path, or null when the request cannot produce a note.
 */
function validateTargetPath(
  raw: string,
  path: string,
  diagnostics: Diagnostic[],
): string | null {
  const normalized = normalizeVaultPath(raw);
  const unsafe =
    normalized.length === 0 ||
    !normalized.toLowerCase().endsWith('.md') ||
    hasControlCharacter(normalized) ||
    normalized
      .split('/')
      .some(
        (segment) =>
          segment.length === 0 || segment === '.' || segment === '..',
      );

  if (unsafe) {
    diagnostics.push(
      templateDiagnostic(
        path,
        'template.invariant.target_path',
        'error',
        `\`${raw}\` is not a safe target path for a new note.`,
        'target_path',
        'Use a normalized vault-relative path that ends in `.md`.',
      ),
    );
    return null;
  }
  return normalized;
}

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) {
      return true;
    }
  }
  return false;
}

function validateProjectLink(
  raw: string,
  path: string,
  diagnostics: Diagnostic[],
): void {
  if (parseWikiLink(raw) === null) {
    diagnostics.push(
      templateDiagnostic(
        path,
        'template.invariant.project_link',
        'error',
        `\`${raw}\` is not one Obsidian wiki link to the selected project.`,
        'project',
        'Supply the selected project as a `[[link]]`.',
      ),
    );
  }
}

interface ResolvedInput {
  readonly value: TemplateValue | null;
}

/**
 * Validate supplied values against the template's declared inputs. Only
 * declared inputs may be supplied, so a caller cannot introduce undeclared
 * variables, and a declared input may not shadow a built-in variable.
 */
function resolveInputs(
  declarations: readonly TemplateInputDeclaration[],
  supplied: Readonly<Record<string, unknown>>,
  path: string,
  diagnostics: Diagnostic[],
): Map<string, ResolvedInput> {
  const resolved = new Map<string, ResolvedInput>();
  const declared = new Set(declarations.map((declaration) => declaration.name));

  for (const name of Object.keys(supplied)) {
    if (!declared.has(name)) {
      diagnostics.push(
        templateDiagnostic(
          path,
          'template.input.undeclared',
          'error',
          `Input \`${name}\` is not declared by this template.`,
          name,
          'Supply only inputs listed under `template_inputs`.',
        ),
      );
    }
  }

  for (const declaration of declarations) {
    if (BUILTIN_TASK_VARIABLES.has(declaration.name)) {
      diagnostics.push(
        templateDiagnostic(
          path,
          'template.input.reserved_name',
          'error',
          `Input \`${declaration.name}\` shadows a built-in variable; built-in context variables do not need declaring.`,
          `template_inputs.${declaration.name}`,
        ),
      );
      continue;
    }

    const raw = Object.prototype.hasOwnProperty.call(supplied, declaration.name)
      ? supplied[declaration.name]
      : undefined;

    if (raw === undefined || raw === null) {
      const fallback = declaration.defaultValue ?? null;
      if (declaration.required && fallback === null) {
        diagnostics.push(
          templateDiagnostic(
            path,
            'template.input.required',
            'error',
            `Input \`${declaration.name}\` is required by this template.`,
            declaration.name,
          ),
        );
      }
      resolved.set(declaration.name, { value: fallback });
      continue;
    }

    const value = coerceInputValue(declaration.type, raw);
    if (value === null) {
      diagnostics.push(
        templateDiagnostic(
          path,
          'template.input.value_invalid',
          'error',
          `Input \`${declaration.name}\` must be a ${declaration.type} value.`,
          declaration.name,
        ),
      );
      resolved.set(declaration.name, { value: null });
      continue;
    }
    resolved.set(declaration.name, { value });
  }

  return resolved;
}

function taskResolver(
  metadata: TemplateMetadata,
  context: TaskTemplateContext,
  invariants: TaskTemplateInvariants,
  inputs: Map<string, ResolvedInput>,
): VariableResolver {
  return (token: string): ResolvedVariable => {
    const separator = token.indexOf(':');
    const name = separator === -1 ? token : token.slice(0, separator);
    const format = separator === -1 ? null : token.slice(separator + 1);

    const clockFormat = CLOCK_VARIABLES[name];
    if (clockFormat !== undefined) {
      const formatted =
        format === ''
          ? null
          : formatClock(context.clock, format ?? clockFormat);
      return formatted === null
        ? {
            status: 'error',
            code: 'template.variable.format_invalid',
            message: `\`${token}\` uses an unsupported date or time format.`,
            recovery:
              'Compose the format from YYYY, MM, DD, HH, mm, and ss with literal separators.',
          }
        : { status: 'value', value: { kind: 'string', value: formatted } };
    }

    const input = inputs.get(name);
    if (format !== null) {
      return input !== undefined || BUILTIN_TASK_VARIABLES.has(name)
        ? {
            status: 'error',
            code: 'template.variable.format_unsupported',
            message: `Variable \`${name}\` does not accept a \`:format\` suffix.`,
            recovery:
              'Only the date, time, and datetime variables accept a format.',
          }
        : { status: 'unknown' };
    }
    if (input !== undefined) {
      return input.value === null
        ? { status: 'unset', optional: true }
        : { status: 'value', value: input.value };
    }
    return resolveBuiltin(name, metadata, context, invariants);
  };
}

function resolveBuiltin(
  name: string,
  metadata: TemplateMetadata,
  context: TaskTemplateContext,
  invariants: TaskTemplateInvariants,
): ResolvedVariable {
  switch (name) {
    case 'title':
      return required(context.title);
    case 'status':
      return required(context.status);
    case 'project_link':
      return required(invariants.projectLink);
    case 'target_path':
      return required(invariants.targetPath);
    case 'template_name':
      return optionalText(metadata.templateName);
    case 'project_title':
      return optionalText(context.projectTitle);
    case 'project_path':
      return optionalText(context.projectPath);
    case 'origin_link':
      return optionalText(context.originLink);
    case 'epic_link':
      return optionalText(context.epicLink);
    case 'milestone_link':
      return optionalText(context.milestoneLink);
    case 'planning_period_link':
      return optionalText(context.planningPeriodLink);
    case 'owner':
      return optionalText(context.owner);
    case 'priority':
      return optionalText(context.priority);
    case 'due_date':
      return optionalText(context.dueDate);
    case 'points':
      return optionalInteger(context.points);
    case 'rank':
      return optionalInteger(context.rank);
    case 'dependency_links':
      return optionalList(context.dependencyLinks);
    default:
      return { status: 'unknown' };
  }
}

/**
 * Rewrite static properties the creation context owns into placeholders, so
 * context values take precedence over template defaults. A property the
 * context leaves unset keeps its template default.
 */
function applyContextPrecedence(
  properties: readonly TemplateProperty[],
  resolve: VariableResolver,
): readonly TemplateProperty[] {
  return properties.map((property) => {
    if (property.source !== 'static') {
      return property;
    }
    const token = CONTEXT_OWNED_PROPERTIES[property.key];
    if (token === undefined || resolve(token).status !== 'value') {
      return property;
    }
    return { key: property.key, source: 'placeholder', token };
  });
}

/**
 * Overlay the invariants a template cannot change. A template that hard-codes
 * a conflicting value is an error rather than a silent correction.
 */
function applyInvariants(
  properties: readonly RenderedProperty[],
  invariants: TaskTemplateInvariants,
  path: string,
  diagnostics: Diagnostic[],
): readonly RenderedProperty[] {
  const overlay: readonly RenderedProperty[] = [
    { key: 'type', value: 'task' },
    { key: 'project', value: invariants.projectLink },
  ];

  let result = properties;
  for (const invariant of overlay) {
    const existing = result.find((property) => property.key === invariant.key);
    if (existing === undefined) {
      result = [invariant, ...result];
      continue;
    }
    if (existing.value !== invariant.value) {
      diagnostics.push(
        templateDiagnostic(
          path,
          `template.invariant.${invariant.key}`,
          'error',
          `A task template cannot change \`${invariant.key}\`; this creation requires the selected value.`,
          invariant.key,
          'Remove the conflicting value from the template, or use the matching placeholder.',
        ),
      );
    }
    result = result.map((property) =>
      property.key === invariant.key ? invariant : property,
    );
  }
  return result;
}

/**
 * Re-parse the complete rendered note as a task. This is the same validation
 * an indexed note receives, so a template cannot produce a note Project Weave
 * would later report as invalid.
 */
function validateRenderedTask(
  targetPath: string,
  content: string,
): readonly Diagnostic[] {
  const parsed = parseMarkdownEntity({
    path: targetPath,
    content,
    fingerprint: 'render',
  });

  if (parsed.entity?.kind !== 'task') {
    return [
      ...parsed.diagnostics,
      templateDiagnostic(
        targetPath,
        'template.output.not_a_task',
        'error',
        'The rendered note is not a task note.',
        'type',
        'Check the template frontmatter for a conflicting or unsupported `type`.',
      ),
    ];
  }
  return parsed.diagnostics;
}

function required(value: string): ResolvedVariable {
  return value.length > 0
    ? { status: 'value', value: { kind: 'string', value } }
    : { status: 'unset', optional: false };
}

function optionalText(value: string | null | undefined): ResolvedVariable {
  return value === null || value === undefined || value.length === 0
    ? { status: 'unset', optional: true }
    : { status: 'value', value: { kind: 'string', value } };
}

function optionalInteger(value: number | null | undefined): ResolvedVariable {
  return value === null || value === undefined
    ? { status: 'unset', optional: true }
    : { status: 'value', value: { kind: 'integer', value } };
}

function optionalList(value: readonly string[] | undefined): ResolvedVariable {
  return value === undefined || value.length === 0
    ? { status: 'unset', optional: true }
    : { status: 'value', value: { kind: 'list', value: [...value] } };
}
