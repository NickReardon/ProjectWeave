import { parseWikiLink } from '../markdown-parser';
import type { Diagnostic, TaskPriority, TaskStatus } from '../model';
import type { ResolvedInput } from './creation-context';
import {
  applyCreationProfile,
  TASK_CREATION_PROFILE,
} from './creation-profile';
import {
  applyContextPrecedence,
  applyInvariants,
  createResolver,
  optionalInteger,
  optionalList,
  optionalText,
  required,
  resolveInputs,
  validateRenderedKind,
  validateTargetPath,
} from './creation-context';
import { hasError, templateDiagnostic } from './model';
import type {
  ResolvedVariable,
  TemplateClock,
  TemplateRenderResult,
  TemplateSource,
  VariableResolver,
} from './model';
import { renderBody, resolveProperties, serializeNote } from './render-engine';
import { parseTemplateDocument } from './template-parser';
import type { TemplateMetadata } from './template-parser';

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
    BUILTIN_TASK_VARIABLES,
    path,
    diagnostics,
  );
  const resolve = taskResolver(document.metadata, context, invariants, inputs);

  const properties = applyContextPrecedence(
    document.properties,
    resolve,
    CONTEXT_OWNED_PROPERTIES,
  );
  const resolved = resolveProperties(path, properties, resolve, diagnostics);
  const profiled = applyCreationProfile(
    resolved,
    TASK_CREATION_PROFILE,
    resolve,
    path,
    diagnostics,
  );
  const overlaid = applyInvariants(
    profiled,
    [
      { key: 'type', value: 'task' },
      { key: 'project', value: invariants.projectLink },
    ],
    'task',
    path,
    diagnostics,
  );
  const body = renderBody(path, document.body, resolve, diagnostics);
  const content = serializeNote(overlaid, body);

  // Validate the assembled note only once it is worth validating: a template
  // error already explains why fields are missing, and re-reporting them as
  // note errors would bury the actionable cause.
  if (targetPath !== null && !hasError(diagnostics)) {
    diagnostics.push(...validateRenderedKind(targetPath, content, 'task'));
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

function taskResolver(
  metadata: TemplateMetadata,
  context: TaskTemplateContext,
  invariants: TaskTemplateInvariants,
  inputs: Map<string, ResolvedInput>,
): VariableResolver {
  return createResolver({
    metadata,
    clock: context.clock,
    inputs,
    builtins: BUILTIN_TASK_VARIABLES,
    resolveBuiltin: (name) =>
      resolveBuiltin(name, metadata, context, invariants),
  });
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
