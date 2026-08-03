export const ENTITY_TYPES = [
  'project',
  'epic',
  'task',
  'milestone',
  'sprint',
] as const;

export const PROJECT_STATUSES = [
  'planned',
  'active',
  'paused',
  'completed',
  'cancelled',
  'archived',
] as const;

export const EPIC_STATUSES = [
  'planned',
  'active',
  'completed',
  'cancelled',
] as const;

export const TASK_STATUSES = [
  'backlog',
  'todo',
  'in-progress',
  'waiting',
  'review',
  'done',
  'cancelled',
] as const;

export const MILESTONE_STATUSES = ['planned', 'achieved', 'cancelled'] as const;

export const SPRINT_STATUSES = [
  'planned',
  'active',
  'completed',
  'cancelled',
] as const;

export const TASK_PRIORITIES = ['critical', 'high', 'normal', 'low'] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type EpicStatus = (typeof EPIC_STATUSES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];
export type SprintStatus = (typeof SPRINT_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export type DiagnosticSeverity = 'error' | 'warning' | 'info';
export type DependencyMode = 'enforced' | 'advisory';
export type PlanningPeriodLabel = 'sprint' | 'cycle' | 'period';
export type IndexFreshness = 'current' | 'rebuilding' | 'stale_last_good';

export interface Diagnostic {
  readonly code: string;
  readonly severity: DiagnosticSeverity;
  readonly path: string;
  readonly field?: string;
  readonly message: string;
  readonly recovery?: string;
  readonly relatedPaths?: readonly string[];
}

export interface SourceNote {
  readonly path: string;
  readonly content: string;
  readonly fingerprint: string;
}

export interface WikiLink {
  readonly raw: string;
  readonly linkpath: string;
  readonly heading?: string;
  readonly alias?: string;
  readonly resolvedPath?: string;
}

export interface ProjectWorkflow {
  readonly dependencyMode: DependencyMode;
  readonly planningPeriodLabel: PlanningPeriodLabel;
  readonly estimation: 'points' | null;
  readonly ownerRequiredOnBoard: boolean;
  readonly estimateRequiredInPeriod: boolean;
}

export interface BaseEntity {
  readonly kind: EntityType;
  readonly path: string;
  readonly title: string;
  readonly fingerprint: string;
  readonly frontmatter: Readonly<Record<string, unknown>>;
  readonly diagnostics: readonly Diagnostic[];
}

export interface ProjectEntity extends BaseEntity {
  readonly kind: 'project';
  readonly status: ProjectStatus;
  readonly statusExplicit: boolean;
  readonly workflow: ProjectWorkflow;
}

export interface EpicEntity extends BaseEntity {
  readonly kind: 'epic';
  readonly project: WikiLink | null;
  readonly status: EpicStatus | null;
  readonly owner: string | null;
  readonly origin: WikiLink | null;
}

export interface TaskEntity extends BaseEntity {
  readonly kind: 'task';
  readonly project: WikiLink | null;
  readonly status: TaskStatus | null;
  readonly epic: WikiLink | null;
  readonly milestone: WikiLink | null;
  readonly planningPeriod: WikiLink | null;
  readonly owner: string | null;
  readonly points: number | null;
  readonly rank: number | null;
  readonly priority: TaskPriority | null;
  readonly dueDate: string | null;
  readonly completedAt: string | null;
  readonly dependsOn: readonly WikiLink[];
  readonly origin: WikiLink | null;
}

export interface MilestoneEntity extends BaseEntity {
  readonly kind: 'milestone';
  readonly project: WikiLink | null;
  readonly status: MilestoneStatus | null;
  readonly dueDate: string | null;
  readonly achievedAt: string | null;
  readonly owner: string | null;
  readonly origin: WikiLink | null;
}

export interface SprintEntity extends BaseEntity {
  readonly kind: 'sprint';
  readonly scope: 'project' | 'portfolio' | null;
  readonly project: WikiLink | null;
  readonly projects: readonly WikiLink[];
  readonly status: SprintStatus | null;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly goal: string | null;
}

export type EntityRecord =
  ProjectEntity | EpicEntity | TaskEntity | MilestoneEntity | SprintEntity;

export interface ParsedMarkdownNote {
  readonly entity: EntityRecord | null;
  readonly diagnostics: readonly Diagnostic[];
  readonly ignoredReason?:
    'ordinary_markdown' | 'template' | 'unsupported_type';
}

export interface Blocker {
  readonly kind:
    | 'unfinished_dependency'
    | 'unresolved_dependency'
    | 'invalid_dependency'
    | 'dependency_cycle';
  readonly relation: WikiLink;
  readonly path?: string;
  readonly title?: string;
  readonly status?: TaskStatus | null;
}

export interface TaskReadiness {
  readonly ready: boolean;
  readonly blockers: readonly Blocker[];
}

export function isProject(entity: EntityRecord): entity is ProjectEntity {
  return entity.kind === 'project';
}

export function isTask(entity: EntityRecord): entity is TaskEntity {
  return entity.kind === 'task';
}

export function isTerminalTaskStatus(status: TaskStatus | null): boolean {
  return status === 'done' || status === 'cancelled';
}
