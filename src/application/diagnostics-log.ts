import type {
  Diagnostic,
  DiagnosticSeverity,
  IndexFreshness,
  ProjectEntity,
} from '../domain/model';
import type { IndexSnapshot } from '../indexing/index-snapshot';
import {
  getProjectDiagnostics,
  getUnassignedDiagnostics,
} from './project-diagnostics';

export const DIAGNOSTICS_LOG_SCHEMA_VERSION = 1;
export const DIAGNOSTICS_LOG_FILENAME = 'diagnostics.json';

export interface DiagnosticsLogProject {
  readonly path: string;
  readonly title: string;
  readonly status: ProjectEntity['status'];
  readonly diagnostics: readonly Diagnostic[];
}

export interface DiagnosticsLogCounts {
  readonly total: number;
  readonly errors: number;
  readonly warnings: number;
  readonly info: number;
}

export interface DiagnosticsLogDocument {
  readonly schema_version: number;
  readonly generated_at: string;
  readonly index_revision: number;
  readonly index_freshness: IndexFreshness;
  readonly project_roots: readonly string[];
  readonly counts: DiagnosticsLogCounts;
  readonly projects: readonly DiagnosticsLogProject[];
  readonly unassigned: readonly Diagnostic[];
}

export function buildDiagnosticsLogDocument(
  snapshot: IndexSnapshot,
  projectRoots: readonly string[],
  generatedAt: number,
): DiagnosticsLogDocument {
  const projectEntities = snapshot
    .getEntities('project')
    .filter((entity): entity is ProjectEntity => entity.kind === 'project');
  const projects = projectEntities.map((project) => ({
    path: project.path,
    title: project.title,
    status: project.status,
    diagnostics: getProjectDiagnostics(snapshot, project.path),
  }));
  const unassigned = getUnassignedDiagnostics(snapshot, projectEntities);
  const allDiagnostics = [
    ...projects.flatMap((project) => project.diagnostics),
    ...unassigned,
  ];

  return {
    schema_version: DIAGNOSTICS_LOG_SCHEMA_VERSION,
    generated_at: new Date(generatedAt).toISOString(),
    index_revision: snapshot.revision,
    index_freshness: snapshot.freshness,
    project_roots: [...projectRoots],
    counts: countDiagnostics(allDiagnostics),
    projects,
    unassigned,
  };
}

export function serializeDiagnosticsLog(
  document: DiagnosticsLogDocument,
): string {
  return JSON.stringify(document, null, 2) + '\n';
}

function countDiagnostics(
  diagnostics: readonly Diagnostic[],
): DiagnosticsLogCounts {
  return {
    total: diagnostics.length,
    errors: countSeverity(diagnostics, 'error'),
    warnings: countSeverity(diagnostics, 'warning'),
    info: countSeverity(diagnostics, 'info'),
  };
}

function countSeverity(
  diagnostics: readonly Diagnostic[],
  severity: DiagnosticSeverity,
): number {
  return diagnostics.filter((diagnostic) => diagnostic.severity === severity)
    .length;
}
