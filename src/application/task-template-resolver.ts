import type { Diagnostic, ProjectEntity } from '../domain/model';
import {
  PACKAGED_MINIMAL_TASK_TEMPLATE,
  PACKAGED_MINIMAL_TEMPLATE_ID,
} from '../domain/templates/packaged-templates';
import { hasError, templateDiagnostic } from '../domain/templates/model';
import type { TemplateSource } from '../domain/templates/model';
import { parseTemplateDocument } from '../domain/templates/template-parser';
import type { VaultTemplateLibrary } from './vault-template-library';

const TEMPLATE_KEY_PATTERN = /^[a-z0-9_-]+$/u;
const PACKAGED_TASK_FINGERPRINT = 'builtin:minimal/task@schema-1';

/** The kind folder a task template lives in, inside the template library. */
const TASK_TEMPLATE_KIND = 'task';

export interface TaskTemplateSelection {
  readonly source: 'packaged' | 'vault';
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
 * Resolves a task template from the configured vault library without writing.
 * Project-specific mappings are intentionally deferred; every project sees the
 * same catalog, with the packaged minimal template as the default fallback.
 */
export class TaskTemplateResolver {
  readonly #library: VaultTemplateLibrary | null;

  public constructor(library: VaultTemplateLibrary | null = null) {
    this.#library = library;
  }

  /**
   * Every variant a caller could ask for, `default` first.
   *
   * Listed rather than derived from one resolution, because a chooser has to
   * show what exists before anything is selected. A key that exists at any rung
   * is offered; whether it works is decided when it is resolved.
   */
  public async listVariants(): Promise<readonly string[]> {
    const fromVault =
      this.#library === null
        ? []
        : (await this.#library.list()).entries
            .filter((entry) => entry.kind === TASK_TEMPLATE_KIND)
            .map((entry) => entry.variant);
    const variants = new Set(['default', ...fromVault]);
    return [
      'default',
      ...[...variants].filter((variant) => variant !== 'default').sort(),
    ];
  }

  public async resolve(
    project: ProjectEntity,
    requestedVariant?: string,
  ): Promise<TaskTemplateResolution> {
    if (requestedVariant === PACKAGED_MINIMAL_TEMPLATE_ID) {
      return packaged([]);
    }

    const diagnostics: Diagnostic[] = [];
    const availableVariants = await this.listVariants();
    const variant = requestedVariant ?? 'default';
    if (!TEMPLATE_KEY_PATTERN.test(variant)) {
      diagnostics.push(
        issue(
          project.path,
          'template.variant.invalid',
          `${variant} is not a valid task template variant key.`,
          'template_variant',
          'Use lowercase letters, digits, underscores, or hyphens.',
        ),
      );
      return failed(availableVariants, diagnostics);
    }

    return await this.#resolveCatalog(
      variant,
      project,
      availableVariants,
      diagnostics,
    );
  }

  /**
   * The vault library, then the packaged default.
   *
   * A vault template that cannot be used blocks its variant rather than
   * falling through to the packaged one: falling through would create bytes
   * other than the ones the configured template describes, which is the
   * failure mode ADR 0013 exists to prevent.
   */
  async #resolveCatalog(
    variant: string,
    project: ProjectEntity,
    availableVariants: readonly string[],
    diagnostics: Diagnostic[],
  ): Promise<TaskTemplateResolution> {
    const loaded =
      this.#library === null
        ? null
        : await this.#library.load(TASK_TEMPLATE_KIND, variant);

    if (loaded !== null) {
      const document = parseTemplateDocument(loaded.template);
      diagnostics.push(...document.diagnostics);
      if (
        document.metadata.templateFor !== null &&
        document.metadata.templateFor !== TASK_TEMPLATE_KIND
      ) {
        diagnostics.push(
          issue(
            loaded.template.path,
            'template.kind_mismatch',
            `The template declares ${document.metadata.templateFor}, not task.`,
            'template_for',
            'Move the template to the folder for its own kind, or correct its template_for value.',
          ),
        );
      }
      if (hasError(diagnostics)) {
        return failed(availableVariants, diagnostics);
      }
      return {
        ok: true,
        selected: {
          source: 'vault',
          variant,
          reference: loaded.template.path,
          fingerprint: loaded.fingerprint,
          template: loaded.template,
        },
        availableVariants,
        diagnostics,
      };
    }

    if (variant === 'default') {
      return packaged(diagnostics, availableVariants);
    }
    diagnostics.push(
      issue(
        project.path,
        'template.variant.not_found',
        `Task template variant ${variant} is not configured.`,
        'template_variant',
        'Add the variant to the configured template library or select an available template.',
      ),
    );
    return failed(availableVariants, diagnostics);
  }
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

function uniqueSorted(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
