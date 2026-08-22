import { normalizeVaultPath } from '../domain/markdown-parser';
import type {
  Diagnostic,
  EntityRecord,
  EntityType,
  IndexFreshness,
  ProjectEntity,
  SourceNote,
  TaskEntity,
  TaskPriority,
  TaskStatus,
} from '../domain/model';
import { isTerminalTaskStatus } from '../domain/model';
import type { IndexSnapshot } from '../indexing/index-snapshot';
import type { VaultReader } from '../ports/vault-reader';
import type { TemplateResolver } from './template-resolver';
import {
  DEFAULT_TASK_SEARCH_MODE,
  isTaskSearchMode,
  taskSearchMatcher,
  type TaskSearchMode,
} from './task-search';

const SCHEMA_VERSION = 1;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const DEFAULT_READ_BYTES = 16_384;
const MAX_READ_BYTES = 65_536;

export interface ProjectWeaveQueryDependencies {
  readonly vault?: VaultReader;
  readonly taskTemplates?: () => TemplateResolver;
}

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
  readonly permittedProjectPaths?: readonly string[];
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
  readonly owner?: string;
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
  readonly focus: 'ready_now' | 'my_work';
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

export interface SearchInput {
  readonly projectPath: string;
  readonly query?: string;
  readonly kinds?: readonly EntityType[];
  readonly statuses?: readonly string[];
  readonly includeTerminal?: boolean;
  readonly mode?: TaskSearchMode;
  readonly includeBody?: boolean;
  readonly contentRoots?: readonly string[];
  readonly cursor?: string;
  readonly limit?: number;
}

export interface SearchHit {
  readonly ref: EntityRef | null;
  readonly path: string;
  readonly title: string;
  readonly kind: EntityType | 'document';
  readonly status: string | null;
  readonly score: number;
  readonly snippet: string | null;
}

export interface SearchResult extends QueryEnvelope {
  readonly ok: true;
  readonly project_ref: EntityRef;
  readonly items: readonly SearchHit[];
  readonly page: PageMetadata;
}

export interface ReadNoteInput {
  readonly projectPath: string;
  readonly path: string;
  readonly heading?: string;
  readonly contentRoots?: readonly string[];
  readonly cursor?: string;
  readonly maxBytes?: number;
}

export interface NoteReadResult extends QueryEnvelope {
  readonly ok: true;
  readonly project_ref: EntityRef;
  readonly note: {
    readonly path: string;
    readonly fingerprint: string;
    readonly heading: string | null;
    readonly content: string;
    readonly untrusted: true;
  };
  readonly page: PageMetadata;
}

export interface RelatedWorkInput {
  readonly projectPath: string;
  readonly notePath: string;
  readonly heading?: string;
  readonly cursor?: string;
  readonly limit?: number;
}

export interface RelatedWorkResult extends QueryEnvelope {
  readonly ok: true;
  readonly project_ref: EntityRef;
  readonly items: readonly EntityRef[];
  readonly page: PageMetadata;
}

export interface SequenceInput {
  readonly projectPath: string;
  readonly includeTerminal?: boolean;
  readonly cursor?: string;
  readonly limit?: number;
}

export interface SequenceItem {
  readonly ref: EntityRef;
  readonly title: string;
  readonly status: TaskStatus | null;
  readonly ready: boolean;
  readonly blocked_by: readonly EntityRef[];
}

export interface SequenceResult extends QueryEnvelope {
  readonly ok: true;
  readonly project_ref: EntityRef;
  readonly items: readonly SequenceItem[];
  readonly page: PageMetadata;
}

export interface DiagnosticsInput {
  readonly projectPath: string;
  readonly severities?: readonly Diagnostic['severity'][];
  readonly cursor?: string;
  readonly limit?: number;
}

export interface DiagnosticsResult extends QueryEnvelope {
  readonly ok: true;
  readonly project_ref: EntityRef;
  readonly items: readonly Diagnostic[];
  readonly page: PageMetadata;
}

export interface ActionContextResult extends QueryEnvelope {
  readonly ok: true;
  readonly project_ref: EntityRef;
  readonly entity: TaskContextResult['task'];
  readonly actions: readonly {
    readonly name: 'add_to_board' | 'start' | 'complete';
    readonly enabled: boolean;
    readonly reason_code?: string;
    readonly reason?: string;
  }[];
}

export interface CreationContextInput {
  readonly projectPath: string;
  readonly kind: 'task';
}

export interface CreationContextResult extends QueryEnvelope {
  readonly ok: true;
  readonly project_ref: EntityRef;
  readonly kind: 'task';
  readonly default_variant: 'default';
  readonly available_variants: readonly string[];
  readonly packaged_fallback: 'builtin:minimal';
  readonly task_folder: string;
}

export class ProjectWeaveQueryApi {
  readonly #getSnapshot: () => IndexSnapshot;
  readonly #dependencies: ProjectWeaveQueryDependencies;

  public constructor(
    getSnapshot: () => IndexSnapshot,
    dependencies: ProjectWeaveQueryDependencies = {},
  ) {
    this.#getSnapshot = getSnapshot;
    this.#dependencies = dependencies;
  }

  public async listProjects(
    input: ListProjectsInput = {},
  ): Promise<ProjectListResult | QueryFailure> {
    const snapshot = this.#getSnapshot();
    const page = parsePage(input.cursor, input.limit, snapshot);
    if (!page.ok) return page.failure;
    const permitted = normalizedSet(input.permittedProjectPaths);
    const projects = snapshot
      .getEntities('project')
      .filter((entity): entity is ProjectEntity => entity.kind === 'project')
      .filter((project) => permitted === null || permitted.has(project.path))
      .filter(
        (project) =>
          input.includeArchived === true || project.status !== 'archived',
      )
      .map((project) => ({
        ref: entityRef(project),
        title: project.title,
        status: project.status,
      }));
    return successPage(snapshot, projects, page);
  }

  public async getProjectContext(
    input: ProjectContextInput,
  ): Promise<ProjectContextResult | QueryFailure> {
    const snapshot = this.#getSnapshot();
    const project = getProject(snapshot, input.projectPath);
    if (project === null) return projectFailure(snapshot, input.projectPath);
    const tasks = snapshot.getTasksForProject(project.path);
    const entities = projectEntities(snapshot, project.path);
    const diagnostics = projectDiagnostics(snapshot, project.path);
    return {
      ok: true,
      ...envelope(snapshot),
      project_ref: entityRef(project),
      title: project.title,
      status: project.status,
      capabilities: {
        epics: { in_use: entities.some((one) => one.kind === 'epic') },
        milestones: {
          in_use: entities.some((one) => one.kind === 'milestone'),
        },
        planning_period: {
          in_use:
            entities.some((one) => one.kind === 'sprint') ||
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
      counts: { tasks: tasks.length, diagnostics: diagnostics.length },
    };
  }

  public async getReadyNow(
    input: ReadyNowInput,
  ): Promise<ReadyNowResult | QueryFailure> {
    const snapshot = this.#getSnapshot();
    const project = getProject(snapshot, input.projectPath);
    if (project === null) return projectFailure(snapshot, input.projectPath);
    const page = parsePage(input.cursor, input.limit, snapshot, project);
    if (!page.ok) return page.failure;
    const owner = input.owner?.trim().toLocaleLowerCase();
    const ready = snapshot
      .getTasksForProject(project.path)
      .filter(
        (task) =>
          task.status === 'todo' &&
          snapshot.getReadiness(task.path)?.ready === true &&
          (owner === undefined || task.owner?.toLocaleLowerCase() === owner),
      )
      .sort(compareReadyTask)
      .map((task) => ({
        ref: entityRef(task),
        title: task.title,
        status: 'todo' as const,
        rank: task.rank,
        priority: task.priority ?? 'normal',
        unlocks: projectTaskRefs(
          snapshot,
          snapshot.getDependents(task.path),
          project.path,
        ),
      }));
    const result = successPage(snapshot, ready, page, project);
    return {
      ...result,
      focus: owner === undefined ? 'ready_now' : 'my_work',
    };
  }

  public async getTaskContext(
    input: TaskContextInput,
  ): Promise<TaskContextResult | QueryFailure> {
    const snapshot = this.#getSnapshot();
    const project = getProject(snapshot, input.projectPath);
    if (project === null) return projectFailure(snapshot, input.projectPath);
    const task = projectTask(snapshot, project.path, input.taskPath);
    if (task === null) return taskFailure(snapshot, project, input.taskPath);
    return {
      ok: true,
      ...envelope(snapshot),
      project_ref: entityRef(project),
      task: taskContext(snapshot, task, project.path),
    };
  }

  public async search(
    input: SearchInput,
  ): Promise<SearchResult | QueryFailure> {
    const snapshot = this.#getSnapshot();
    const project = getProject(snapshot, input.projectPath);
    if (project === null) return projectFailure(snapshot, input.projectPath);
    const page = parsePage(input.cursor, input.limit, snapshot, project);
    if (!page.ok) return page.failure;
    const mode = input.mode ?? DEFAULT_TASK_SEARCH_MODE;
    if (!isTaskSearchMode(mode)) {
      return failure(
        snapshot,
        project,
        queryIssue(
          'query.search.mode_invalid',
          project.path,
          'The requested search mode is not supported.',
        ),
      );
    }
    const query = (input.query ?? '').trim().toLocaleLowerCase();
    const matcher = taskSearchMatcher(mode);
    const kinds = input.kinds === undefined ? null : new Set(input.kinds);
    const statuses =
      input.statuses === undefined ? null : new Set(input.statuses);
    const hits: SearchHit[] = [];
    for (const entity of [
      project,
      ...projectEntities(snapshot, project.path),
    ]) {
      if (kinds !== null && !kinds.has(entity.kind)) continue;
      const status = entityStatus(entity);
      if (statuses !== null && (status === null || !statuses.has(status)))
        continue;
      if (
        input.includeTerminal !== true &&
        entity.kind === 'task' &&
        isTerminalTaskStatus(entity.status)
      )
        continue;
      const score = query.length === 0 ? 0 : matcher(entity, query);
      if (score === null) continue;
      hits.push({
        ref: entityRef(entity),
        path: entity.path,
        title: entity.title,
        kind: entity.kind,
        status,
        score,
        snippet: null,
      });
    }
    if (input.includeBody === true && this.#dependencies.vault !== undefined) {
      const roots = normalizeRoots(input.contentRoots);
      for (const note of await this.#dependencies.vault.listMarkdownNotes()) {
        if (
          snapshot.getEntity(note.path) !== undefined ||
          roots.length === 0 ||
          !roots.some((root) => isWithin(note.path, root))
        )
          continue;
        const title = fileTitle(note.path);
        const metadataScore =
          query.length === 0 ? 0 : matcher({ title, path: note.path }, query);
        const bodyIndex =
          query.length === 0
            ? -1
            : note.content.toLocaleLowerCase().indexOf(query);
        if (metadataScore === null && bodyIndex < 0) continue;
        hits.push({
          ref: null,
          path: note.path,
          title,
          kind: 'document',
          status: null,
          score: Math.max(metadataScore ?? 0, bodyIndex >= 0 ? 1 : 0),
          snippet:
            bodyIndex < 0
              ? null
              : snippet(note.content, bodyIndex, query.length),
        });
      }
    }
    hits.sort(
      (left, right) =>
        right.score - left.score || comparePath(left.path, right.path),
    );
    return successPage(snapshot, hits, page, project);
  }

  public async readNote(
    input: ReadNoteInput,
  ): Promise<NoteReadResult | QueryFailure> {
    const snapshot = this.#getSnapshot();
    const project = getProject(snapshot, input.projectPath);
    if (project === null) return projectFailure(snapshot, input.projectPath);
    const path = normalizeVaultPath(input.path);
    if (!canReadPath(snapshot, project.path, path, input.contentRoots)) {
      return failure(
        snapshot,
        project,
        queryIssue(
          'query.read.out_of_scope',
          path,
          'The requested note is outside this project grant.',
        ),
      );
    }
    const vault = this.#dependencies.vault;
    if (vault === undefined) {
      return failure(
        snapshot,
        project,
        queryIssue(
          'query.read.unavailable',
          path,
          'Note content is not available through this query runtime.',
        ),
      );
    }
    const note = await vault.readMarkdownNote(path);
    if (note === null) {
      return failure(
        snapshot,
        project,
        queryIssue(
          'query.read.not_found',
          path,
          'The requested Markdown note is unavailable.',
        ),
      );
    }
    const selected = selectSection(note, input.heading);
    if (!selected.ok) return failure(snapshot, project, selected.issue);
    const offset = parseByteCursor(input.cursor);
    if (offset === null) {
      return failure(
        snapshot,
        project,
        queryIssue(
          'query.cursor.invalid',
          path,
          'The note cursor is invalid or expired.',
        ),
      );
    }
    const limit = boundedReadBytes(input.maxBytes);
    const bytes = new TextEncoder().encode(selected.content);
    if (offset > bytes.length) {
      return failure(
        snapshot,
        project,
        queryIssue(
          'query.cursor.invalid',
          path,
          'The note cursor is invalid or expired.',
        ),
      );
    }
    const end = safeUtf8End(
      bytes,
      offset,
      Math.min(bytes.length, offset + limit),
    );
    const content = new TextDecoder().decode(bytes.slice(offset, end));
    const truncated = end < bytes.length;
    return {
      ok: true,
      ...envelope(snapshot),
      project_ref: entityRef(project),
      note: {
        path: note.path,
        fingerprint: note.fingerprint,
        heading: selected.heading,
        content,
        untrusted: true,
      },
      page: {
        limit,
        next_cursor: truncated ? `byte:${String(end)}` : null,
        truncated,
      },
    };
  }

  public async getRelatedWork(
    input: RelatedWorkInput,
  ): Promise<RelatedWorkResult | QueryFailure> {
    const snapshot = this.#getSnapshot();
    const project = getProject(snapshot, input.projectPath);
    if (project === null) return projectFailure(snapshot, input.projectPath);
    const page = parsePage(input.cursor, input.limit, snapshot, project);
    if (!page.ok) return page.failure;
    const items = snapshot
      .getRelatedToOrigin(normalizeVaultPath(input.notePath), input.heading)
      .filter((entity) => belongsToProject(entity, project.path))
      .map(entityRef);
    return successPage(snapshot, items, page, project);
  }

  public async getSequence(
    input: SequenceInput,
  ): Promise<SequenceResult | QueryFailure> {
    const snapshot = this.#getSnapshot();
    const project = getProject(snapshot, input.projectPath);
    if (project === null) return projectFailure(snapshot, input.projectPath);
    const page = parsePage(input.cursor, input.limit, snapshot, project);
    if (!page.ok) return page.failure;
    const tasks = snapshot
      .getTasksForProject(project.path)
      .filter(
        (task) =>
          input.includeTerminal === true || !isTerminalTaskStatus(task.status),
      );
    const ordered = dependencyOrder(snapshot, tasks).map((task) => ({
      ref: entityRef(task),
      title: task.title,
      status: task.status,
      ready: snapshot.getReadiness(task.path)?.ready === true,
      blocked_by: projectTaskRefs(
        snapshot,
        snapshot.getDependencies(task.path),
        project.path,
      ),
    }));
    return successPage(snapshot, ordered, page, project);
  }

  public async getDiagnostics(
    input: DiagnosticsInput,
  ): Promise<DiagnosticsResult | QueryFailure> {
    const snapshot = this.#getSnapshot();
    const project = getProject(snapshot, input.projectPath);
    if (project === null) return projectFailure(snapshot, input.projectPath);
    const page = parsePage(input.cursor, input.limit, snapshot, project);
    if (!page.ok) return page.failure;
    const allowed =
      input.severities === undefined ? null : new Set(input.severities);
    const items = projectDiagnostics(snapshot, project.path)
      .filter((issue) => allowed === null || allowed.has(issue.severity))
      .sort(
        (left, right) =>
          comparePath(left.path, right.path) ||
          left.code.localeCompare(right.code),
      );
    return successPage(snapshot, items, page, project);
  }

  public async getActionContext(
    input: TaskContextInput,
  ): Promise<ActionContextResult | QueryFailure> {
    const context = await this.getTaskContext(input);
    if (!context.ok) return context;
    const blocked = !context.task.ready;
    return {
      ok: true,
      schema_version: context.schema_version,
      index_revision: context.index_revision,
      index_freshness: context.index_freshness,
      project_ref: context.project_ref,
      entity: context.task,
      actions: [
        action(
          'add_to_board',
          context.task.status === 'backlog' && !blocked,
          blocked,
        ),
        action('start', context.task.status === 'todo' && !blocked, blocked),
        action(
          'complete',
          context.task.status !== 'done' && context.task.status !== 'cancelled',
          false,
        ),
      ],
    };
  }

  public async getCreationContext(
    input: CreationContextInput,
  ): Promise<CreationContextResult | QueryFailure> {
    const snapshot = this.#getSnapshot();
    const project = getProject(snapshot, input.projectPath);
    if (project === null) return projectFailure(snapshot, input.projectPath);
    const templates = this.#dependencies.taskTemplates;
    const variants =
      templates === undefined
        ? ['default']
        : await templates().listVariants('task');
    return {
      ok: true,
      ...envelope(snapshot),
      project_ref: entityRef(project),
      kind: 'task',
      default_variant: 'default',
      available_variants: variants,
      packaged_fallback: 'builtin:minimal',
      task_folder: `${directoryName(project.path)}/Tasks`.replace(/^\/+/u, ''),
    };
  }
}

function action(
  name: 'add_to_board' | 'start' | 'complete',
  enabled: boolean,
  blocked: boolean,
): ActionContextResult['actions'][number] {
  return enabled
    ? { name, enabled: true }
    : {
        name,
        enabled: false,
        reason_code: blocked ? 'task.blocked' : 'task.status_incompatible',
        reason: blocked
          ? 'The task has unfinished or invalid dependencies.'
          : 'The task is not in a status that supports this action.',
      };
}

function getProject(
  snapshot: IndexSnapshot,
  path: string,
): ProjectEntity | null {
  const entity = snapshot.getEntity(path);
  return entity?.kind === 'project' ? entity : null;
}

function projectEntities(
  snapshot: IndexSnapshot,
  projectPath: string,
): readonly EntityRecord[] {
  return snapshot
    .getEntities()
    .filter(
      (entity) =>
        entity.kind !== 'project' && belongsToProject(entity, projectPath),
    );
}

function belongsToProject(entity: EntityRecord, projectPath: string): boolean {
  if (entity.kind === 'project') return entity.path === projectPath;
  if (entity.kind === 'sprint') {
    return (
      entity.project?.resolvedPath === projectPath ||
      entity.projects.some((link) => link.resolvedPath === projectPath)
    );
  }
  return entity.project?.resolvedPath === projectPath;
}

function projectDiagnostics(
  snapshot: IndexSnapshot,
  projectPath: string,
): readonly Diagnostic[] {
  const paths = new Set([
    projectPath,
    ...projectEntities(snapshot, projectPath).map((entity) => entity.path),
  ]);
  return snapshot.diagnostics.filter(
    (issue) =>
      paths.has(issue.path) ||
      issue.relatedPaths?.some((path) => paths.has(path)) === true,
  );
}

function projectTask(
  snapshot: IndexSnapshot,
  projectPath: string,
  path: string,
): TaskEntity | null {
  const entity = snapshot.getEntity(path);
  return entity?.kind === 'task' && entity.project?.resolvedPath === projectPath
    ? entity
    : null;
}

function taskContext(
  snapshot: IndexSnapshot,
  task: TaskEntity,
  projectPath: string,
): TaskContextResult['task'] {
  const readiness = snapshot.getReadiness(task.path) ?? {
    ready: false,
    blockers: [],
  };
  return {
    ref: entityRef(task),
    title: task.title,
    status: task.status,
    ready: readiness.ready,
    blocked_by: projectTaskRefs(
      snapshot,
      readiness.blockers.flatMap((blocker) =>
        blocker.path === undefined ? [] : [blocker.path],
      ),
      projectPath,
    ),
    unlocks: projectTaskRefs(
      snapshot,
      snapshot.getDependents(task.path),
      projectPath,
    ),
  };
}

function dependencyOrder(
  snapshot: IndexSnapshot,
  tasks: readonly TaskEntity[],
): readonly TaskEntity[] {
  const byPath = new Map(tasks.map((task) => [task.path, task]));
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const ordered: TaskEntity[] = [];
  const visit = (task: TaskEntity): void => {
    if (visited.has(task.path)) return;
    if (visiting.has(task.path)) return;
    visiting.add(task.path);
    for (const dependency of [...snapshot.getDependencies(task.path)].sort(
      comparePath,
    )) {
      const candidate = byPath.get(dependency);
      if (candidate !== undefined) visit(candidate);
    }
    visiting.delete(task.path);
    visited.add(task.path);
    ordered.push(task);
  };
  for (const task of [...tasks].sort(compareReadyTask)) visit(task);
  return ordered;
}

function compareReadyTask(left: TaskEntity, right: TaskEntity): number {
  if (left.rank !== null || right.rank !== null) {
    if (left.rank === null) return 1;
    if (right.rank === null) return -1;
    if (left.rank !== right.rank) return left.rank - right.rank;
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

function entityStatus(entity: EntityRecord): string | null {
  return entity.kind === 'project' ? entity.status : entity.status;
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
    ...queryIssue(
      'query.project.not_found',
      normalizeVaultPath(projectPath),
      'The requested project is not indexed as a project note.',
    ),
    recovery: 'Select a valid project note and rebuild the index if needed.',
  });
}

function taskFailure(
  snapshot: IndexSnapshot,
  project: ProjectEntity,
  taskPath: string,
): QueryFailure {
  return failure(
    snapshot,
    project,
    queryIssue(
      'query.task.not_found',
      normalizeVaultPath(taskPath),
      'The requested task is not indexed in the selected project.',
    ),
  );
}

function queryIssue(code: string, path: string, message: string): Diagnostic {
  return { code, severity: 'error', path, message };
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
  const finite =
    requestedLimit === undefined || !Number.isFinite(requestedLimit)
      ? DEFAULT_LIMIT
      : Math.trunc(requestedLimit);
  const limit = Math.min(MAX_LIMIT, Math.max(1, finite));
  if (cursor === undefined) return { ok: true, offset: 0, limit };
  const match = /^offset:(\d+)$/u.exec(cursor);
  const offset = match === null ? Number.NaN : Number(match[1]);
  return Number.isSafeInteger(offset)
    ? { ok: true, offset, limit }
    : {
        ok: false,
        failure: failure(snapshot, project, {
          ...queryIssue(
            'query.cursor.invalid',
            project?.path ?? '',
            'The collection cursor is invalid or expired.',
          ),
          recovery: 'Restart the query without a cursor.',
        }),
      };
}

function successPage<T>(
  snapshot: IndexSnapshot,
  items: readonly T[],
  page: { readonly offset: number; readonly limit: number },
  project?: ProjectEntity,
): QueryEnvelope & {
  readonly ok: true;
  readonly project_ref: EntityRef;
  readonly items: readonly T[];
  readonly page: PageMetadata;
};
function successPage<T>(
  snapshot: IndexSnapshot,
  items: readonly T[],
  page: { readonly offset: number; readonly limit: number },
  project?: undefined,
): QueryEnvelope & {
  readonly ok: true;
  readonly items: readonly T[];
  readonly page: PageMetadata;
};
function successPage<T>(
  snapshot: IndexSnapshot,
  items: readonly T[],
  page: { readonly offset: number; readonly limit: number },
  project?: ProjectEntity,
): QueryEnvelope & {
  readonly ok: true;
  readonly project_ref?: EntityRef;
  readonly items: readonly T[];
  readonly page: PageMetadata;
} {
  const window = items.slice(page.offset, page.offset + page.limit);
  const next = page.offset + page.limit;
  return {
    ok: true,
    ...envelope(snapshot),
    ...(project === undefined ? {} : { project_ref: entityRef(project) }),
    items: window,
    page: {
      limit: page.limit,
      next_cursor: next < items.length ? `offset:${String(next)}` : null,
      truncated: next < items.length,
    },
  };
}

function normalizedSet(
  paths: readonly string[] | undefined,
): ReadonlySet<string> | null {
  return paths === undefined ? null : new Set(paths.map(normalizeVaultPath));
}

function normalizeRoots(
  roots: readonly string[] | undefined,
): readonly string[] {
  return roots === undefined
    ? []
    : [...new Set(roots.map(normalizeVaultPath))].sort(comparePath);
}

function canReadPath(
  snapshot: IndexSnapshot,
  projectPath: string,
  path: string,
  roots: readonly string[] | undefined,
): boolean {
  const entity = snapshot.getEntity(path);
  return (
    (entity !== undefined && belongsToProject(entity, projectPath)) ||
    normalizeRoots(roots).some((root) => isWithin(path, root))
  );
}

function isWithin(path: string, root: string): boolean {
  return path === root || path.startsWith(root + '/');
}

function fileTitle(path: string): string {
  return (path.split('/').at(-1) ?? path).replace(/\.md$/iu, '');
}

function snippet(content: string, index: number, length: number): string {
  const start = Math.max(0, index - 80);
  const end = Math.min(content.length, index + length + 120);
  return content.slice(start, end).replace(/\s+/gu, ' ').trim();
}

type SectionSelection =
  | {
      readonly ok: true;
      readonly content: string;
      readonly heading: string | null;
    }
  | { readonly ok: false; readonly issue: Diagnostic };

function selectSection(
  note: SourceNote,
  requested: string | undefined,
): SectionSelection {
  if (requested === undefined || requested.trim().length === 0) {
    return { ok: true, content: note.content, heading: null };
  }
  const wanted = requested.trim().toLocaleLowerCase();
  const lines = note.content.split(/(?<=\n)/u);
  const headings: Array<{
    readonly index: number;
    readonly level: number;
    readonly title: string;
  }> = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*(?:\r?\n)?$/u.exec(
      lines[index] ?? '',
    );
    if (match !== null)
      headings.push({
        index,
        level: match[1]?.length ?? 1,
        title: match[2]?.trim() ?? '',
      });
  }
  const matches = headings.filter(
    (heading) => heading.title.toLocaleLowerCase() === wanted,
  );
  if (matches.length !== 1) {
    return {
      ok: false,
      issue: queryIssue(
        matches.length === 0
          ? 'query.read.heading_not_found'
          : 'query.read.heading_ambiguous',
        note.path,
        matches.length === 0
          ? 'The requested heading was not found.'
          : 'The requested heading is not unique.',
      ),
    };
  }
  const found = matches[0] as (typeof matches)[number];
  const next = headings.find(
    (heading) => heading.index > found.index && heading.level <= found.level,
  );
  return {
    ok: true,
    content: lines.slice(found.index, next?.index ?? lines.length).join(''),
    heading: found.title,
  };
}

function parseByteCursor(cursor: string | undefined): number | null {
  if (cursor === undefined) return 0;
  const match = /^byte:(\d+)$/u.exec(cursor);
  if (match === null) return null;
  const value = Number(match[1]);
  return Number.isSafeInteger(value) ? value : null;
}

function boundedReadBytes(value: number | undefined): number {
  const finite =
    value === undefined || !Number.isFinite(value)
      ? DEFAULT_READ_BYTES
      : Math.trunc(value);
  return Math.min(MAX_READ_BYTES, Math.max(1, finite));
}

function safeUtf8End(
  bytes: Uint8Array,
  start: number,
  requestedEnd: number,
): number {
  let end = requestedEnd;
  while (end > start) {
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(bytes.slice(start, end));
      return end;
    } catch {
      end -= 1;
    }
  }
  return start;
}

function directoryName(path: string): string {
  const index = path.lastIndexOf('/');
  return index < 0 ? '' : path.slice(0, index);
}

function comparePath(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: 'accent' });
}
