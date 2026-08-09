import type { Diagnostic, EntityRecord, ProjectEntity } from '../domain/model';
import type { IndexSnapshot } from '../indexing/index-snapshot';

/**
 * Returns diagnostics carried by a project or by an entity assigned to it.
 *
 * Diagnostics for malformed notes that cannot be assigned to a project remain
 * outside this result and can be surfaced as unassigned diagnostics instead.
 */
export function getProjectDiagnostics(
  snapshot: IndexSnapshot,
  projectPath: string,
): readonly Diagnostic[] {
  const projectEntityPaths = new Set(
    snapshot
      .getEntities()
      .filter((entity) => entityBelongsToProject(entity, projectPath))
      .map((entity) => entity.path),
  );
  return snapshot.diagnostics
    .filter(
      (issue) =>
        issue.path === projectPath || projectEntityPaths.has(issue.path),
    )
    .sort(compareDiagnostic);
}

export function entityBelongsToProject(
  entity: EntityRecord,
  projectPath: string,
): boolean {
  if (entity.kind === 'project') {
    return entity.path === projectPath;
  }
  if (entity.project?.resolvedPath === projectPath) {
    return true;
  }
  return (
    entity.kind === 'sprint' &&
    entity.projects.some((project) => project.resolvedPath === projectPath)
  );
}

export function getUnassignedDiagnostics(
  snapshot: IndexSnapshot,
  projects: readonly ProjectEntity[],
): readonly Diagnostic[] {
  const assignedEntityPaths = new Set(
    snapshot
      .getEntities()
      .filter((entity) =>
        projects.some((project) =>
          entityBelongsToProject(entity, project.path),
        ),
      )
      .map((entity) => entity.path),
  );
  return snapshot.diagnostics
    .filter((issue) => !assignedEntityPaths.has(issue.path))
    .sort(compareDiagnostic);
}

function compareDiagnostic(left: Diagnostic, right: Diagnostic): number {
  return (
    diagnosticSeverityOrder(left.severity) -
      diagnosticSeverityOrder(right.severity) ||
    comparePath(left.path, right.path) ||
    left.code.localeCompare(right.code) ||
    (left.field ?? '').localeCompare(right.field ?? '') ||
    left.message.localeCompare(right.message) ||
    (left.recovery ?? '').localeCompare(right.recovery ?? '') ||
    (left.relatedPaths ?? [])
      .join('\n')
      .localeCompare((right.relatedPaths ?? []).join('\n'))
  );
}

function diagnosticSeverityOrder(severity: Diagnostic['severity']): number {
  switch (severity) {
    case 'error':
      return 0;
    case 'warning':
      return 1;
    case 'info':
      return 2;
  }
}

function comparePath(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: 'accent' });
}
