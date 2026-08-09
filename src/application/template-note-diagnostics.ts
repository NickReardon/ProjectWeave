import { normalizeVaultPath } from '../domain/markdown-parser';
import type { Diagnostic } from '../domain/model';
import { templateDiagnostic } from '../domain/templates/model';
import { parseTemplateDocument } from '../domain/templates/template-parser';

const KEY_PATTERN = /^[a-z0-9_-]+$/u;

/** Whether a Markdown path belongs to a configured template library folder. */
export function isInTemplateLibrary(
  path: string,
  libraryFolder: string,
): boolean {
  const folder = normalizeFolder(libraryFolder);
  return (
    folder.length > 0 &&
    normalizeVaultPath(path)
      .toLowerCase()
      .startsWith(folder.toLowerCase() + '/')
  );
}

/** Validate one vault template note without adding it to the project index. */
export function diagnoseTemplateNote(
  path: string,
  content: string,
  libraryFolder: string,
): readonly Diagnostic[] {
  const normalizedPath = normalizeVaultPath(path);
  const folder = normalizeFolder(libraryFolder);
  if (!isInTemplateLibrary(normalizedPath, folder)) {
    return [];
  }

  const relative = normalizedPath.slice(folder.length + 1).split('/');
  const kind = relative[0] ?? '';
  const file = relative[1] ?? '';
  if (relative.length !== 2 || !file.toLowerCase().endsWith('.md')) {
    return [
      issue(
        normalizedPath,
        'template.library.path_invalid',
        'This Markdown note is inside the template library but is not at `<library>/<kind>/<variant>.md`.',
        'path',
        'Move it into a kind folder and name it for the template variant, such as `task/bug.md`.',
      ),
    ];
  }

  const variant = file.slice(0, -3).toLowerCase();
  const diagnostics: Diagnostic[] = [];
  if (!KEY_PATTERN.test(kind.toLowerCase())) {
    diagnostics.push(
      issue(
        normalizedPath,
        'template.library.kind_invalid',
        `\`${kind}\` is not a usable template kind folder.`,
        'template_for',
        'Use lowercase letters, digits, underscores, or hyphens for the kind folder.',
      ),
    );
  }
  if (!KEY_PATTERN.test(variant)) {
    diagnostics.push(
      issue(
        normalizedPath,
        'template.library.variant_invalid',
        `\`${file}\` is not a usable template variant filename.`,
        'variant',
        'Use lowercase letters, digits, underscores, or hyphens for the filename.',
      ),
    );
  }

  const document = parseTemplateDocument({
    path: normalizedPath,
    content,
  });
  diagnostics.push(...document.diagnostics.map(libraryContextDiagnostic));
  if (
    document.metadata.templateFor !== null &&
    document.metadata.templateFor !== kind.toLowerCase()
  ) {
    diagnostics.push(
      issue(
        normalizedPath,
        'template.kind_mismatch',
        `The template declares ${document.metadata.templateFor}, not ${kind.toLowerCase()}.`,
        'template_for',
        'Move the template to the folder for its own kind, or correct template_for.',
      ),
    );
  }
  return diagnostics;
}

function libraryContextDiagnostic(diagnostic: Diagnostic): Diagnostic {
  if (diagnostic.code !== 'template.marker.invalid') {
    return diagnostic;
  }
  return {
    ...diagnostic,
    recovery:
      'Remove the optional `weave_template` key, or set it to the Boolean `true`.',
  };
}

function normalizeFolder(folder: string): string {
  return normalizeVaultPath(folder.trim()).replace(/^\/+|\/+$/gu, '');
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
