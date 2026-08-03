import { normalizeVaultPath } from '../domain/markdown-parser';
import { isTerminalTaskStatus } from '../domain/model';
import type {
  Diagnostic,
  DiagnosticSeverity,
  EntityRecord,
  IndexFreshness,
  ProjectEntity,
  TaskEntity,
  TaskPriority,
} from '../domain/model';
import type { IndexSnapshot } from '../indexing/index-snapshot';
import type { ProjectWeaveReadPublication } from './project-weave-read-source';

const DEFAULT_READY_DISPLAY_LIMIT = 10;
const MAX_READY_DISPLAY_LIMIT = 200;
const DEFAULT_DIAGNOSTIC_DISPLAY_LIMIT = 10;
const MAX_DIAGNOSTIC_DISPLAY_LIMIT = 200;

/**
 * The subset of a Project Weave read revision needed by this pure projection.
 * A richer publication, including a snapshot-bound query API, is structurally
 * compatible with this interface.
 */
export type ProjectWorkbenchReadPublication = Pick<
  ProjectWeaveReadPublication,
  'publicationId' | 'runtimeGeneration' | 'snapshot'
>;

export interface ProjectWorkbenchProjectionInput {
  readonly publication: ProjectWorkbenchReadPublication;
  readonly selectedProjectPath: string | null;
  readonly activePath?: string | null;
  readonly readyDisplayLimit: number;
  readonly diagnosticDisplayLimit?: number;
  readonly unassignedDiagnosticDisplayLimit?: number;
}

export interface ProjectWorkbenchBanner {
  readonly kind: 'rebuilding' | 'stale_last_good';
  readonly message: string;
}

export interface ProjectWorkbenchProjectOption {
  readonly path: string;
  readonly title: string;
  readonly status: ProjectEntity['status'];
}

export interface ProjectWorkbenchReadyItem {
  readonly path: string;
  readonly title: string;
  readonly rank: number | null;
  readonly priority: TaskPriority;
  readonly unlockCount: number;
}

export interface ProjectWorkbenchReadyModel {
  readonly items: readonly ProjectWorkbenchReadyItem[];
  readonly total: number;
  readonly displayed: number;
  readonly truncated: boolean;
}

export interface ProjectWorkbenchDiagnosticItem {
  readonly severity: DiagnosticSeverity;
  readonly code: string;
  readonly path: string;
  readonly field?: string;
  readonly message: string;
  readonly recovery?: string;
  readonly relatedPaths?: readonly string[];
}

export interface ProjectWorkbenchDiagnosticsModel {
  readonly items: readonly ProjectWorkbenchDiagnosticItem[];
  readonly total: number;
  readonly errors: number;
  readonly warnings: number;
  readonly info: number;
  readonly displayed: number;
  readonly truncated: boolean;
}

export interface ProjectWorkbenchCounts {
  readonly tasks: number;
  readonly diagnostics: number;
  readonly ready: number;
  readonly inProgress: number;
  readonly blocked: number;
}

interface ProjectWorkbenchBaseModel {
  readonly publicationId: number;
  readonly runtimeGeneration: number;
  readonly indexRevision: number;
  readonly indexFreshness: IndexFreshness;
  readonly banner: ProjectWorkbenchBanner | null;
  readonly projectOptions: readonly ProjectWorkbenchProjectOption[];
  readonly unassignedDiagnostics: ProjectWorkbenchDiagnosticsModel;
}

export interface ProjectWorkbenchLoadingModel extends ProjectWorkbenchBaseModel {
  readonly state: 'loading';
}

export interface ProjectWorkbenchNoProjectsModel extends ProjectWorkbenchBaseModel {
  readonly state: 'no_projects';
}

export interface ProjectWorkbenchChooseProjectModel extends ProjectWorkbenchBaseModel {
  readonly state: 'choose_project';
}

export interface ProjectWorkbenchProjectUnavailableModel extends ProjectWorkbenchBaseModel {
  readonly state: 'project_unavailable';
  readonly requestedProjectPath: string;
}

export interface ProjectWorkbenchProjectModel extends ProjectWorkbenchBaseModel {
  readonly state: 'project';
  readonly project: ProjectWorkbenchProjectOption;
  readonly counts: ProjectWorkbenchCounts;
  readonly diagnostics: ProjectWorkbenchDiagnosticsModel;
  readonly taskState: 'no_tasks' | 'no_ready' | 'has_ready';
  readonly ready: ProjectWorkbenchReadyModel;
}

export type ProjectWorkbenchModel =
  | ProjectWorkbenchLoadingModel
  | ProjectWorkbenchNoProjectsModel
  | ProjectWorkbenchChooseProjectModel
  | ProjectWorkbenchProjectUnavailableModel
  | ProjectWorkbenchProjectModel;

export function buildProjectWorkbenchModel(
  input: ProjectWorkbenchProjectionInput,
): ProjectWorkbenchModel {
  const { publication } = input;
  const { snapshot } = publication;
  const projects = getProjects(snapshot);
  const unassignedDiagnostics = diagnosticsModel(
    getUnassignedDiagnostics(snapshot, projects),
    input.unassignedDiagnosticDisplayLimit,
  );
  const base = {
    publicationId: publication.publicationId,
    runtimeGeneration: publication.runtimeGeneration,
    indexRevision: snapshot.revision,
    indexFreshness: snapshot.freshness,
    banner: freshnessBanner(snapshot),
    projectOptions: projects.map(projectOption),
    unassignedDiagnostics,
  } as const;

  if (snapshot.revision === 0 && snapshot.freshness === 'rebuilding') {
    return { ...base, state: 'loading' };
  }

  const selectedProjectPath = normalizeOptionalPath(input.selectedProjectPath);
  if (selectedProjectPath !== null) {
    const selected = projects.find(
      (project) => project.path === selectedProjectPath,
    );
    if (selected === undefined) {
      return {
        ...base,
        state: 'project_unavailable',
        requestedProjectPath: selectedProjectPath,
      };
    }
    return projectModel(
      base,
      selected,
      snapshot,
      input.readyDisplayLimit,
      input.diagnosticDisplayLimit,
    );
  }

  if (projects.length === 0) {
    return { ...base, state: 'no_projects' };
  }

  const inferred = inferProject(snapshot, projects, input.activePath);
  if (inferred === null) {
    return { ...base, state: 'choose_project' };
  }
  return projectModel(
    base,
    inferred,
    snapshot,
    input.readyDisplayLimit,
    input.diagnosticDisplayLimit,
  );
}

function projectModel(
  base: ProjectWorkbenchBaseModel,
  project: ProjectEntity,
  snapshot: IndexSnapshot,
  requestedReadyDisplayLimit: number,
  requestedDiagnosticDisplayLimit: number | undefined,
): ProjectWorkbenchProjectModel {
  const tasks = snapshot.getTasksForProject(project.path);
  const scopedDiagnostics = getProjectDiagnostics(snapshot, project.path);
  const readyTasks = tasks
    .filter(
      (task) =>
        task.status === 'todo' &&
        snapshot.getReadiness(task.path)?.ready === true,
    )
    .sort(compareReadyTask);
  const limit = normalizeReadyDisplayLimit(requestedReadyDisplayLimit);
  const items = readyTasks.slice(0, limit).map((task) => ({
    path: task.path,
    title: task.title,
    rank: task.rank,
    priority: task.priority ?? 'normal',
    unlockCount: countProjectTaskDependents(snapshot, task.path, project.path),
  }));
  const totalReady = readyTasks.length;
  const diagnosticLimit = normalizeDiagnosticDisplayLimit(
    requestedDiagnosticDisplayLimit,
  );
  const diagnostics = diagnosticsModel(scopedDiagnostics, diagnosticLimit);

  return {
    ...base,
    state: 'project',
    project: projectOption(project),
    counts: {
      tasks: tasks.length,
      diagnostics: scopedDiagnostics.length,
      ready: totalReady,
      inProgress: tasks.filter((task) => task.status === 'in-progress').length,
      blocked: tasks.filter(
        (task) =>
          !isTerminalTaskStatus(task.status) &&
          (snapshot.getReadiness(task.path)?.blockers.length ?? 0) > 0,
      ).length,
    },
    diagnostics,
    taskState:
      tasks.length === 0
        ? 'no_tasks'
        : totalReady === 0
          ? 'no_ready'
          : 'has_ready',
    ready: {
      items,
      total: totalReady,
      displayed: items.length,
      truncated: items.length < totalReady,
    },
  };
}

function inferProject(
  snapshot: IndexSnapshot,
  projects: readonly ProjectEntity[],
  activePath: string | null | undefined,
): ProjectEntity | null {
  const normalizedActivePath = normalizeOptionalPath(activePath);
  if (normalizedActivePath !== null) {
    const active = snapshot.getEntity(normalizedActivePath);
    if (active?.kind === 'project') {
      return projects.find((project) => project.path === active.path) ?? null;
    }
    if (active !== undefined) {
      const projectPath = active.project?.resolvedPath;
      if (projectPath !== undefined) {
        return projects.find((project) => project.path === projectPath) ?? null;
      }
    }
  }
  return projects.length === 1 ? (projects[0] ?? null) : null;
}

function getProjects(snapshot: IndexSnapshot): readonly ProjectEntity[] {
  return snapshot
    .getEntities('project')
    .filter(
      (entity): entity is ProjectEntity =>
        entity.kind === 'project' && entity.status !== 'archived',
    );
}

function projectOption(project: ProjectEntity): ProjectWorkbenchProjectOption {
  return {
    path: project.path,
    title: project.title,
    status: project.status,
  };
}

function getProjectDiagnostics(
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

function getUnassignedDiagnostics(
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

function entityBelongsToProject(
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

function projectDiagnosticItem(
  diagnostic: Diagnostic,
): ProjectWorkbenchDiagnosticItem {
  return {
    severity: diagnostic.severity,
    code: diagnostic.code,
    path: diagnostic.path,
    ...(diagnostic.field === undefined ? {} : { field: diagnostic.field }),
    message: diagnostic.message,
    ...(diagnostic.recovery === undefined
      ? {}
      : { recovery: diagnostic.recovery }),
    ...(diagnostic.relatedPaths === undefined
      ? {}
      : { relatedPaths: [...diagnostic.relatedPaths] }),
  };
}

function diagnosticsModel(
  diagnostics: readonly Diagnostic[],
  requestedDisplayLimit: number | undefined,
): ProjectWorkbenchDiagnosticsModel {
  const displayLimit = normalizeDiagnosticDisplayLimit(requestedDisplayLimit);
  const items = diagnostics.slice(0, displayLimit).map(projectDiagnosticItem);
  return {
    items,
    total: diagnostics.length,
    errors: diagnostics.filter((issue) => issue.severity === 'error').length,
    warnings: diagnostics.filter((issue) => issue.severity === 'warning')
      .length,
    info: diagnostics.filter((issue) => issue.severity === 'info').length,
    displayed: items.length,
    truncated: items.length < diagnostics.length,
  };
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

function diagnosticSeverityOrder(severity: DiagnosticSeverity): number {
  switch (severity) {
    case 'error':
      return 0;
    case 'warning':
      return 1;
    case 'info':
      return 2;
  }
}

function countProjectTaskDependents(
  snapshot: IndexSnapshot,
  taskPath: string,
  projectPath: string,
): number {
  return snapshot.getDependents(taskPath).filter((dependentPath) => {
    const dependent = snapshot.getEntity(dependentPath);
    return (
      dependent?.kind === 'task' &&
      dependent.project?.resolvedPath === projectPath
    );
  }).length;
}

function compareReadyTask(left: TaskEntity, right: TaskEntity): number {
  if (left.rank !== null || right.rank !== null) {
    if (left.rank === null) {
      return 1;
    }
    if (right.rank === null) {
      return -1;
    }
    if (left.rank !== right.rank) {
      return left.rank - right.rank;
    }
  }
  return (
    priorityOrder(left.priority) - priorityOrder(right.priority) ||
    comparePath(left.path, right.path)
  );
}

function priorityOrder(priority: TaskPriority | null): number {
  switch (priority ?? 'normal') {
    case 'critical':
      return 0;
    case 'high':
      return 1;
    case 'normal':
      return 2;
    case 'low':
      return 3;
  }
}

function normalizeReadyDisplayLimit(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_READY_DISPLAY_LIMIT;
  }
  return Math.min(MAX_READY_DISPLAY_LIMIT, Math.max(1, Math.trunc(value)));
}

function normalizeDiagnosticDisplayLimit(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return DEFAULT_DIAGNOSTIC_DISPLAY_LIMIT;
  }
  return Math.min(MAX_DIAGNOSTIC_DISPLAY_LIMIT, Math.max(1, Math.trunc(value)));
}

function normalizeOptionalPath(
  value: string | null | undefined,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const normalized = normalizeVaultPath(value.trim());
  return normalized.length === 0 ? null : normalized;
}

function freshnessBanner(
  snapshot: IndexSnapshot,
): ProjectWorkbenchBanner | null {
  switch (snapshot.freshness) {
    case 'current':
      return null;
    case 'rebuilding':
      return {
        kind: 'rebuilding',
        message: `Index revision ${String(snapshot.revision)} is rebuilding.`,
      };
    case 'stale_last_good':
      return {
        kind: 'stale_last_good',
        message: `Showing stale index revision ${String(snapshot.revision)}; some data may be out of date.`,
      };
  }
}

function comparePath(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: 'accent' });
}
