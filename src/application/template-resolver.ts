import type { Diagnostic } from '../domain/model';
import {
  PACKAGED_MINIMAL_TEMPLATE_ID,
  PACKAGED_STARTER_TEMPLATES,
} from '../domain/templates/packaged-templates';
import { hasError, templateDiagnostic } from '../domain/templates/model';
import type { TemplateSource } from '../domain/templates/model';
import { parseTemplateDocument } from '../domain/templates/template-parser';
import {
  mergeTemplateCatalog,
  variantsForKind,
  type TemplateCatalogCandidate,
} from './template-catalog';
import type { VaultTemplateLibrary } from './vault-template-library';

const TEMPLATE_KEY_PATTERN = /^[a-z0-9_-]+$/u;

export interface TemplateSelection {
  readonly source: 'packaged' | 'vault';
  readonly variant: string;
  readonly reference: string;
  readonly fingerprint: string;
  readonly template: TemplateSource;
}

export interface TemplateResolution {
  readonly ok: boolean;
  readonly selected: TemplateSelection | null;
  readonly availableVariants: readonly string[];
  readonly diagnostics: readonly Diagnostic[];
}

/**
 * One variant a chooser could offer, with enough to decide UI state without
 * re-deriving it from a bare list of names.
 *
 * `usable` distinguishes a key that exists but is broken (a case collision, for
 * instance) from one that would resolve cleanly. A chooser needs this to know
 * an escape hatch is required; inferring it from array length, as the UI used
 * to, silently drops broken keys instead of surfacing them (see ADR 0013 and
 * the vault note templates specification).
 */
export interface TemplateVariantOption {
  readonly variant: string;
  readonly usable: boolean;
  readonly source: 'plugin' | 'vault';
}

/**
 * Resolves a template of any `template_for` kind from the configured vault
 * library, falling back to the packaged default, without writing.
 *
 * This is the one implementation of the ADR 0013 rung ladder: the vault
 * template library, then the packaged default. (Project-owned mappings are
 * the first rung the ADR describes; they are intentionally deferred for every
 * kind, so every project sees the same catalog.) A caller supplies which kind
 * it is resolving — `task`, `project`, or a future creatable kind — and a path
 * to attribute a diagnostic to when no candidate exists at any rung. Every
 * caller shares the same fail-closed behavior: a broken or ambiguous
 * candidate blocks its key rather than silently falling through to a
 * different rung's bytes.
 */
export class TemplateResolver {
  readonly #library: VaultTemplateLibrary | null;

  public constructor(library: VaultTemplateLibrary | null = null) {
    this.#library = library;
  }

  /**
   * Every variant a caller could ask for, `default` first, with whether each
   * one would actually resolve.
   *
   * Listed rather than derived from one resolution, because a chooser has to
   * show what exists before anything is selected. A key that exists at any
   * rung is offered; whether it works is decided when it is resolved — which
   * is why a case-colliding key is included here as unusable rather than
   * omitted: a chooser needs it to know an escape hatch is required.
   *
   * Built from the same merged catalog `resolve` reads (`#candidatesFor` /
   * `mergeTemplateCatalog` / `variantsForKind`), so this is not a second,
   * divergent listing path.
   */
  public async listVariants(
    kind: string,
  ): Promise<readonly TemplateVariantOption[]> {
    const { candidates } = await this.#candidatesFor(kind);
    return variantsForKind(mergeTemplateCatalog(candidates), kind).map(
      (entry) => ({
        variant: entry.variant,
        usable: entry.usable,
        source: entry.selected.source,
      }),
    );
  }

  public async resolve(
    kind: string,
    contextPath: string,
    requestedVariant?: string,
  ): Promise<TemplateResolution> {
    if (requestedVariant === PACKAGED_MINIMAL_TEMPLATE_ID) {
      return this.#packagedOnly(kind);
    }

    const diagnostics: Diagnostic[] = [];
    const availableVariants = (await this.listVariants(kind)).map(
      (option) => option.variant,
    );
    const variant = requestedVariant ?? 'default';
    if (!TEMPLATE_KEY_PATTERN.test(variant)) {
      diagnostics.push(
        issue(
          contextPath,
          'template.variant.invalid',
          `${variant} is not a valid ${kind} template variant key.`,
          'template_variant',
          'Use lowercase letters, digits, underscores, or hyphens.',
        ),
      );
      return failed(availableVariants, diagnostics);
    }

    return await this.#resolveCatalog(
      kind,
      variant,
      contextPath,
      availableVariants,
      diagnostics,
    );
  }

  /**
   * The explicit `builtin:minimal` override: skip the catalog entirely and use
   * the packaged default for this kind, on the same terms regardless of what
   * the vault library holds.
   */
  #packagedOnly(kind: string): TemplateResolution {
    const packaged = packagedTemplateFor(kind, 'default');
    if (packaged === null) {
      return failed(['default'], []);
    }
    return {
      ok: true,
      selected: {
        source: 'packaged',
        variant: 'default',
        reference: PACKAGED_MINIMAL_TEMPLATE_ID,
        fingerprint: packaged.fingerprint,
        template: packaged.template,
      },
      availableVariants: ['default'],
      diagnostics: [],
    };
  }

  /**
   * Merge the packaged and vault candidates for one key and resolve the
   * winner.
   *
   * A vault template that cannot be used blocks its variant rather than
   * falling through to the packaged one: falling through would create bytes
   * other than the ones the configured template describes, which is the
   * failure mode ADR 0013 exists to prevent. That includes a key two vault
   * files claim case-insensitively: the merged catalog carries it as a broken
   * candidate rather than treating it as absent, so it cannot be mistaken for
   * "nothing configured" and quietly resolved from a lower rung.
   */
  async #resolveCatalog(
    kind: string,
    variant: string,
    contextPath: string,
    availableVariants: readonly string[],
    diagnostics: Diagnostic[],
  ): Promise<TemplateResolution> {
    const { candidates, listingDiagnostics } = await this.#candidatesFor(kind);
    const entry = variantsForKind(mergeTemplateCatalog(candidates), kind).find(
      (candidate) => candidate.variant === variant,
    );

    if (entry === undefined) {
      diagnostics.push(
        issue(
          contextPath,
          'template.variant.not_found',
          `${capitalize(kind)} template variant ${variant} is not configured.`,
          'template_variant',
          'Add the variant to the configured template library or select an available template.',
        ),
      );
      return failed(availableVariants, diagnostics);
    }

    if (!entry.usable) {
      const related = listingDiagnostics.filter((candidate) =>
        candidate.relatedPaths?.includes(entry.selected.path),
      );
      return failed(
        availableVariants,
        related.length > 0
          ? related
          : [
              issue(
                entry.selected.path,
                'template.library.ambiguous',
                `More than one vault template claims \`${kind}/${variant}\`.`,
                'variant',
                'Rename or remove all but one, including names that differ only by case.',
              ),
            ],
      );
    }

    if (entry.selected.source === 'plugin') {
      const packaged = packagedTemplateFor(kind, variant);
      if (packaged === null) {
        diagnostics.push(
          issue(
            contextPath,
            'template.variant.not_found',
            `${capitalize(kind)} template variant ${variant} is not configured.`,
            'template_variant',
            'Add the variant to the configured template library or select an available template.',
          ),
        );
        return failed(availableVariants, diagnostics);
      }
      return {
        ok: true,
        selected: {
          source: 'packaged',
          variant,
          reference: entry.selected.reference,
          fingerprint: packaged.fingerprint,
          template: packaged.template,
        },
        availableVariants,
        diagnostics,
      };
    }

    const loaded =
      this.#library === null ? null : await this.#library.load(kind, variant);
    if (loaded === null) {
      diagnostics.push(
        issue(
          entry.selected.path,
          'template.reference.changed',
          `Vault template ${entry.selected.path} is no longer readable.`,
          'template',
          'Refresh the template catalog and build a new proposal.',
        ),
      );
      return failed(availableVariants, diagnostics);
    }

    const document = parseTemplateDocument(loaded.template);
    diagnostics.push(...document.diagnostics);
    if (
      document.metadata.templateFor !== null &&
      document.metadata.templateFor !== kind
    ) {
      diagnostics.push(
        issue(
          loaded.template.path,
          'template.kind_mismatch',
          `The template declares ${document.metadata.templateFor}, not ${kind}.`,
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

  /** Packaged candidates for the kind, plus vault entries and case collisions. */
  async #candidatesFor(kind: string): Promise<{
    readonly candidates: readonly TemplateCatalogCandidate[];
    readonly listingDiagnostics: readonly Diagnostic[];
  }> {
    const candidates: TemplateCatalogCandidate[] =
      PACKAGED_STARTER_TEMPLATES.filter((entry) => entry.kind === kind).map(
        (entry) => ({
          kind: entry.kind,
          variant: entry.variant,
          source: 'plugin',
          reference:
            entry.variant === 'default'
              ? PACKAGED_MINIMAL_TEMPLATE_ID
              : entry.source.path,
          path: entry.source.path,
        }),
      );

    if (this.#library === null) {
      return { candidates, listingDiagnostics: [] };
    }

    const listing = await this.#library.list();
    for (const entry of listing.entries) {
      if (entry.kind !== kind) {
        continue;
      }
      candidates.push({
        kind: entry.kind,
        variant: entry.variant,
        source: 'vault',
        reference: entry.path,
        path: entry.path,
      });
    }
    for (const entry of listing.ambiguous) {
      if (entry.kind !== kind) {
        continue;
      }
      candidates.push({
        kind: entry.kind,
        variant: entry.variant,
        source: 'vault',
        reference: entry.path,
        path: entry.path,
        broken: true,
      });
    }
    return { candidates, listingDiagnostics: listing.diagnostics };
  }
}

/**
 * The packaged template for a kind/variant, with the fingerprint kinds have
 * carried since before this catalog existed: `builtin:minimal/<kind>` rather
 * than a per-variant identity. Every kind ships exactly one packaged variant
 * today, so the two coincide; a kind that ever ships a second packaged
 * variant would need to widen this, not silently collide with it.
 */
function packagedTemplateFor(
  kind: string,
  variant: string,
): { readonly template: TemplateSource; readonly fingerprint: string } | null {
  const found = PACKAGED_STARTER_TEMPLATES.find(
    (entry) => entry.kind === kind && entry.variant === variant,
  );
  if (found === undefined) {
    return null;
  }
  return {
    template: found.source,
    fingerprint: `${PACKAGED_MINIMAL_TEMPLATE_ID}/${kind}@schema-1`,
  };
}

function failed(
  availableVariants: readonly string[],
  diagnostics: readonly Diagnostic[],
): TemplateResolution {
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

function capitalize(value: string): string {
  const [first, ...rest] = value;
  return first === undefined ? value : first.toUpperCase() + rest.join('');
}
