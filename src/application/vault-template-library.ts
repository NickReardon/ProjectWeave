import { normalizeVaultPath } from '../domain/markdown-parser';
import type { Diagnostic } from '../domain/model';
import { templateDiagnostic } from '../domain/templates/model';
import type { TemplateSource } from '../domain/templates/model';
import type { VaultReader } from '../ports/vault-reader';

/**
 * The vault rung of the template catalog (ADR 0013): ordinary Markdown
 * templates the user drops into a configured folder, one folder per
 * `template_for` value and one file per variant.
 *
 * Discovery is a path listing, so adding a template is copying a file. Nothing
 * here writes, creates the folder, or prompts for setup: a missing library is
 * simply a library with no templates in it.
 */

/** Variant keys match the pattern project template maps already enforce. */
export const TEMPLATE_VARIANT_PATTERN = /^[a-z0-9_-]+$/u;

/** Kind folders are `template_for` values, which use the same shape. */
const TEMPLATE_KIND_PATTERN = TEMPLATE_VARIANT_PATTERN;

export interface VaultTemplateEntry {
  /** The `template_for` value this template claims, from its folder. */
  readonly kind: string;
  readonly variant: string;
  readonly path: string;
}

export interface VaultTemplateListing {
  readonly entries: readonly VaultTemplateEntry[];
  /** Keys whose candidates collide case-insensitively, so none is usable. */
  readonly ambiguous: readonly VaultTemplateEntry[];
  readonly diagnostics: readonly Diagnostic[];
}

export interface VaultTemplateLoad {
  readonly template: TemplateSource;
  readonly fingerprint: string;
}

export class VaultTemplateLibrary {
  readonly #vault: VaultReader;
  readonly #folder: string;

  public constructor(vault: VaultReader, folder: string) {
    this.#vault = vault;
    this.#folder = normalizeLibraryFolder(folder);
  }

  /** True when a folder is configured at all. An empty setting disables it. */
  public get enabled(): boolean {
    return this.#folder.length > 0;
  }

  public get folder(): string {
    return this.#folder;
  }

  /**
   * Every usable template in the library.
   *
   * Only exact `<library>/<kind>/<variant>.md` children are candidates, so an
   * archive or attachment folder nested deeper contributes nothing. A file that
   * cannot yield a usable key is reported and skipped rather than guessed at:
   * skipping one file leaves the rest of the library working.
   */
  public async list(): Promise<VaultTemplateListing> {
    if (!this.enabled) {
      return { entries: [], ambiguous: [], diagnostics: [] };
    }

    const diagnostics: Diagnostic[] = [];
    const candidates = new Map<string, VaultTemplateEntry[]>();
    const prefix = this.#folder.toLowerCase() + '/';

    for (const raw of await this.#vault.listMarkdownPaths()) {
      const path = normalizeVaultPath(raw);
      const lower = path.toLowerCase();
      if (!lower.startsWith(prefix) || !lower.endsWith('.md')) {
        continue;
      }
      const rest = path.slice(prefix.length).split('/');
      const [kindSegment, fileSegment] = rest;
      // Exactly two segments: a kind folder and the template itself.
      if (
        rest.length !== 2 ||
        kindSegment === undefined ||
        fileSegment === undefined
      ) {
        continue;
      }

      const kind = kindSegment.toLowerCase();
      const variant = fileSegment.slice(0, -3).toLowerCase();
      if (!TEMPLATE_KIND_PATTERN.test(kind)) {
        diagnostics.push(
          issue(
            path,
            'template.library.kind_invalid',
            `\`${kindSegment}\` is not a usable template kind folder.`,
            'template_for',
            'Name the folder for the `template_for` value it holds, using lowercase letters, digits, underscores, or hyphens.',
          ),
        );
        continue;
      }
      if (!TEMPLATE_VARIANT_PATTERN.test(variant)) {
        diagnostics.push(
          issue(
            path,
            'template.library.variant_invalid',
            `\`${fileSegment}\` is not a usable template variant filename.`,
            'variant',
            'Name the file for the variant, using lowercase letters, digits, underscores, or hyphens.',
          ),
        );
        continue;
      }

      const key = `${kind}/${variant}`;
      const found = candidates.get(key);
      if (found === undefined) {
        candidates.set(key, [{ kind, variant, path }]);
      } else {
        found.push({ kind, variant, path });
      }
    }

    const entries: VaultTemplateEntry[] = [];
    const ambiguous: VaultTemplateEntry[] = [];
    for (const [key, found] of [...candidates].sort(byKey)) {
      const first = found[0];
      if (first === undefined) {
        continue;
      }
      if (found.length === 1) {
        entries.push(first);
        continue;
      }
      // Two files normalizing to one key: taking either would make the bytes
      // depend on listing order, so the key is unavailable until it is unique.
      ambiguous.push(first);
      diagnostics.push({
        ...issue(
          this.#folder,
          'template.library.ambiguous',
          `More than one template claims \`${key}\`.`,
          'variant',
          'Rename or remove all but one, including names that differ only by case.',
        ),
        relatedPaths: found.map((entry) => entry.path).sort(),
      });
    }

    return { entries, ambiguous, diagnostics };
  }

  /**
   * Read one template's current bytes and fingerprint.
   *
   * Returns null when the file is gone, which the caller treats as an absent
   * candidate rather than an error: the library is ordinary vault content and
   * may change between a listing and a read.
   */
  public async load(
    kind: string,
    variant: string,
  ): Promise<VaultTemplateLoad | null> {
    if (!this.enabled) {
      return null;
    }
    const path = this.pathFor(kind, variant);
    const note = await this.#vault.readMarkdownNote(path);
    if (note === null) {
      return null;
    }
    return {
      template: { path: note.path, content: note.content },
      fingerprint: note.fingerprint,
    };
  }

  /** Where a given key would live, whether or not anything is there. */
  public pathFor(kind: string, variant: string): string {
    return `${this.#folder}/${kind.toLowerCase()}/${variant.toLowerCase()}.md`;
  }
}

function normalizeLibraryFolder(folder: string): string {
  const trimmed = folder.trim();
  if (trimmed.length === 0) {
    return '';
  }
  return normalizeVaultPath(trimmed).replace(/^\/+|\/+$/gu, '');
}

function byKey(
  left: readonly [string, unknown],
  right: readonly [string, unknown],
): number {
  return left[0].localeCompare(right[0]);
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
