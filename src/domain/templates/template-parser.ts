import {
  parseWikiLink,
  readFrontmatterMapping,
  splitFrontmatter,
} from '../markdown-parser';
import type { Diagnostic } from '../model';
import {
  RESERVED_TEMPLATE_KEYS,
  SUPPORTED_TEMPLATE_SCHEMA,
  TEMPLATE_INPUT_TYPES,
  templateDiagnostic,
} from './model';
import type {
  TemplateInputDeclaration,
  TemplateInputType,
  TemplateSource,
  TemplateValue,
} from './model';

/** A frontmatter placeholder must occupy the whole scalar value (the Vault note templates spec). */
const WHOLE_PLACEHOLDER_PATTERN = /^\{\{\s*([^{}]+?)\s*\}\}$/u;
/** Template kind and variant keys (the Vault note templates spec). */
const TEMPLATE_KEY_PATTERN = /^[a-z0-9][a-z0-9_-]*$/u;
/** Declared input names double as body/frontmatter variable names. */
const INPUT_NAME_PATTERN = /^[a-z][a-z0-9_]*$/u;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/u;
const DATETIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/u;

export interface TemplateMetadata {
  readonly isTemplate: boolean;
  readonly schema: number | null;
  readonly templateFor: string | null;
  readonly templateName: string | null;
  readonly description: string | null;
  readonly inputs: readonly TemplateInputDeclaration[];
}

/**
 * One output-bound frontmatter property. A `placeholder` property carries the
 * variable token that supplies its value; a `static` property carries the
 * literal template value.
 */
export type TemplateProperty =
  | {
      readonly key: string;
      readonly source: 'placeholder';
      readonly token: string;
    }
  | {
      readonly key: string;
      readonly source: 'static';
      readonly value: unknown;
    };

export interface TemplateDocument {
  readonly path: string;
  readonly metadata: TemplateMetadata;
  readonly properties: readonly TemplateProperty[];
  readonly body: string;
  readonly diagnostics: readonly Diagnostic[];
}

const EMPTY_METADATA: TemplateMetadata = {
  isTemplate: false,
  schema: null,
  templateFor: null,
  templateName: null,
  description: null,
  inputs: [],
};

/**
 * Parse a template note into reserved metadata, output-bound frontmatter
 * properties, and the raw Markdown body. Metadata and input declarations are
 * validated here; variable resolution and body directives are validated during
 * rendering, where the creation context is known.
 */
export function parseTemplateDocument(
  template: TemplateSource,
): TemplateDocument {
  const path = template.path;
  const diagnostics: Diagnostic[] = [];
  const split = splitFrontmatter(template.content);

  if (split === null) {
    diagnostics.push(
      templateDiagnostic(
        path,
        'template.frontmatter.missing',
        'error',
        'A template note must start with YAML frontmatter.',
        undefined,
        'Add frontmatter containing at least `weave_template: true` and `template_for`.',
      ),
    );
    return {
      path,
      metadata: EMPTY_METADATA,
      properties: [],
      body: template.content,
      diagnostics,
    };
  }

  const mapping = readFrontmatterMapping(split.yaml);
  if (!mapping.ok) {
    diagnostics.push(
      frontmatterDiagnostic(path, mapping.reason, mapping.detail),
    );
    return {
      path,
      metadata: EMPTY_METADATA,
      properties: [],
      body: split.body,
      diagnostics,
    };
  }

  return {
    path,
    metadata: parseMetadata(mapping.value, path, diagnostics),
    properties: parseProperties(mapping.value, path, diagnostics),
    body: split.body,
    diagnostics,
  };
}

function frontmatterDiagnostic(
  path: string,
  reason: 'invalid' | 'invalid_value' | 'invalid_shape',
  detail: string,
): Diagnostic {
  switch (reason) {
    case 'invalid':
      return templateDiagnostic(
        path,
        'template.frontmatter.invalid',
        'error',
        `Template frontmatter could not be parsed: ${detail}`,
        undefined,
        'Correct the template YAML frontmatter.',
      );
    case 'invalid_value':
      return templateDiagnostic(
        path,
        'template.frontmatter.invalid_value',
        'error',
        `Template frontmatter could not be converted safely: ${detail}`,
        undefined,
        'Remove YAML aliases or unsupported values from the template.',
      );
    case 'invalid_shape':
      return templateDiagnostic(
        path,
        'template.frontmatter.invalid_shape',
        'error',
        'Template frontmatter must be a YAML mapping.',
        undefined,
        'Replace the frontmatter value with key-value properties.',
      );
  }
}

function parseMetadata(
  frontmatter: Readonly<Record<string, unknown>>,
  path: string,
  diagnostics: Diagnostic[],
): TemplateMetadata {
  const marker = frontmatter.weave_template;
  if (marker !== undefined && marker !== true) {
    diagnostics.push(
      templateDiagnostic(
        path,
        'template.marker.invalid',
        'error',
        '`weave_template`, when present, must be exactly `true`.',
        'weave_template',
        'Remove this optional legacy key, or set it to the Boolean `true`.',
      ),
    );
  }
  const templateFor = readKey(
    frontmatter.template_for,
    'template_for',
    'template.for.missing',
    path,
    diagnostics,
  );

  return {
    isTemplate: templateFor !== null,
    schema: readSchema(frontmatter.template_schema, path, diagnostics),
    templateFor,
    templateName: readKey(
      frontmatter.template_name,
      'template_name',
      null,
      path,
      diagnostics,
    ),
    description: readDescription(
      frontmatter.template_description,
      path,
      diagnostics,
    ),
    inputs: parseInputs(frontmatter.template_inputs, path, diagnostics),
  };
}

function readSchema(
  raw: unknown,
  path: string,
  diagnostics: Diagnostic[],
): number | null {
  if (raw === undefined || raw === null) {
    return SUPPORTED_TEMPLATE_SCHEMA;
  }
  if (raw === SUPPORTED_TEMPLATE_SCHEMA) {
    return SUPPORTED_TEMPLATE_SCHEMA;
  }
  diagnostics.push(
    templateDiagnostic(
      path,
      'template.schema.unsupported',
      'error',
      `\`template_schema\` must be ${String(SUPPORTED_TEMPLATE_SCHEMA)}; this template declares ${describe(raw)}.`,
      'template_schema',
      'Use a template written for the supported schema version.',
    ),
  );
  return null;
}

function readKey(
  raw: unknown,
  field: string,
  missingCode: string | null,
  path: string,
  diagnostics: Diagnostic[],
): string | null {
  if (raw === undefined || raw === null) {
    if (missingCode !== null) {
      diagnostics.push(
        templateDiagnostic(
          path,
          missingCode,
          'error',
          'A template must declare the note kind it creates.',
          field,
          'Add `template_for: task` or another supported kind.',
        ),
      );
    }
    return null;
  }
  if (typeof raw === 'string' && TEMPLATE_KEY_PATTERN.test(raw)) {
    return raw;
  }
  diagnostics.push(
    templateDiagnostic(
      path,
      'template.key.invalid',
      'error',
      `\`${field}\` must be lowercase letters, digits, underscores, or hyphens; found ${describe(raw)}.`,
      field,
    ),
  );
  return null;
}

function readDescription(
  raw: unknown,
  path: string,
  diagnostics: Diagnostic[],
): string | null {
  if (raw === undefined || raw === null) {
    return null;
  }
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return raw.trim();
  }
  diagnostics.push(
    templateDiagnostic(
      path,
      'template.description.invalid',
      'error',
      '`template_description` must be a non-empty string when present.',
      'template_description',
    ),
  );
  return null;
}

function parseInputs(
  raw: unknown,
  path: string,
  diagnostics: Diagnostic[],
): readonly TemplateInputDeclaration[] {
  if (raw === undefined || raw === null) {
    return [];
  }
  if (!isRecord(raw)) {
    diagnostics.push(
      templateDiagnostic(
        path,
        'template.inputs.invalid',
        'error',
        '`template_inputs` must be a mapping of input names to declarations.',
        'template_inputs',
      ),
    );
    return [];
  }

  const declarations: TemplateInputDeclaration[] = [];
  for (const [name, declaration] of Object.entries(raw)) {
    const field = `template_inputs.${name}`;
    if (!INPUT_NAME_PATTERN.test(name)) {
      diagnostics.push(
        templateDiagnostic(
          path,
          'template.input.name_invalid',
          'error',
          `Input name \`${name}\` must start with a lowercase letter and use only lowercase letters, digits, or underscores.`,
          field,
        ),
      );
      continue;
    }
    if (!isRecord(declaration)) {
      diagnostics.push(
        templateDiagnostic(
          path,
          'template.input.invalid',
          'error',
          `Input \`${name}\` must be a mapping that declares at least a \`type\`.`,
          field,
        ),
      );
      continue;
    }
    if (!isInputType(declaration.type)) {
      diagnostics.push(
        templateDiagnostic(
          path,
          'template.input.type_unsupported',
          'error',
          `Input \`${name}\` declares ${describe(declaration.type)}; supported types are: ${TEMPLATE_INPUT_TYPES.join(', ')}.`,
          `${field}.type`,
        ),
      );
      continue;
    }
    if (
      declaration.required !== undefined &&
      typeof declaration.required !== 'boolean'
    ) {
      diagnostics.push(
        templateDiagnostic(
          path,
          'template.input.required_invalid',
          'error',
          `Input \`${name}\` must declare \`required\` as true or false.`,
          `${field}.required`,
        ),
      );
      continue;
    }
    if (
      declaration.description !== undefined &&
      typeof declaration.description !== 'string'
    ) {
      diagnostics.push(
        templateDiagnostic(
          path,
          'template.input.description_invalid',
          'error',
          `Input \`${name}\` must declare \`description\` as a string.`,
          `${field}.description`,
        ),
      );
      continue;
    }

    const type: TemplateInputType = declaration.type;
    let defaultValue: TemplateValue | undefined;
    if (declaration.default !== undefined && declaration.default !== null) {
      const coerced = coerceInputValue(type, declaration.default);
      if (coerced === null) {
        diagnostics.push(
          templateDiagnostic(
            path,
            'template.input.default_invalid',
            'error',
            `Default for input \`${name}\` must be a ${type} value.`,
            `${field}.default`,
          ),
        );
        continue;
      }
      defaultValue = coerced;
    }

    declarations.push({
      name,
      type,
      required: declaration.required === true,
      ...(typeof declaration.description === 'string'
        ? { description: declaration.description }
        : {}),
      ...(defaultValue === undefined ? {} : { defaultValue }),
    });
  }
  return declarations;
}

/**
 * Coerce a supplied or default input value to a typed template value, or null
 * when it does not match the declared type. Static defaults never reference
 * tools, files, or the environment: they are ordinary YAML scalars.
 */
export function coerceInputValue(
  type: TemplateInputType,
  raw: unknown,
): TemplateValue | null {
  switch (type) {
    case 'string':
    case 'markdown':
      return typeof raw === 'string' ? { kind: 'string', value: raw } : null;
    case 'date':
      return typeof raw === 'string' && isValidDate(raw)
        ? { kind: 'string', value: raw }
        : null;
    case 'datetime':
      return typeof raw === 'string' && isValidDateTime(raw)
        ? { kind: 'string', value: raw }
        : null;
    case 'link':
      return typeof raw === 'string' && parseWikiLink(raw) !== null
        ? { kind: 'string', value: raw }
        : null;
    case 'boolean':
      return typeof raw === 'boolean' ? { kind: 'boolean', value: raw } : null;
    case 'integer':
      return typeof raw === 'number' && Number.isInteger(raw)
        ? { kind: 'integer', value: raw }
        : null;
    case 'links': {
      if (!Array.isArray(raw)) {
        return null;
      }
      const links: string[] = [];
      for (const item of raw as readonly unknown[]) {
        if (typeof item !== 'string' || parseWikiLink(item) === null) {
          return null;
        }
        links.push(item);
      }
      return { kind: 'list', value: links };
    }
  }
}

function isValidDate(raw: string): boolean {
  const match = DATE_PATTERN.exec(raw);
  if (match === null) {
    return false;
  }
  return isValidCalendarDate(
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
  );
}

function isValidDateTime(raw: string): boolean {
  const match = DATETIME_PATTERN.exec(raw);
  if (match === null) {
    return false;
  }
  return (
    isValidCalendarDate(Number(match[1]), Number(match[2]), Number(match[3])) &&
    Number(match[4]) <= 23 &&
    Number(match[5]) <= 59 &&
    Number(match[6] ?? 0) <= 59
  );
}

function isValidCalendarDate(
  year: number,
  month: number,
  day: number,
): boolean {
  if (year < 1 || month < 1 || month > 12 || day < 1) {
    return false;
  }
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return day <= (daysInMonth[month - 1] ?? 0);
}

function parseProperties(
  frontmatter: Readonly<Record<string, unknown>>,
  path: string,
  diagnostics: Diagnostic[],
): readonly TemplateProperty[] {
  const reserved = new Set<string>(RESERVED_TEMPLATE_KEYS);
  const properties: TemplateProperty[] = [];

  for (const [key, value] of Object.entries(frontmatter)) {
    if (reserved.has(key)) {
      continue;
    }
    if (typeof value === 'string') {
      const placeholder = WHOLE_PLACEHOLDER_PATTERN.exec(value);
      if (placeholder !== null) {
        properties.push({
          key,
          source: 'placeholder',
          token: (placeholder[1] ?? '').trim(),
        });
        continue;
      }
      if (value.includes('{{')) {
        diagnostics.push(
          templateDiagnostic(
            path,
            'template.frontmatter.interpolation_unsupported',
            'error',
            `Property \`${key}\` mixes static text with a placeholder; a frontmatter placeholder must occupy the whole value.`,
            key,
            'Use a whole-value placeholder, or move the interpolated text into the note body.',
          ),
        );
        continue;
      }
    }
    properties.push({ key, source: 'static', value });
  }
  return properties;
}

/** A short, safe description of an unexpected frontmatter value. */
function describe(value: unknown): string {
  switch (typeof value) {
    case 'string':
      return `\`${value}\``;
    case 'number':
    case 'boolean':
    case 'bigint':
      return `\`${String(value)}\``;
    case 'undefined':
      return 'nothing';
    case 'object':
      if (value === null) {
        return 'an empty value';
      }
      return Array.isArray(value) ? 'a list' : 'a mapping';
    default:
      return 'an unsupported value';
  }
}

function isInputType(value: unknown): value is TemplateInputType {
  return (
    typeof value === 'string' &&
    (TEMPLATE_INPUT_TYPES as readonly string[]).includes(value)
  );
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
