import { parseWikiLink } from '../domain/markdown-parser';
import type { Diagnostic, ProjectEntity } from '../domain/model';
import {
  PACKAGED_MINIMAL_TASK_TEMPLATE,
  PACKAGED_MINIMAL_TEMPLATE_ID,
} from '../domain/templates/packaged-templates';
import { hasError, templateDiagnostic } from '../domain/templates/model';
import type { TemplateSource } from '../domain/templates/model';
import { parseTemplateDocument } from '../domain/templates/template-parser';
import type { LinkResolver, VaultReader } from '../ports/vault-reader';

const TEMPLATE_KEY_PATTERN = /^[a-z0-9_-]+$/u;
const PACKAGED_TASK_FINGERPRINT = 'builtin:minimal/task@schema-1';

export interface TaskTemplateSelection {
  readonly source: 'packaged' | 'project';
  readonly variant: string;
  readonly reference: string;
  readonly fingerprint: string;
  readonly template: TemplateSource;
}

export interface TaskTemplateResolution {
  readonly ok: boolean;
  readonly selected: TaskTemplateSelection | null;
  readonly availableVariants: readonly string[];
  readonly diagnostics: readonly Diagnostic[];
}

/**
 * Resolves one project's effective task template without writing to the vault.
 * An absent mapping uses the packaged minimal default. Any explicit reference
 * fails closed when it is broken or incompatible.
 */
export class TaskTemplateResolver {
  readonly #vault: VaultReader;
  readonly #links: LinkResolver;

  public constructor(vault: VaultReader, links: LinkResolver) {
    this.#vault = vault;
    this.#links = links;
  }

  public async resolve(
    project: ProjectEntity,
    requestedVariant?: string,
  ): Promise<TaskTemplateResolution> {
    if (requestedVariant === PACKAGED_MINIMAL_TEMPLATE_ID) {
      return packaged([]);
    }

    const parsed = readTaskMap(project);
    const diagnostics = [...parsed.diagnostics];
    const variant = requestedVariant ?? 'default';
    if (!TEMPLATE_KEY_PATTERN.test(variant)) {
      diagnostics.push(
        issue(
          project.path,
          'template.variant.invalid',
          `${variant} is not a valid task template variant key.`,
          'weave.templates.task',
          'Use lowercase letters, digits, underscores, or hyphens.',
        ),
      );
      return failed(parsed.availableVariants, diagnostics);
    }

    if (parsed.map === null) {
      return hasError(diagnostics)
        ? failed(parsed.availableVariants, diagnostics)
        : packaged(diagnostics);
    }

    const rawReference = parsed.map[variant];
    if (rawReference === undefined) {
      if (variant === 'default') {
        return packaged(diagnostics, parsed.availableVariants);
      }
      diagnostics.push(
        issue(
          project.path,
          'template.variant.not_found',
          `Task template variant ${variant} is not configured.`,
          `weave.templates.task.${variant}`,
          'Select an available variant or explicitly use the packaged minimal template.',
        ),
      );
      return failed(parsed.availableVariants, diagnostics);
    }

    const link =
      typeof rawReference === 'string' ? parseWikiLink(rawReference) : null;
    if (link === null || typeof rawReference !== 'string') {
      diagnostics.push(
        issue(
          project.path,
          'template.reference.invalid',
          `Task template variant ${variant} must be one wiki link.`,
          `weave.templates.task.${variant}`,
          'Reference one Markdown template note with a wiki link.',
        ),
      );
      return failed(parsed.availableVariants, diagnostics);
    }

    const resolution = this.#links.resolve(link.linkpath, project.path);
    if (resolution.kind === 'ambiguous') {
      diagnostics.push({
        ...issue(
          project.path,
          'template.reference.ambiguous',
          `Task template reference ${link.raw} is ambiguous.`,
          `weave.templates.task.${variant}`,
          'Use a path-qualified wiki link to select one template note.',
        ),
        relatedPaths: [...resolution.candidates],
      });
      return failed(parsed.availableVariants, diagnostics);
    }
    if (resolution.kind === 'unresolved') {
      diagnostics.push(
        issue(
          project.path,
          'template.reference.unresolved',
          `Task template reference ${link.raw} could not be resolved.`,
          `weave.templates.task.${variant}`,
          'Correct the reference or explicitly choose the packaged minimal template.',
        ),
      );
      return failed(parsed.availableVariants, diagnostics);
    }

    const source = await this.#vault.readMarkdownNote(resolution.path);
    if (source === null) {
      diagnostics.push(
        issue(
          project.path,
          'template.reference.changed',
          `Resolved template ${resolution.path} is no longer readable.`,
          `weave.templates.task.${variant}`,
          'Refresh the index and resolve the template again.',
        ),
      );
      return failed(parsed.availableVariants, diagnostics);
    }

    const template: TemplateSource = {
      path: source.path,
      content: source.content,
    };
    const document = parseTemplateDocument(template);
    diagnostics.push(...document.diagnostics);
    if (
      document.metadata.templateFor !== null &&
      document.metadata.templateFor !== 'task'
    ) {
      diagnostics.push(
        issue(
          source.path,
          'template.kind_mismatch',
          `The template declares ${document.metadata.templateFor}, not task.`,
          'template_for',
          'Reference a template whose template_for value is task.',
        ),
      );
    }

    if (hasError(diagnostics)) {
      return failed(parsed.availableVariants, diagnostics);
    }
    return {
      ok: true,
      selected: {
        source: 'project',
        variant,
        reference: rawReference,
        fingerprint: source.fingerprint,
        template,
      },
      availableVariants: parsed.availableVariants,
      diagnostics,
    };
  }
}

interface ParsedTaskMap {
  readonly map: Readonly<Record<string, unknown>> | null;
  readonly availableVariants: readonly string[];
  readonly diagnostics: readonly Diagnostic[];
}

function readTaskMap(project: ProjectEntity): ParsedTaskMap {
  const diagnostics: Diagnostic[] = [];
  const weave = project.frontmatter.weave;
  if (weave === undefined) {
    return emptyMap(diagnostics);
  }
  if (!isRecord(weave)) {
    return invalidMap(
      project,
      diagnostics,
      'template.map.weave_invalid',
      'weave must be a mapping before templates can be resolved.',
      'weave',
    );
  }

  const templates = weave.templates;
  if (templates === undefined) {
    return emptyMap(diagnostics);
  }
  if (!isRecord(templates)) {
    return invalidMap(
      project,
      diagnostics,
      'template.map.invalid',
      'weave.templates must be a mapping.',
      'weave.templates',
    );
  }

  const task = templates.task;
  if (task === undefined) {
    return emptyMap(diagnostics);
  }
  if (!isRecord(task)) {
    return invalidMap(
      project,
      diagnostics,
      'template.map.kind_invalid',
      'weave.templates.task must map variant keys to wiki links.',
      'weave.templates.task',
    );
  }

  for (const key of Object.keys(task)) {
    if (!TEMPLATE_KEY_PATTERN.test(key)) {
      diagnostics.push(
        templateDiagnostic(
          project.path,
          'template.map.variant_key_invalid',
          'warning',
          `Task template variant key ${key} is invalid and unavailable.`,
          `weave.templates.task.${key}`,
          'Use lowercase letters, digits, underscores, or hyphens.',
        ),
      );
    }
  }

  return {
    map: task,
    availableVariants: uniqueSorted([
      'default',
      ...Object.keys(task).filter((key) => TEMPLATE_KEY_PATTERN.test(key)),
    ]),
    diagnostics,
  };
}

function emptyMap(diagnostics: readonly Diagnostic[]): ParsedTaskMap {
  return { map: null, availableVariants: ['default'], diagnostics };
}

function invalidMap(
  project: ProjectEntity,
  diagnostics: Diagnostic[],
  code: string,
  message: string,
  field: string,
): ParsedTaskMap {
  diagnostics.push(
    issue(
      project.path,
      code,
      message,
      field,
      'Correct the project template map before creating a task.',
    ),
  );
  return { map: null, availableVariants: [], diagnostics };
}

function packaged(
  diagnostics: readonly Diagnostic[],
  variants: readonly string[] = ['default'],
): TaskTemplateResolution {
  return {
    ok: true,
    selected: {
      source: 'packaged',
      variant: 'default',
      reference: PACKAGED_MINIMAL_TEMPLATE_ID,
      fingerprint: PACKAGED_TASK_FINGERPRINT,
      template: PACKAGED_MINIMAL_TASK_TEMPLATE,
    },
    availableVariants: uniqueSorted(['default', ...variants]),
    diagnostics,
  };
}

function failed(
  availableVariants: readonly string[],
  diagnostics: readonly Diagnostic[],
): TaskTemplateResolution {
  return { ok: false, selected: null, availableVariants, diagnostics };
}

function issue(
  path: string,
  code: string,
  message: string,
  field: string,
  recovery: string,
): Diagnostic {
  return templateDiagnostic(path, code, 'error', message, field, recovery);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
