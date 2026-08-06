import type { Diagnostic } from '../model';
import { templateDiagnostic } from './model';
import type { VariableResolver } from './model';
import type { RenderedProperty } from './render-engine';

/**
 * What a created note carries because of its kind, rather than because its
 * template happened to say so (ADR 0013).
 *
 * A template controls presentation, body, declared inputs, and any extra
 * properties it wants. It does not control whether a task ends up with a
 * status, a rank, or its planning shape — that is the difference between a
 * template and a schema. A body-only template therefore still renders a valid
 * note, and a template that forgets a field cannot produce one that the parser
 * will later report as broken.
 *
 * This supersedes how ADR 0010 keeps the planning properties visible: it is the
 * same contract, moved from the packaged task template into the kind, so it
 * holds for every template rather than only that one.
 */

export type CreationFieldPresence =
  /** Must end up present; an unresolvable value is an error. */
  | 'required'
  /** Present even when unset, as `key: null`, so the note shows its shape. */
  | 'visible'
  /** Present only when the context supplies a value. */
  | 'optional'
  /** Present with a fixed fallback when nothing else supplies one. */
  | 'defaulted';

export interface CreationField {
  readonly key: string;
  /** Context variable consulted when the template does not declare the key. */
  readonly token: string;
  readonly presence: CreationFieldPresence;
  /** Fallback for a `defaulted` field. */
  readonly fallback?: unknown;
}

export interface CreationProfile {
  readonly kind: string;
  readonly fields: readonly CreationField[];
}

/**
 * Task fields the kind owns. `epic` through `due_date` are ADR 0010's seven
 * planning properties, plus ADR 0014's `category`: visible even when unset, because their absence means
 * "not set yet" and Obsidian only learns a property from notes that carry it.
 * `depends_on` and `origin` stay omitted, because their absence carries
 * meaning — a task with no prerequisites is not a task with unknown ones.
 */
export const TASK_CREATION_PROFILE: CreationProfile = {
  kind: 'task',
  fields: [
    { key: 'title', token: 'title', presence: 'required' },
    { key: 'status', token: 'status', presence: 'required' },
    { key: 'epic', token: 'epic_link', presence: 'visible' },
    { key: 'milestone', token: 'milestone_link', presence: 'visible' },
    { key: 'sprint', token: 'planning_period_link', presence: 'visible' },
    { key: 'owner', token: 'owner', presence: 'visible' },
    { key: 'category', token: 'category', presence: 'visible' },
    { key: 'priority', token: 'priority', presence: 'visible' },
    { key: 'points', token: 'points', presence: 'visible' },
    // Optional here, and allocated by the application for every created task:
    // the renderer serves callers that have no backlog to rank against, and a
    // domain that demanded a rank it cannot compute would be lying about who
    // owns the value.
    { key: 'rank', token: 'rank', presence: 'optional' },
    { key: 'due_date', token: 'due_date', presence: 'visible' },
    { key: 'depends_on', token: 'dependency_links', presence: 'optional' },
    { key: 'origin', token: 'origin_link', presence: 'optional' },
  ],
};

/**
 * Project fields the kind owns. A project's status defaults rather than being
 * required: the packaged template ships `planned`, and a project created
 * without a chosen status should read the same way whatever template made it.
 */
export const PROJECT_CREATION_PROFILE: CreationProfile = {
  kind: 'project',
  fields: [
    { key: 'title', token: 'title', presence: 'required' },
    {
      key: 'status',
      token: 'status',
      presence: 'defaulted',
      fallback: 'planned',
    },
  ],
};

/**
 * Add the fields a kind owns that the template did not already declare.
 *
 * A template that declares one of these keeps its position and its value, so
 * an existing template renders exactly the bytes it rendered before. Only the
 * gaps are filled, and they are appended in profile order so the same template
 * always produces the same output.
 */
export function applyCreationProfile(
  properties: readonly RenderedProperty[],
  profile: CreationProfile,
  resolve: VariableResolver,
  path: string,
  diagnostics: Diagnostic[],
): readonly RenderedProperty[] {
  const declared = new Set(properties.map((property) => property.key));
  const added: RenderedProperty[] = [];

  for (const field of profile.fields) {
    if (declared.has(field.key)) {
      continue;
    }
    const variable = resolve(field.token);
    if (variable.status === 'value') {
      added.push({ key: field.key, value: unwrap(variable.value) });
      continue;
    }
    // An error resolving one of these is the template's problem to report; the
    // profile only decides what a missing value means.
    if (variable.status === 'error') {
      continue;
    }
    switch (field.presence) {
      case 'required':
        diagnostics.push(
          templateDiagnostic(
            path,
            'template.profile.required_unset',
            'error',
            `A created ${profile.kind} needs \`${field.key}\`, and nothing supplied it.`,
            field.key,
            `Supply ${field.key} in the creation request, or declare it in the template.`,
          ),
        );
        break;
      case 'visible':
        added.push({ key: field.key, value: null });
        break;
      case 'defaulted':
        added.push({ key: field.key, value: field.fallback ?? null });
        break;
      case 'optional':
        break;
    }
  }

  return added.length === 0 ? properties : [...properties, ...added];
}

/** Template values arrive tagged; frontmatter wants the plain value. */
function unwrap(value: {
  readonly kind: string;
  readonly value: unknown;
}): unknown {
  return value.value;
}
