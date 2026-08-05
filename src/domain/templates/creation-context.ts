import { normalizeVaultPath, parseMarkdownEntity } from '../markdown-parser';
import type { Diagnostic } from '../model';
import { isSafeVaultNotePath } from '../vault-path';
import { formatClock, templateDiagnostic } from './model';
import type {
  ResolvedVariable,
  TemplateClock,
  TemplateInputDeclaration,
  TemplateValue,
  VariableResolver,
} from './model';
import type { RenderedProperty } from './render-engine';
import { coerceInputValue } from './template-parser';
import type { TemplateMetadata, TemplateProperty } from './template-parser';

/**
 * The parts of note creation that do not depend on which kind of note is being
 * created: declared inputs, the clock variables, the precedence rewrite, the
 * invariant overlay, and the target-path guard.
 *
 * Each kind keeps its own renderer, because the built-in variables, the
 * properties the context owns, and the invariants are exactly what makes a kind
 * a kind. Everything else lives here so a second kind does not arrive as a
 * second copy of the first.
 */

/** Default formats for the date and time variables. */
export const CLOCK_VARIABLES: Readonly<Record<string, string>> = {
  date: 'YYYY-MM-DD',
  time: 'HH:mm',
  datetime: 'YYYY-MM-DD[T]HH:mm',
};

export interface ResolvedInput {
  readonly value: TemplateValue | null;
}

/**
 * The rendered note must land on a safe, normalized vault path to a Markdown
 * file. Returns that path, or null when the request cannot produce a note.
 */
export function validateTargetPath(
  raw: string,
  path: string,
  diagnostics: Diagnostic[],
): string | null {
  if (!isSafeVaultNotePath(raw)) {
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
  return normalizeVaultPath(raw);
}

/**
 * Validate supplied values against the template's declared inputs. Only
 * declared inputs may be supplied, so a caller cannot introduce undeclared
 * variables, and a declared input may not shadow a built-in variable.
 */
export function resolveInputs(
  declarations: readonly TemplateInputDeclaration[],
  supplied: Readonly<Record<string, unknown>>,
  builtins: ReadonlySet<string>,
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
    if (builtins.has(declaration.name)) {
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
      if (declaration.required && !satisfiesRequiredInput(fallback)) {
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
    if (declaration.required && !satisfiesRequiredInput(value)) {
      diagnostics.push(
        templateDiagnostic(
          path,
          'template.input.required',
          'error',
          `Input ${declaration.name} is required by this template and cannot be empty.`,
          declaration.name,
        ),
      );
    }
    resolved.set(declaration.name, { value });
  }

  return resolved;
}

function satisfiesRequiredInput(value: TemplateValue | null): boolean {
  if (value === null) {
    return false;
  }
  switch (value.kind) {
    case 'string':
      return value.value.trim().length > 0;
    case 'list':
      return value.value.length > 0;
    case 'boolean':
    case 'integer':
      return true;
  }
}

export interface CreationResolverOptions {
  readonly metadata: TemplateMetadata;
  readonly clock: TemplateClock;
  readonly inputs: Map<string, ResolvedInput>;
  readonly builtins: ReadonlySet<string>;
  /** Resolves the variables specific to the kind being created. */
  readonly resolveBuiltin: (name: string) => ResolvedVariable;
}

/**
 * Build the variable resolver for one creation request: clock variables first,
 * then declared inputs, then the kind's own built-ins.
 */
export function createResolver(
  options: CreationResolverOptions,
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
          : formatClock(options.clock, format ?? clockFormat);
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

    const input = options.inputs.get(name);
    if (format !== null) {
      return input !== undefined || options.builtins.has(name)
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
    return options.resolveBuiltin(name);
  };
}

/**
 * Rewrite static properties the creation context owns into placeholders, so
 * context values take precedence over template defaults. A property the
 * context leaves unset keeps its template default.
 */
export function applyContextPrecedence(
  properties: readonly TemplateProperty[],
  resolve: VariableResolver,
  contextOwned: Readonly<Record<string, string>>,
): readonly TemplateProperty[] {
  return properties.map((property) => {
    if (property.source !== 'static') {
      return property;
    }
    const token = contextOwned[property.key];
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
export function applyInvariants(
  properties: readonly RenderedProperty[],
  overlay: readonly RenderedProperty[],
  kind: string,
  path: string,
  diagnostics: Diagnostic[],
): readonly RenderedProperty[] {
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
          `A ${kind} template cannot change \`${invariant.key}\`; this creation requires the selected value.`,
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

export function required(value: string): ResolvedVariable {
  return value.length > 0
    ? { status: 'value', value: { kind: 'string', value } }
    : { status: 'unset', optional: false };
}

export function optionalText(
  value: string | null | undefined,
): ResolvedVariable {
  return value === null || value === undefined || value.length === 0
    ? { status: 'unset', optional: true }
    : { status: 'value', value: { kind: 'string', value } };
}

export function optionalInteger(
  value: number | null | undefined,
): ResolvedVariable {
  return value === null || value === undefined
    ? { status: 'unset', optional: true }
    : { status: 'value', value: { kind: 'integer', value } };
}

export function optionalList(
  value: readonly string[] | undefined,
): ResolvedVariable {
  return value === undefined || value.length === 0
    ? { status: 'unset', optional: true }
    : { status: 'value', value: { kind: 'list', value: [...value] } };
}

/**
 * Validate the assembled note the way an indexed note is validated, so a
 * template cannot produce a note Project Weave would later report as invalid.
 */
export function validateRenderedKind(
  targetPath: string,
  content: string,
  expected: 'task' | 'project',
): readonly Diagnostic[] {
  const parsed = parseMarkdownEntity({
    path: targetPath,
    content,
    fingerprint: 'render',
  });

  if (parsed.entity?.kind !== expected) {
    return [
      ...parsed.diagnostics,
      templateDiagnostic(
        targetPath,
        `template.output.not_a_${expected}`,
        'error',
        `The rendered note is not a ${expected} note.`,
        'type',
        'Check the template frontmatter for a conflicting or unsupported `type`.',
      ),
    ];
  }
  return parsed.diagnostics;
}
