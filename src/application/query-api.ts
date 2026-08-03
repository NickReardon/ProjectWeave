import { normalizeVaultPath } from '../domain/markdown-parser';
import type {
  Diagnostic,
  EntityRecord,
  EntityType,
  IndexFreshness,
  ProjectEntity,
  TaskEntity,
  TaskPriority,
  TaskStatus,
} from '../domain/model';
import type { IndexSnapshot } from '../indexing/index-snapshot';

const SCHEMA_VERSION = 1;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export interface EntityRef {
  readonly kind: EntityType;
  readonly path: string;
  readonly fingerprint: string;
}

export interface PageMetadata {
  readonly limit: number;
  readonly next_cursor: string | null;
  readonly truncated: boolean;
}

export interface QueryEnvelope {
  readonly schema_version: number;
  readonly index_revision: number;
  readonly index_freshness: IndexFreshness;
}

export interface QueryFailure extends QueryEnvelope {
  readonly ok: false;
  readonly project_ref: EntityRef | null;
  readonly diagnostics: readonly Diagnostic[];
}

export interface ListProjectsInput {
  readonly includeArchived?: boolean;
  readonly cursor?: string;
  readonly limit?: number;
}

export interface ProjectSummary {
  readonly ref: EntityRef;
  readonly title: string;
  readonly status: ProjectEntity['status'];
}

export interface ProjectListResult extends QueryEnvelope {
  readonly ok: true;
  readonly items: readonly ProjectSummary[];
  readonly page: PageMetadata;
}

export interface ProjectContextInput {
  readonly projectPath: string;
}

export interface ProjectContextResult extends QueryEnvelope {
  readonly ok: true;
  readonly project_ref: EntityRef;
  readonly title: string;
  readonly status: ProjectEntity['status'];
  readonly capabilities: {
    readonly epics: { readonly in_use: boolean };
    readonly milestones: { readonly in_use: boolean };
    readonly planning_period: {
      readonly in_use: boolean;
      readonly label: ProjectEntity['workflow']['planningPeriodLabel'];
    };
    readonly estimation: {
      readonly in_use: boolean;
      readonly unit: 'points';
      readonly required: boolean;
    };
    readonly owners: { readonly in_use: boolean };
  };
  readonly policies: {
    readonly dependency_mode: ProjectEntity['workflow']['dependencyMode'];
    readonly owner_required_on_board: boolean;
    readonly estimate_required_in_period: boolean;
  };
  readonly counts: {
    readonly tasks: number;
    readonly diagnostics: number;
  };
}

export interface ReadyNowInput {
  readonly projectPath: string;
  readonly cursor?: string;
  readonly limit?: number;
}

export interface ReadyNowItem {
  readonly ref: EntityRef;
  readonly title: string;
  readonly status: Extract<TaskStatus, 'todo'>;
  readonly rank: number | null;
  readonly priority: TaskPriority;
  readonly unlocks: readonly EntityRef[];
}

export interface ReadyNowResult extends QueryEnvelope {
  readonly ok: true;
  readonly project_ref: EntityRef;
  readonly focus: 'ready_now';
  readonly items: readonly ReadyNowItem[];
  readonly page: PageMetadata;
}

export interface TaskContextInput {
  readonly projectPath: string;
  readonly taskPath: string;
}

export interface TaskContextResult extends QueryEnvelope {
  readonly ok: true;
  readonly project_ref: EntityRef;
  readonly task: {
    readonly ref: EntityRef;
    readonly title: string;
    readonly status: TaskStatus | null;
    readonly ready: boolean;
    readonly blocked_by: readonly EntityRef[];
    readonly unlocks: readonly EntityRef[];
  };
}

export class ProjectWeaveQueryApi {
  readonly #getSnapshot: () => IndexSnapshot;

  public constructor(getSnapshot: () => IndexSnapshot) {
    this.#getSnapshot = getSnapshot;
  }

  public async listProjects(
    input: ListProjectsInput = {},
  ): Promise<ProjectListResult | QueryFailure> {
    const snapshot = this.#getSnapshot();
    const page = parsePage(input.cursor, input.limit, snapshot);
    if (!page.ok) {
      return page.failure;
    }

    const projects = snapshot
      .getEntities('project')
      .filter((entity): entity is ProjectEntity => entity.kind === 'project')
      .filter(
        (project) =>
          input.includeArchived === true || project.status !== 'archived',
      )
      .map((project) => ({
        ref: entityRef(project),
        title: project.title,
        status: project.status,
      }));
    const window = projects.slice(page.offset, page.offset + page.limit);

    return {
      ok: true,
      ...envelope(snapshot),
      items: window,
      page: pageMetadata(page.offset, page.limit, projects.length),
    };
  }

  public async getProjectContext(
    input: ProjectContextInput,
  ): Promise<ProjectContextResult | QueryFailure> {
    const snapshot = this.#getSnapshot();
    const project = getProject(snapshot, input.projectPath);
    if (project === null) {
      return projectFailure(snapshot, input.projectPath);
    }

    const tasks = snapshot.getTasksForProject(project.path);
    const projectEntities = snapshot
      .getEntities()
      .filter(
        (entity) =>
          entity.kind !== 'project' &&
          entity.project?.resolvedPath === project.path,
      );
    const projectDiagnostics = snapshot.diagnostics.filter(
      (issue) =>
        issue.path === project.path ||
        projectEntities.some((entity) => entity.path === issue.path),
    );

    return {
      ok: true,
      ...envelope(snapshot),
      project_ref: entityRef(project),
      title: project.title,
      status: project.status,
      capabilities: {
        epics: {
          in_use: projectEntities.some((entity) => entity.kind === 'epic'),
        },
        milestones: {
          in_use: projectEntities.some((entity) => entity.kind === 'milestone'),
        },
        planning_period: {
          in_use:
            projectEntities.some((entity) => entity.kind === 'sprint') ||
            tasks.some((task) => task.planningPeriod !== null),
          label: project.workflow.planningPeriodLabel,
        },
        estimation: {
          in_use:
            project.workflow.estimation === 'points' ||
            tasks.some((task) => task.points !== null),
          unit: 'points',
          required: project.workflow.estimateRequiredInPeriod,
        },
        owners: { in_use: tasks.some((task) => task.owner !== null) },
      },
      policies: {
        dependency_mode: project.workflow.dependencyMode,
        owner_required_on_board: project.workflow.ownerRequiredOnBoard,
        estimate_required_in_period: project.workflow.estimateRequiredInPeriod,
      },
      counts: {
        tasks: tasks.length,
        diagnostics: projectDiagnostics.length,
      },
    };
  }

  public async getReadyNow(
    input: ReadyNowInput,
  ): Promise<ReadyNowResult | QueryFailure> {
    const snapshot = this.#getSnapshot();
    const project = getProject(snapshot, input.projectPath);
    if (project === null) {
      return projectFailure(snapshot, input.projectPath);
    }
    const page = parsePage(input.cursor, input.limit, snapshot, project);
    if (!page.ok) {
      return page.failure;
    }

    const readyTasks = snapshot
      .getTasksForProject(project.path)
      .filter(
        (task) =>
          task.status === 'todo' &&
          snapshot.getReadiness(task.path)?.ready === true,
      )
      .sort(compareReadyTask);
    const window = readyTasks.slice(page.offset, page.offset + page.limit);

    return {
      ok: true,
      ...envelope(snapshot),
      project_ref: entityRef(project),
      focus: 'ready_now',
      items: window.map((task) => ({
        ref: entityRef(task),
        title: task.title,
        status: 'todo',
        rank: task.rank,
        priority: task.priority ?? 'normal',
        unlocks: projectTaskRefs(
          snapshot,
          snapshot.getDependents(task.path),
          project.path,
        ),
      })),
      page: pageMetadata(page.offset, page.limit, readyTasks.length),
    };
  }

  public async getTaskContext(
    input: TaskContextInput,
  ): Promise<TaskContextResult | QueryFailure> {
    const snapshot = this.#getSnapshot();
    const project = getProject(snapshot, input.projectPath);
    if (project === null) {
      return projectFailure(snapshot, input.projectPath);
    }
    const entity = snapshot.getEntity(input.taskPath);
    if (
      entity?.kind !== 'task' ||
      entity.project?.resolvedPath !== project.path
    ) {
      return failure(snapshot, project, {
        code: 'query.task.not_found',
        severity: 'error',
        path: normalizeVaultPath(input.taskPath),
        message: 'The requested task is not indexed in the selected project.',
      });
    }
    const readiness = snapshot.getReadiness(entity.path) ?? {
      ready: false,
      blockers: [],
    };

    return {
      ok: true,
      ...envelope(snapshot),
      project_ref: entityRef(project),
      task: {
        ref: entityRef(entity),
        title: entity.title,
        status: entity.status,
        ready: readiness.ready,
        blocked_by: projectTaskRefs(
          snapshot,
          readiness.blockers.flatMap((blocker) =>
            blocker.path === undefined ? [] : [blocker.path],
          ),
          project.path,
        ),
        unlocks: projectTaskRefs(
          snapshot,
          snapshot.getDependents(entity.path),
          project.path,
        ),
      },
    };
  }
}

function getProject(
  snapshot: IndexSnapshot,
  path: string,
): ProjectEntity | null {
  const entity = snapshot.getEntity(path);
  return entity?.kind === 'project' ? entity : null;
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

function entityRef(entity: EntityRecord): EntityRef {
  return {
    kind: entity.kind,
    path: entity.path,
    fingerprint: entity.fingerprint,
  };
}

function projectTaskRefs(
  snapshot: IndexSnapshot,
  paths: readonly string[],
  projectPath: string,
): readonly EntityRef[] {
  return paths.flatMap((path) => {
    const entity = snapshot.getEntity(path);
    return entity?.kind === 'task' &&
      entity.project?.resolvedPath === projectPath
      ? [entityRef(entity)]
      : [];
  });
}

function envelope(snapshot: IndexSnapshot): QueryEnvelope {
  return {
    schema_version: SCHEMA_VERSION,
    index_revision: snapshot.revision,
    index_freshness: snapshot.freshness,
  };
}

function projectFailure(
  snapshot: IndexSnapshot,
  projectPath: string,
): QueryFailure {
  return failure(snapshot, null, {
    code: 'query.project.not_found',
    severity: 'error',
    path: normalizeVaultPath(projectPath),
    message: 'The requested project is not indexed as a project note.',
    recovery: 'Select a valid project note and rebuild the index if needed.',
  });
}

function failure(
  snapshot: IndexSnapshot,
  project: ProjectEntity | null,
  issue: Diagnostic,
): QueryFailure {
  return {
    ok: false,
    ...envelope(snapshot),
    project_ref: project === null ? null : entityRef(project),
    diagnostics: [issue],
  };
}

function parsePage(
  cursor: string | undefined,
  requestedLimit: number | undefined,
  snapshot: IndexSnapshot,
  project: ProjectEntity | null = null,
):
  | { readonly ok: true; readonly offset: number; readonly limit: number }
  | { readonly ok: false; readonly failure: QueryFailure } {
  const finiteLimit =
    requestedLimit === undefined || !Number.isFinite(requestedLimit)
      ? DEFAULT_LIMIT
      : Math.trunc(requestedLimit);
  const limit = Math.min(MAX_LIMIT, Math.max(1, finiteLimit));
  if (cursor === undefined) {
    return { ok: true, offset: 0, limit };
  }
  const match = /^offset:(\d+)$/u.exec(cursor);
  if (match === null) {
    return {
      ok: false,
      failure: failure(snapshot, project, {
        code: 'query.cursor.invalid',
        severity: 'error',
        path: project?.path ?? '',
        message: 'The collection cursor is invalid or expired.',
        recovery: 'Restart the query without a cursor.',
      }),
    };
  }
  const offset = Number(match[1]);
  if (!Number.isSafeInteger(offset)) {
    return {
      ok: false,
      failure: failure(snapshot, project, {
        code: 'query.cursor.invalid',
        severity: 'error',
        path: project?.path ?? '',
        message: 'The collection cursor is invalid or expired.',
        recovery: 'Restart the query without a cursor.',
      }),
    };
  }
  return { ok: true, offset, limit };
}

function pageMetadata(
  offset: number,
  limit: number,
  total: number,
): PageMetadata {
  const nextOffset = offset + limit;
  const truncated = nextOffset < total;
  return {
    limit,
    next_cursor: truncated ? `offset:${String(nextOffset)}` : null,
    truncated,
  };
}

function comparePath(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: 'accent' });
}
