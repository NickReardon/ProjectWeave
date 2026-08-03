import type { Diagnostic, DiagnosticSeverity } from '../model';

/**
 * Frontmatter keys that describe the template itself. Design 18 reserves this
 * set; rendering removes every one of them so template-only metadata never
 * reaches a created note.
 */
export const RESERVED_TEMPLATE_KEYS = [
  'weave_template',
  'template_schema',
  'template_for',
  'template_name',
  'template_description',
  'template_inputs',
] as const;

/** The only `template_schema` version this renderer understands. */
export const SUPPORTED_TEMPLATE_SCHEMA = 1;

/** Supported `template_inputs` value types (Design 18). */
export const TEMPLATE_INPUT_TYPES = [
  'string',
  'markdown',
  'boolean',
  'integer',
  'date',
  'datetime',
  'link',
  'links',
] as const;

export type TemplateInputType = (typeof TEMPLATE_INPUT_TYPES)[number];

export interface TemplateInputDeclaration {
  readonly name: string;
  readonly type: TemplateInputType;
  readonly required: boolean;
  readonly description?: string;
  readonly defaultValue?: TemplateValue;
}

/** A template note supplied to the renderer, packaged or vault-resident. */
export interface TemplateSource {
  readonly path: string;
  readonly content: string;
}

/**
 * Civil date and time supplied by the caller in the user's local calendar. The
 * renderer never reads ambient time, so identical inputs always render
 * identical output.
 */
export interface TemplateClock {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
}

/**
 * A resolved, typed variable value. Frontmatter placeholders emit this by type
 * rather than as text; body placeholders interpolate its text form.
 */
export type TemplateValue =
  | { readonly kind: 'string'; readonly value: string }
  | { readonly kind: 'integer'; readonly value: number }
  | { readonly kind: 'boolean'; readonly value: boolean }
  | { readonly kind: 'list'; readonly value: readonly string[] };

/** Outcome of resolving one `{{token}}` against a rendering context. */
export type ResolvedVariable =
  | { readonly status: 'unknown' }
  | { readonly status: 'unset'; readonly optional: boolean }
  | { readonly status: 'value'; readonly value: TemplateValue }
  | {
      readonly status: 'error';
      readonly code: string;
      readonly message: string;
      readonly recovery?: string;
    };

/** Resolves one trimmed placeholder token, such as `date:YYYY-MM-DD`. */
export type VariableResolver = (token: string) => ResolvedVariable;

export interface RenderedNote {
  readonly targetPath: string;
  readonly content: string;
}

export interface TemplateRenderResult {
  readonly ok: boolean;
  readonly note: RenderedNote | null;
  readonly diagnostics: readonly Diagnostic[];
}

export function templateDiagnostic(
  path: string,
  code: string,
  severity: DiagnosticSeverity,
  message: string,
  field?: string,
  recovery?: string,
): Diagnostic {
  return {
    path,
    code,
    severity,
    message,
    ...(field === undefined ? {} : { field }),
    ...(recovery === undefined ? {} : { recovery }),
  };
}

export function hasError(diagnostics: readonly Diagnostic[]): boolean {
  return diagnostics.some((issue) => issue.severity === 'error');
}

/**
 * Date and time format tokens supported by `{{date:...}}` style placeholders.
 * The set is intentionally small: it covers Obsidian's familiar calendar and
 * clock forms without adopting a locale-aware formatting library.
 */
const FORMAT_TOKENS: Readonly<
  Record<string, (clock: TemplateClock) => string>
> = {
  YYYY: (clock) => pad(clock.year, 4),
  MM: (clock) => pad(clock.month, 2),
  DD: (clock) => pad(clock.day, 2),
  HH: (clock) => pad(clock.hour, 2),
  mm: (clock) => pad(clock.minute, 2),
  ss: (clock) => pad(clock.second, 2),
};

const TOKEN_LENGTHS = [4, 2];
const LETTER_PATTERN = /[A-Za-z]/u;

/**
 * Format a clock with the supported tokens. Literal letters are written inside
 * square brackets, following the familiar Obsidian and Moment convention.
 * Returns null when the format uses a letter that is not part of a supported
 * token, so callers can report an actionable error instead of emitting a
 * half-substituted string.
 */
export function formatClock(
  clock: TemplateClock,
  format: string,
): string | null {
  let result = '';
  let index = 0;
  while (index < format.length) {
    const character = format[index] ?? '';

    if (character === '[') {
      const end = format.indexOf(']', index + 1);
      if (end === -1) {
        return null;
      }
      result += format.slice(index + 1, end);
      index = end + 1;
      continue;
    }

    if (!LETTER_PATTERN.test(character)) {
      result += character;
      index += 1;
      continue;
    }

    const token = TOKEN_LENGTHS.map((length) =>
      format.slice(index, index + length),
    ).find((candidate) => candidate in FORMAT_TOKENS);
    if (token === undefined) {
      return null;
    }
    result += FORMAT_TOKENS[token]?.(clock) ?? '';
    index += token.length;
  }
  return result;
}

/**
 * Build a clock from a caller-supplied instant using the host's local
 * calendar. Pure with respect to its argument: the renderer still receives an
 * explicit clock, and callers decide which instant creation happened at.
 */
export function templateClockFromLocalDate(date: Date): TemplateClock {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
    second: date.getSeconds(),
  };
}

/** Whether a `{{#if}}` block referencing this value renders. */
export function isPresent(value: TemplateValue): boolean {
  switch (value.kind) {
    case 'string':
      return value.value.trim().length > 0;
    case 'integer':
      return true;
    case 'boolean':
      return value.value;
    case 'list':
      return value.value.length > 0;
  }
}

/** Text form used when a value is interpolated into the Markdown body. */
export function bodyText(value: TemplateValue): string {
  switch (value.kind) {
    case 'string':
      return value.value;
    case 'integer':
      return String(value.value);
    case 'boolean':
      return value.value ? 'true' : 'false';
    case 'list':
      return value.value.join(', ');
  }
}

/** The plain YAML value a typed template value serializes to. */
export function yamlValue(value: TemplateValue): unknown {
  return value.kind === 'list' ? [...value.value] : value.value;
}

function pad(value: number, length: number): string {
  return String(value).padStart(length, '0');
}
