import { normalizeVaultPath } from '../domain/markdown-parser';
import type {
  Diagnostic,
  DiagnosticSeverity,
  IndexFreshness,
} from '../domain/model';
import type { IndexSnapshot } from '../indexing/index-snapshot';

export const NOTE_DIAGNOSTIC_BANNER_DISPLAY_LIMIT = 5;

export interface NoteDiagnosticBannerItem {
  readonly severity: DiagnosticSeverity;
  readonly code: string;
  readonly field?: string;
  readonly message: string;
  readonly recovery?: string;
}

export interface NoteDiagnosticBannerModel {
  readonly path: string;
  readonly freshness: IndexFreshness;
  readonly items: readonly NoteDiagnosticBannerItem[];
  readonly total: number;
  readonly errors: number;
  readonly warnings: number;
  readonly info: number;
  readonly displayed: number;
  readonly truncated: boolean;
  readonly tone: DiagnosticSeverity;
}

export function buildNoteDiagnosticBannerModel(
  snapshot: IndexSnapshot,
  notePath: string,
  requestedDisplayLimit = NOTE_DIAGNOSTIC_BANNER_DISPLAY_LIMIT,
): NoteDiagnosticBannerModel | null {
  const path = normalizeVaultPath(notePath.trim());
  if (path.length === 0) {
    return null;
  }

  const diagnostics = snapshot.diagnostics
    .filter((issue) => issue.path === path)
    .sort(compareDiagnostic);
  if (diagnostics.length === 0) {
    return null;
  }

  const displayLimit = normalizeDisplayLimit(requestedDisplayLimit);
  const items = diagnostics.slice(0, displayLimit).map(diagnosticItem);
  const errors = countSeverity(diagnostics, 'error');
  const warnings = countSeverity(diagnostics, 'warning');
  const info = countSeverity(diagnostics, 'info');

  return {
    path,
    freshness: snapshot.freshness,
    items,
    total: diagnostics.length,
    errors,
    warnings,
    info,
    displayed: items.length,
    truncated: items.length < diagnostics.length,
    tone: errors > 0 ? 'error' : warnings > 0 ? 'warning' : 'info',
  };
}

function diagnosticItem(diagnostic: Diagnostic): NoteDiagnosticBannerItem {
  return {
    severity: diagnostic.severity,
    code: diagnostic.code,
    ...(diagnostic.field === undefined ? {} : { field: diagnostic.field }),
    message: diagnostic.message,
    ...(diagnostic.recovery === undefined
      ? {}
      : { recovery: diagnostic.recovery }),
  };
}

function countSeverity(
  diagnostics: readonly Diagnostic[],
  severity: DiagnosticSeverity,
): number {
  return diagnostics.filter((issue) => issue.severity === severity).length;
}

function compareDiagnostic(left: Diagnostic, right: Diagnostic): number {
  return (
    severityOrder(left.severity) - severityOrder(right.severity) ||
    left.code.localeCompare(right.code) ||
    (left.field ?? '').localeCompare(right.field ?? '') ||
    left.message.localeCompare(right.message) ||
    (left.recovery ?? '').localeCompare(right.recovery ?? '')
  );
}

function severityOrder(severity: DiagnosticSeverity): number {
  switch (severity) {
    case 'error':
      return 0;
    case 'warning':
      return 1;
    case 'info':
      return 2;
  }
}

function normalizeDisplayLimit(value: number): number {
  if (!Number.isFinite(value)) {
    return NOTE_DIAGNOSTIC_BANNER_DISPLAY_LIMIT;
  }
  return Math.max(1, Math.trunc(value));
}
