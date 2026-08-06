/**
 * The merged template catalog of ADR 0013.
 *
 * Creation screens ask for one key — a `template_for` kind and a variant — and
 * get back which rung supplies it. Precedence is evaluated per key, not per
 * kind: a project may override `task/bug` while still using the vault's
 * `task/default`, and a vault may replace `task/default` while still using the
 * plugin's other variants.
 */

/** Rungs, lowest precedence first. */
export const TEMPLATE_SOURCES = ['plugin', 'vault', 'project'] as const;

export type TemplateSourceRung = (typeof TEMPLATE_SOURCES)[number];

export interface TemplateCatalogCandidate {
  readonly kind: string;
  readonly variant: string;
  readonly source: TemplateSourceRung;
  /** How the selection is named back to the user and in a proposal. */
  readonly reference: string;
  /** Vault path for a vault or project candidate; an asset id for a plugin one. */
  readonly path: string;
  /**
   * True when the candidate exists but cannot be used — a malformed template,
   * a kind that contradicts its folder, or a key with colliding files.
   * A broken candidate blocks its key rather than falling through, because
   * falling through would create bytes other than the configured choice.
   */
  readonly broken?: boolean;
}

export interface TemplateCatalogEntry {
  readonly kind: string;
  readonly variant: string;
  readonly selected: TemplateCatalogCandidate;
  /** Every candidate for this key, highest precedence first. */
  readonly candidates: readonly TemplateCatalogCandidate[];
  readonly usable: boolean;
}

export function templateCatalogKey(kind: string, variant: string): string {
  return `${kind.toLowerCase()}/${variant.toLowerCase()}`;
}

/**
 * Merge candidates from every rung into one effective catalog.
 *
 * The winner is the highest-precedence candidate for a key, broken or not. A
 * broken winner leaves the key unusable and keeps its diagnostic reachable,
 * which is the whole point of evaluating per key: one bad variant does not
 * disturb its neighbours, and it does not silently become a different template.
 */
export function mergeTemplateCatalog(
  candidates: readonly TemplateCatalogCandidate[],
): readonly TemplateCatalogEntry[] {
  const byKey = new Map<string, TemplateCatalogCandidate[]>();
  for (const candidate of candidates) {
    const key = templateCatalogKey(candidate.kind, candidate.variant);
    const found = byKey.get(key);
    if (found === undefined) {
      byKey.set(key, [candidate]);
    } else {
      found.push(candidate);
    }
  }

  const entries: TemplateCatalogEntry[] = [];
  for (const [key, found] of [...byKey].sort((left, right) =>
    left[0].localeCompare(right[0]),
  )) {
    const ordered = [...found].sort(
      (left, right) => rank(right.source) - rank(left.source),
    );
    const selected = ordered[0];
    if (selected === undefined) {
      continue;
    }
    const [kind = '', variant = ''] = key.split('/');
    entries.push({
      kind,
      variant,
      selected,
      candidates: ordered,
      usable: selected.broken !== true,
    });
  }
  return entries;
}

/** Variants of one kind, in a stable order with `default` first. */
export function variantsForKind(
  entries: readonly TemplateCatalogEntry[],
  kind: string,
): readonly TemplateCatalogEntry[] {
  const wanted = kind.toLowerCase();
  return entries
    .filter((entry) => entry.kind === wanted)
    .sort((left, right) => {
      if (left.variant === right.variant) {
        return 0;
      }
      if (left.variant === 'default') {
        return -1;
      }
      if (right.variant === 'default') {
        return 1;
      }
      return left.variant.localeCompare(right.variant);
    });
}

function rank(source: TemplateSourceRung): number {
  return TEMPLATE_SOURCES.indexOf(source);
}
