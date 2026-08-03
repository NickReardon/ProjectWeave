import { normalizeVaultPath } from '../domain/markdown-parser';
import type {
  Diagnostic,
  EntityRecord,
  EntityType,
  IndexFreshness,
  TaskEntity,
  TaskReadiness,
} from '../domain/model';

export interface IndexSnapshotState {
  readonly revision: number;
  readonly freshness: IndexFreshness;
  readonly entities: ReadonlyMap<string, EntityRecord>;
  readonly diagnostics: readonly Diagnostic[];
  readonly readiness: ReadonlyMap<string, TaskReadiness>;
  readonly dependencies: ReadonlyMap<string, readonly string[]>;
  readonly dependents: ReadonlyMap<string, readonly string[]>;
  readonly tasksByProject: ReadonlyMap<string, readonly string[]>;
  readonly origins: ReadonlyMap<string, readonly string[]>;
}

export class IndexSnapshot {
  readonly revision: number;
  readonly freshness: IndexFreshness;
  readonly diagnostics: readonly Diagnostic[];
  readonly #entities: ReadonlyMap<string, EntityRecord>;
  readonly #readiness: ReadonlyMap<string, TaskReadiness>;
  readonly #dependencies: ReadonlyMap<string, readonly string[]>;
  readonly #dependents: ReadonlyMap<string, readonly string[]>;
  readonly #tasksByProject: ReadonlyMap<string, readonly string[]>;
  readonly #origins: ReadonlyMap<string, readonly string[]>;

  public constructor(state: IndexSnapshotState) {
    this.revision = state.revision;
    this.freshness = state.freshness;
    this.diagnostics = Object.freeze([...state.diagnostics]);
    this.#entities = state.entities;
    this.#readiness = state.readiness;
    this.#dependencies = state.dependencies;
    this.#dependents = state.dependents;
    this.#tasksByProject = state.tasksByProject;
    this.#origins = state.origins;
  }

  public static empty(freshness: IndexFreshness = 'rebuilding'): IndexSnapshot {
    return new IndexSnapshot({
      revision: 0,
      freshness,
      entities: new Map(),
      diagnostics: [],
      readiness: new Map(),
      dependencies: new Map(),
      dependents: new Map(),
      tasksByProject: new Map(),
      origins: new Map(),
    });
  }

  public withFreshness(freshness: IndexFreshness): IndexSnapshot {
    return new IndexSnapshot({
      revision: this.revision,
      freshness,
      entities: this.#entities,
      diagnostics: this.diagnostics,
      readiness: this.#readiness,
      dependencies: this.#dependencies,
      dependents: this.#dependents,
      tasksByProject: this.#tasksByProject,
      origins: this.#origins,
    });
  }

  public getEntity(path: string): EntityRecord | undefined {
    return this.#entities.get(normalizeVaultPath(path));
  }

  public getEntities(kind?: EntityType): readonly EntityRecord[] {
    const entities = [...this.#entities.values()];
    return entities
      .filter((entity) => kind === undefined || entity.kind === kind)
      .sort((left, right) => comparePath(left.path, right.path));
  }

  public getTasksForProject(projectPath: string): readonly TaskEntity[] {
    const paths =
      this.#tasksByProject.get(normalizeVaultPath(projectPath)) ?? [];
    return paths.flatMap((path) => {
      const entity = this.#entities.get(path);
      return entity?.kind === 'task' ? [entity] : [];
    });
  }

  public getReadiness(taskPath: string): TaskReadiness | undefined {
    return this.#readiness.get(normalizeVaultPath(taskPath));
  }

  public getDependencies(taskPath: string): readonly string[] {
    return this.#dependencies.get(normalizeVaultPath(taskPath)) ?? [];
  }

  public getDependents(taskPath: string): readonly string[] {
    return this.#dependents.get(normalizeVaultPath(taskPath)) ?? [];
  }

  public getRelatedToOrigin(
    notePath: string,
    heading?: string,
  ): readonly EntityRecord[] {
    const key = originKey(normalizeVaultPath(notePath), heading);
    return (this.#origins.get(key) ?? []).flatMap((path) => {
      const entity = this.#entities.get(path);
      return entity === undefined ? [] : [entity];
    });
  }
}

export function originKey(path: string, heading?: string): string {
  return heading === undefined || heading.length === 0
    ? path
    : `${path}#${heading}`;
}

function comparePath(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: 'accent' });
}
