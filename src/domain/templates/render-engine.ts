import { stringify } from 'yaml';

import type { Diagnostic } from '../model';
import { bodyText, isPresent, templateDiagnostic, yamlValue } from './model';
import type { VariableResolver } from './model';
import type { TemplateProperty } from './template-parser';

const IF_LINE_PATTERN = /^\{\{#if\s+([^{}]+?)\s*\}\}$/u;
const CLOSE_LINE = '{{/if}}';
const DIRECTIVE_LINE_PATTERN = /^\{\{[#/]/u;

/**
 * One resolved output property, in the order it is written to frontmatter.
 * The value is the plain YAML value the note will carry: a static template
 * property passes through unchanged, so unknown non-reserved frontmatter of
 * any shape survives rendering.
 */
export interface RenderedProperty {
  readonly key: string;
  readonly value: unknown;
}

/**
 * Resolve frontmatter properties into output values. A placeholder whose known
 * optional variable is unset omits the property entirely; unknown,
 * required-but-unset, and invalid variables become diagnostics.
 */
export function resolveProperties(
  path: string,
  properties: readonly TemplateProperty[],
  resolve: VariableResolver,
  diagnostics: Diagnostic[],
): RenderedProperty[] {
  const resolved: RenderedProperty[] = [];

  for (const property of properties) {
    if (property.source === 'static') {
      resolved.push({ key: property.key, value: property.value });
      continue;
    }

    const variable = resolve(property.token);
    switch (variable.status) {
      case 'value':
        resolved.push({
          key: property.key,
          value: yamlValue(variable.value),
        });
        break;
      case 'unset':
        if (!variable.optional) {
          diagnostics.push(requiredUnset(path, property.token, property.key));
        }
        break;
      case 'unknown':
        diagnostics.push(unknownVariable(path, property.token, property.key));
        break;
      case 'error':
        diagnostics.push(
          templateDiagnostic(
            path,
            variable.code,
            'error',
            variable.message,
            property.key,
            variable.recovery,
          ),
        );
        break;
    }
  }
  return resolved;
}

/**
 * Serialize resolved properties and a rendered body into one Markdown note.
 * Property order follows the template; values are written by their resolved
 * type rather than as textual YAML.
 */
export function serializeNote(
  properties: readonly RenderedProperty[],
  body: string,
): string {
  const mapping = new Map<string, unknown>(
    properties.map((property) => [property.key, property.value]),
  );
  const frontmatter = stringify(mapping, { lineWidth: 0 });
  return `---\n${frontmatter}---\n${body}`;
}

/**
 * Render the Markdown body. The only control construct is a whole-line
 * `{{#if variable}}` / `{{/if}}` block, which cannot nest. `\{{` emits a
 * literal `{{`. Every variable in the body is resolved and validated even
 * inside a block that does not render, so template errors do not depend on
 * which optional values a caller happened to supply.
 */
export function renderBody(
  path: string,
  body: string,
  resolve: VariableResolver,
  diagnostics: Diagnostic[],
): string {
  const output: string[] = [];
  let depth = 0;
  let rendering = true;

  for (const rawLine of body.split('\n')) {
    const line = stripCarriageReturn(rawLine);
    const trimmed = line.trim();

    if (trimmed === CLOSE_LINE) {
      if (depth === 0) {
        diagnostics.push(
          templateDiagnostic(
            path,
            'template.block.unmatched',
            'error',
            'A `{{/if}}` has no matching `{{#if}}`.',
            undefined,
            'Remove the stray `{{/if}}`, or add an opening `{{#if variable}}`.',
          ),
        );
        continue;
      }
      depth -= 1;
      if (depth === 0) {
        rendering = true;
      }
      continue;
    }

    const opening = IF_LINE_PATTERN.exec(trimmed);
    if (opening !== null) {
      const token = (opening[1] ?? '').trim();
      if (depth > 0) {
        diagnostics.push(
          templateDiagnostic(
            path,
            'template.block.nested',
            'error',
            'Conditional blocks cannot be nested.',
            undefined,
            'Flatten the template so each `{{#if variable}}` closes before the next one opens.',
          ),
        );
        depth += 1;
        rendering = false;
        continue;
      }
      depth = 1;
      rendering = evaluateCondition(path, token, resolve, diagnostics);
      continue;
    }

    if (DIRECTIVE_LINE_PATTERN.test(trimmed)) {
      diagnostics.push(unsupportedDirective(path, trimmed));
      continue;
    }

    const rendered = renderInline(path, line, resolve, diagnostics);
    if (rendering) {
      output.push(rendered);
    }
  }

  if (depth > 0) {
    diagnostics.push(
      templateDiagnostic(
        path,
        'template.block.unterminated',
        'error',
        'A `{{#if}}` block is missing its `{{/if}}`.',
        undefined,
        'Close every `{{#if variable}}` with a `{{/if}}` on its own line.',
      ),
    );
  }

  return output.join('\n');
}

function evaluateCondition(
  path: string,
  token: string,
  resolve: VariableResolver,
  diagnostics: Diagnostic[],
): boolean {
  const variable = resolve(token);
  switch (variable.status) {
    case 'value':
      return isPresent(variable.value);
    case 'unset':
      return false;
    case 'unknown':
      diagnostics.push(unknownVariable(path, token));
      return false;
    case 'error':
      diagnostics.push(
        templateDiagnostic(
          path,
          variable.code,
          'error',
          variable.message,
          undefined,
          variable.recovery,
        ),
      );
      return false;
  }
}

function renderInline(
  path: string,
  line: string,
  resolve: VariableResolver,
  diagnostics: Diagnostic[],
): string {
  let result = '';
  let index = 0;

  while (index < line.length) {
    if (line.startsWith('\\{{', index)) {
      result += '{{';
      index += 3;
      continue;
    }
    if (!line.startsWith('{{', index)) {
      result += line[index];
      index += 1;
      continue;
    }

    const end = line.indexOf('}}', index + 2);
    if (end === -1) {
      diagnostics.push(
        templateDiagnostic(
          path,
          'template.placeholder.malformed',
          'error',
          `A placeholder on "${line.trim()}" is missing its closing \`}}\`.`,
          undefined,
          'Close the placeholder with `}}`, or escape a literal brace pair as `\\{{`.',
        ),
      );
      return result + line.slice(index);
    }

    const token = line.slice(index + 2, end).trim();
    index = end + 2;
    result += renderToken(path, token, resolve, diagnostics);
  }
  return result;
}

function renderToken(
  path: string,
  token: string,
  resolve: VariableResolver,
  diagnostics: Diagnostic[],
): string {
  if (token.startsWith('#') || token.startsWith('/')) {
    diagnostics.push(unsupportedDirective(path, `{{${token}}}`));
    return '';
  }

  const variable = resolve(token);
  switch (variable.status) {
    case 'value':
      return bodyText(variable.value);
    case 'unset':
      if (!variable.optional) {
        diagnostics.push(requiredUnset(path, token));
      }
      return '';
    case 'unknown':
      diagnostics.push(unknownVariable(path, token));
      return '';
    case 'error':
      diagnostics.push(
        templateDiagnostic(
          path,
          variable.code,
          'error',
          variable.message,
          undefined,
          variable.recovery,
        ),
      );
      return '';
  }
}

function unknownVariable(
  path: string,
  token: string,
  field?: string,
): Diagnostic {
  return templateDiagnostic(
    path,
    'template.variable.unknown',
    'error',
    `Unknown template variable \`${token}\`.`,
    field,
    'Use a supported built-in variable, or declare it under `template_inputs`.',
  );
}

function requiredUnset(
  path: string,
  token: string,
  field?: string,
): Diagnostic {
  return templateDiagnostic(
    path,
    'template.variable.required_unset',
    'error',
    `Required variable \`${token}\` has no value in this creation context.`,
    field,
    'Supply the value through the creation context before rendering.',
  );
}

function unsupportedDirective(path: string, text: string): Diagnostic {
  return templateDiagnostic(
    path,
    'template.directive.unsupported',
    'error',
    `Unsupported template directive: ${text}`,
    undefined,
    'The only supported directive is a whole-line `{{#if variable}}` / `{{/if}}` block.',
  );
}

function stripCarriageReturn(line: string): string {
  return line.endsWith('\r') ? line.slice(0, -1) : line;
}
