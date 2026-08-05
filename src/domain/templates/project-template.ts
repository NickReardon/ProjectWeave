import type { Diagnostic, ProjectStatus } from '../model';
import {
  applyContextPrecedence,
  applyInvariants,
  createResolver,
  optionalText,
  required,
  resolveInputs,
  validateRenderedKind,
  validateTargetPath,
} from './creation-context';
import type { ResolvedInput } from './creation-context';
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
 * Deterministic creation context for one project. As with a task, the renderer
 * reads no ambient time, environment, network, or files: every value it can use
 * arrives through this request.
 *
 * A project is the root of its own scope, so this context carries no project
 * relation, no rank, and no dependencies: it is deliberately the smaller of the
 * two contexts.
 */
export interface ProjectTemplateContext {
  readonly title: string;
  readonly clock: TemplateClock;
  readonly status?: ProjectStatus | null;
}

/**
 * Values a template can never override. A project has no project relation to
 * fix, so the entity type and a safe normalized target path are the whole set.
 */
export interface ProjectTemplateInvariants {
  readonly targetPath: string;
}

export interface ProjectTemplateRequest {
  readonly template: TemplateSource;
  readonly context: ProjectTemplateContext;
  readonly invariants: ProjectTemplateInvariants;
  readonly inputs?: Readonly<Record<string, unknown>>;
}

/** Built-in variables a project creation context can resolve. */
const BUILTIN_PROJECT_VARIABLES = new Set([
  'title',
  'date',
  'time',
  'datetime',
  'target_path',
  'template_name',
  'status',
]);

/**
 * Project frontmatter properties whose value the creation context owns. Where a
 * template hard-codes one of these and the context supplies a value, the
 * context wins.
 *
 * `status` is here but usually stays with the template: the packaged project
 * template ships `planned`, and a caller that does not choose a status leaves
 * that default in place rather than overriding it with the parser's `active`.
 */
const CONTEXT_OWNED_PROPERTIES: Readonly<Record<string, string>> = {
  title: 'title',
  status: 'status',
};

/**
 * Render one project note from a template.
 *
 * Same shape as task rendering, and deliberately so: precedence runs from
 * template static values through creation-context defaults and explicit typed
 * inputs to the invariant overlay, and a clean result is re-parsed as a project
 * before it is returned. Diagnostics are returned rather than thrown; `ok` is
 * false when any of them is an error, in which case no note is produced.
 */
export function renderProjectTemplate(
  request: ProjectTemplateRequest,
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

  const inputs = resolveInputs(
    document.metadata.inputs,
    request.inputs ?? {},
    BUILTIN_PROJECT_VARIABLES,
    path,
    diagnostics,
  );
  const resolve = projectResolver(
    document.metadata,
    context,
    invariants,
    inputs,
  );

  const properties = applyContextPrecedence(
    document.properties,
    resolve,
    CONTEXT_OWNED_PROPERTIES,
  );
  const resolved = resolveProperties(path, properties, resolve, diagnostics);
  const overlaid = applyInvariants(
    resolved,
    [{ key: 'type', value: 'project' }],
    'project',
    path,
    diagnostics,
  );
  const body = renderBody(path, document.body, resolve, diagnostics);
  const content = serializeNote(overlaid, body);

  // Validate the assembled note only once it is worth validating: a template
  // error already explains why fields are missing, and re-reporting them as
  // note errors would bury the actionable cause.
  if (targetPath !== null && !hasError(diagnostics)) {
    diagnostics.push(...validateRenderedKind(targetPath, content, 'project'));
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
  if (metadata.templateFor !== null && metadata.templateFor !== 'project') {
    diagnostics.push(
      templateDiagnostic(
        path,
        'template.kind_mismatch',
        'error',
        `This template declares \`template_for: ${metadata.templateFor}\` but is being rendered as a project.`,
        'template_for',
        'Select a project template, or render this template for its declared kind.',
      ),
    );
  }
}

function projectResolver(
  metadata: TemplateMetadata,
  context: ProjectTemplateContext,
  invariants: ProjectTemplateInvariants,
  inputs: Map<string, ResolvedInput>,
): VariableResolver {
  return createResolver({
    metadata,
    clock: context.clock,
    inputs,
    builtins: BUILTIN_PROJECT_VARIABLES,
    resolveBuiltin: (name) =>
      resolveBuiltin(name, metadata, context, invariants),
  });
}

function resolveBuiltin(
  name: string,
  metadata: TemplateMetadata,
  context: ProjectTemplateContext,
  invariants: ProjectTemplateInvariants,
): ResolvedVariable {
  switch (name) {
    case 'title':
      return required(context.title);
    case 'target_path':
      return required(invariants.targetPath);
    case 'template_name':
      return optionalText(metadata.templateName);
    case 'status':
      return optionalText(context.status);
    default:
      return { status: 'unknown' };
  }
}
