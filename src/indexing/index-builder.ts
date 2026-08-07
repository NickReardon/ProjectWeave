import {
  normalizeVaultPath,
  parseMarkdownEntity,
} from '../domain/markdown-parser';
import { isTask, isTerminalTaskStatus } from '../domain/model';
import type {
  Blocker,
  Diagnostic,
  EntityRecord,
  SourceNote,
  TaskEntity,
  TaskReadiness,
  WikiLink,
} from '../domain/model';
import { PathLinkResolver } from '../ports/vault-reader';
import type { LinkResolution, LinkResolver } from '../ports/vault-reader';
import { IndexSnapshot, originKey } from './index-snapshot';

export interface IndexBuildOptions {
  readonly revision: number;
  readonly resolver?: LinkResolver;
  /**
   * Allowed task categories for this vault. Empty leaves `category`
   * unconstrained, which is the default and the whole behavior until someone
   * configures a vocabulary.
   */
  readonly taskCategories?: readonly string[];
}

/**
 * A task whose category is not in the configured vocabulary.
 *
 * Reported, never repaired: the value is what the note says, and an unexpected
 * one usually means a typo or a list that needs another entry. An empty
 * vocabulary reports nothing at all.
 */
function categoryDiagnostic(
  entity: EntityRecord,
  allowed: ReadonlySet<string>,
  configured: readonly string[],
): Diagnostic | null {
  if (allowed.size === 0 || !isTask(entity) || entity.category === null) {
    return null;
  }
  if (allowed.has(entity.category.trim().toLowerCase())) {
    return null;
  }
  return {
    path: entity.path,
    code: 'task.category.invalid',
    severity: 'error',
    message:
      '`' + entity.category + "` is not one of this vault's task categories.",
    field: 'category',
    recovery: 'Use one of: ' + configured.join(', ') + '.',
  };
}

export class IndexBuilder {
  public build(
    sourceNotes: readonly SourceNote[],
    options: IndexBuildOptions,
  ): IndexSnapshot {
    const sources = [...sourceNotes]
      .map((source) => ({ ...source, path: normalizeVaultPath(source.path) }))
      .sort((left, right) => comparePath(left.path, right.path));
    const resolver =
      options.resolver ??
      new PathLinkResolver(sources.map((source) => source.path));
    const diagnosticsByPath = new Map<string, Diagnostic[]>();
    const globalDiagnostics: Diagnostic[] = [];
    const parsedEntities = new Map<string, EntityRecord>();

    // Configured rather than domain-fixed, so it is applied here where the
    // configuration reaches, not in the parser, which knows nothing of
    // settings.
    const allowedCategories = new Set(
      (options.taskCategories ?? []).map((category) =>
        category.trim().toLowerCase(),
      ),
    );

    for (const source of sources) {
      const parsed = parseMarkdownEntity(source);
      if (parsed.entity === null) {
        globalDiagnostics.push(...parsed.diagnostics);
        continue;
      }
      const categoryIssue = categoryDiagnostic(
        parsed.entity,
        allowedCategories,
        options.taskCategories ?? [],
      );
      parsedEntities.set(parsed.entity.path, parsed.entity);
      // `diagnosticsByPath` is the only carrier: every later validator appends
      // to it, and the final entity records take their diagnostics from it
      // wholesale. An entity's own `diagnostics` field never survives that.
      diagnosticsByPath.set(parsed.entity.path, [
        ...parsed.diagnostics,
        ...(categoryIssue === null ? [] : [categoryIssue]),
      ]);
    }

    const resolvedEntities = new Map<string, EntityRecord>();
    for (const entity of parsedEntities.values()) {
      const entityDiagnostics = diagnosticsByPath.get(entity.path) ?? [];
      resolvedEntities.set(
        entity.path,
        resolveEntity(entity, resolver, entityDiagnostics),
      );
    }

    validateRelations(resolvedEntities, diagnosticsByPath);
    const cyclePaths = validateDependencyCycles(
      resolvedEntities,
      diagnosticsByPath,
    );
    validateDuplicateRanks(resolvedEntities, diagnosticsByPath);

    const entities = new Map<string, EntityRecord>();
    for (const entity of resolvedEntities.values()) {
      entities.set(entity.path, {
        ...entity,
        diagnostics: Object.freeze([
          ...(diagnosticsByPath.get(entity.path) ?? []),
        ]),
      });
    }

    const dependencies = new Map<string, readonly string[]>();
    const dependents = new Map<string, readonly string[]>();
    const readiness = new Map<string, TaskReadiness>();
    const tasksByProject = new Map<string, readonly string[]>();
    const origins = new Map<string, readonly string[]>();

    for (const entity of entities.values()) {
      if (entity.kind !== 'task') {
        addOrigin(origins, entity);
        continue;
      }

      const dependencyPaths = entity.dependsOn.flatMap((relation) =>
        relation.resolvedPath === undefined ? [] : [relation.resolvedPath],
      );
      dependencies.set(entity.path, uniqueSorted(dependencyPaths));
      for (const dependencyPath of dependencyPaths) {
        appendMapValue(dependents, dependencyPath, entity.path);
      }

      const projectPath = entity.project?.resolvedPath;
      if (projectPath !== undefined) {
        appendMapValue(tasksByProject, projectPath, entity.path);
      }

      readiness.set(entity.path, deriveReadiness(entity, entities, cyclePaths));
      addOrigin(origins, entity);
    }

    const allDiagnostics = [
      ...globalDiagnostics,
      ...[...entities.values()].flatMap((entity) => entity.diagnostics),
    ].sort(compareDiagnostic);

    return new IndexSnapshot({
      revision: options.revision,
      freshness: 'current',
      entities,
      diagnostics: allDiagnostics,
      readiness,
      dependencies: sortMapValues(dependencies),
      dependents: sortMapValues(dependents),
      tasksByProject: sortMapValues(tasksByProject),
      origins: sortMapValues(origins),
    });
  }
}

function resolveEntity(
  entity: EntityRecord,
  resolver: LinkResolver,
  diagnostics: Diagnostic[],
): EntityRecord {
  switch (entity.kind) {
    case 'project':
      return entity;
    case 'epic':
      return {
        ...entity,
        project: resolveOptionalLink(
          entity.project,
          entity.path,
          'project',
          'epic.project',
          resolver,
          diagnostics,
        ),
        origin: resolveOptionalLink(
          entity.origin,
          entity.path,
          'origin',
          'origin',
          resolver,
          diagnostics,
          'warning',
        ),
      };
    case 'task':
      return {
        ...entity,
        project: resolveOptionalLink(
          entity.project,
          entity.path,
          'project',
          'task.project',
          resolver,
          diagnostics,
        ),
        epic: resolveOptionalLink(
          entity.epic,
          entity.path,
          'epic',
          'task.epic',
          resolver,
          diagnostics,
        ),
        milestone: resolveOptionalLink(
          entity.milestone,
          entity.path,
          'milestone',
          'task.milestone',
          resolver,
          diagnostics,
        ),
        planningPeriod: resolveOptionalLink(
          entity.planningPeriod,
          entity.path,
          'sprint',
          'task.sprint',
          resolver,
          diagnostics,
        ),
        dependsOn: entity.dependsOn.map((link) =>
          resolveLink(
            link,
            entity.path,
            'depends_on',
            'dependency',
            resolver,
            diagnostics,
          ),
        ),
        origin: resolveOptionalLink(
          entity.origin,
          entity.path,
          'origin',
          'origin',
          resolver,
          diagnostics,
          'warning',
        ),
      };
    case 'milestone':
      return {
        ...entity,
        project: resolveOptionalLink(
          entity.project,
          entity.path,
          'project',
          'milestone.project',
          resolver,
          diagnostics,
        ),
        origin: resolveOptionalLink(
          entity.origin,
          entity.path,
          'origin',
          'origin',
          resolver,
          diagnostics,
          'warning',
        ),
      };
    case 'sprint':
      return {
        ...entity,
        project: resolveOptionalLink(
          entity.project,
          entity.path,
          'project',
          'sprint.project',
          resolver,
          diagnostics,
        ),
        projects: entity.projects.map((link) =>
          resolveLink(
            link,
            entity.path,
            'projects',
            'sprint.projects',
            resolver,
            diagnostics,
          ),
        ),
      };
  }
}

function resolveOptionalLink(
  link: WikiLink | null,
  sourcePath: string,
  field: string,
  codePrefix: string,
  resolver: LinkResolver,
  diagnostics: Diagnostic[],
  severity: Diagnostic['severity'] = 'error',
): WikiLink | null {
  return link === null
    ? null
    : resolveLink(
        link,
        sourcePath,
        field,
        codePrefix,
        resolver,
        diagnostics,
        severity,
      );
}

function resolveLink(
  link: WikiLink,
  sourcePath: string,
  field: string,
  codePrefix: string,
  resolver: LinkResolver,
  diagnostics: Diagnostic[],
  severity: Diagnostic['severity'] = 'error',
): WikiLink {
  const resolution = resolver.resolve(link.linkpath, sourcePath);
  switch (resolution.kind) {
    case 'resolved':
      return { ...link, resolvedPath: normalizeVaultPath(resolution.path) };
    case 'ambiguous':
      diagnostics.push(
        relationDiagnostic(
          sourcePath,
          `${codePrefix}.ambiguous`,
          severity,
          field,
          `Link ${link.raw} is ambiguous.`,
          resolution,
        ),
      );
      return link;
    case 'unresolved':
      diagnostics.push({
        code: `${codePrefix}.unresolved`,
        severity,
        path: sourcePath,
        field,
        message: `Link ${link.raw} could not be resolved.`,
        recovery:
          'Correct the link target or create the intended note explicitly.',
      });
      return link;
  }
}

function validateRelations(
  entities: ReadonlyMap<string, EntityRecord>,
  diagnosticsByPath: Map<string, Diagnostic[]>,
): void {
  for (const entity of entities.values()) {
    const diagnostics = diagnosticsByPath.get(entity.path) ?? [];
    if (entity.kind !== 'project') {
      validateTargetKind(
        entity,
        entity.project,
        'project',
        'project',
        entities,
        diagnostics,
      );
    }

    if (entity.kind === 'task') {
      validateTargetKind(
        entity,
        entity.epic,
        'epic',
        'epic',
        entities,
        diagnostics,
      );
      validateTargetKind(
        entity,
        entity.milestone,
        'milestone',
        'milestone',
        entities,
        diagnostics,
      );
      validateTargetKind(
        entity,
        entity.planningPeriod,
        'sprint',
        'sprint',
        entities,
        diagnostics,
      );
      validateTaskRelations(entity, entities, diagnostics);
    }

    if (entity.kind === 'sprint' && entity.scope === 'portfolio') {
      for (const project of entity.projects) {
        validateTargetKind(
          entity,
          project,
          'project',
          'projects',
          entities,
          diagnostics,
        );
      }
    }
  }
}

function validateTargetKind(
  source: EntityRecord,
  relation: WikiLink | null,
  expectedKind: EntityRecord['kind'],
  field: string,
  entities: ReadonlyMap<string, EntityRecord>,
  diagnostics: Diagnostic[],
): void {
  if (relation?.resolvedPath === undefined) {
    return;
  }
  const target = entities.get(relation.resolvedPath);
  if (target?.kind === expectedKind) {
    if (
      source.kind === 'task' &&
      field !== 'project' &&
      projectPath(source) !== projectPath(target)
    ) {
      diagnostics.push({
        code: `task.${field}.project_mismatch`,
        severity: 'error',
        path: source.path,
        field,
        message: `${target.title} does not belong to the task's project.`,
        relatedPaths: [target.path],
      });
    }
    return;
  }

  diagnostics.push({
    code: `${source.kind}.${field}.target_type`,
    severity: 'error',
    path: source.path,
    field,
    message: `Field \`${field}\` must resolve to a ${expectedKind} note.`,
    relatedPaths: [relation.resolvedPath],
  });
}

function validateTaskRelations(
  task: TaskEntity,
  entities: ReadonlyMap<string, EntityRecord>,
  diagnostics: Diagnostic[],
): void {
  const seen = new Set<string>();
  for (const dependency of task.dependsOn) {
    const targetPath = dependency.resolvedPath;
    if (targetPath === undefined) {
      continue;
    }
    if (seen.has(targetPath)) {
      diagnostics.push({
        code: 'dependency.duplicate',
        severity: 'warning',
        path: task.path,
        field: 'depends_on',
        message: `Dependency ${dependency.raw} is listed more than once.`,
        relatedPaths: [targetPath],
      });
      continue;
    }
    seen.add(targetPath);

    if (targetPath === task.path) {
      diagnostics.push({
        code: 'dependency.self',
        severity: 'error',
        path: task.path,
        field: 'depends_on',
        message: 'A task cannot depend on itself.',
        relatedPaths: [targetPath],
      });
      continue;
    }

    const target = entities.get(targetPath);
    if (target?.kind !== 'task') {
      diagnostics.push({
        code: 'dependency.target_type',
        severity: 'error',
        path: task.path,
        field: 'depends_on',
        message: `Dependency ${dependency.raw} must resolve to a task note.`,
        relatedPaths: [targetPath],
      });
      continue;
    }

    if (projectPath(task) !== projectPath(target)) {
      diagnostics.push({
        code: 'dependency.cross_project',
        severity: 'warning',
        path: task.path,
        field: 'depends_on',
        message: `Cross-project dependency on ${target.title} is advisory in v1.`,
        relatedPaths: [target.path],
      });
    }
  }
}

function validateDependencyCycles(
  entities: ReadonlyMap<string, EntityRecord>,
  diagnosticsByPath: Map<string, Diagnostic[]>,
): ReadonlySet<string> {
  const tasks = [...entities.values()].filter(isTask);
  const adjacency = new Map<string, readonly string[]>();
  for (const task of tasks) {
    adjacency.set(
      task.path,
      uniqueSorted(
        task.dependsOn.flatMap((dependency) => {
          const target =
            dependency.resolvedPath === undefined
              ? undefined
              : entities.get(dependency.resolvedPath);
          return target?.kind === 'task' &&
            projectPath(task) === projectPath(target)
            ? [target.path]
            : [];
        }),
      ),
    );
  }

  const cyclePaths = stronglyConnectedCycles(adjacency);
  for (const path of cyclePaths) {
    const diagnostics = diagnosticsByPath.get(path) ?? [];
    diagnostics.push({
      code: 'dependency.cycle',
      severity: 'error',
      path,
      field: 'depends_on',
      message: 'This task participates in a same-project dependency cycle.',
      relatedPaths: [...cyclePaths]
        .filter((candidate) => candidate !== path)
        .sort(comparePath),
      recovery:
        'Remove or redirect at least one dependency edge through an explicit edit.',
    });
    diagnosticsByPath.set(path, diagnostics);
  }
  return cyclePaths;
}

function stronglyConnectedCycles(
  adjacency: ReadonlyMap<string, readonly string[]>,
): ReadonlySet<string> {
  let nextIndex = 0;
  const indices = new Map<string, number>();
  const lowLinks = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const cyclePaths = new Set<string>();

  const visit = (path: string): void => {
    indices.set(path, nextIndex);
    lowLinks.set(path, nextIndex);
    nextIndex += 1;
    stack.push(path);
    onStack.add(path);

    for (const target of adjacency.get(path) ?? []) {
      if (!indices.has(target)) {
        visit(target);
        lowLinks.set(
          path,
          Math.min(lowLinks.get(path) ?? 0, lowLinks.get(target) ?? 0),
        );
      } else if (onStack.has(target)) {
        lowLinks.set(
          path,
          Math.min(lowLinks.get(path) ?? 0, indices.get(target) ?? 0),
        );
      }
    }

    if (lowLinks.get(path) !== indices.get(path)) {
      return;
    }

    const component: string[] = [];
    let member: string | undefined;
    do {
      member = stack.pop();
      if (member !== undefined) {
        onStack.delete(member);
        component.push(member);
      }
    } while (member !== path && member !== undefined);

    const selfCycle =
      component.length === 1 &&
      (adjacency.get(component[0] as string) ?? []).includes(
        component[0] as string,
      );
    if (component.length > 1 || selfCycle) {
      for (const componentPath of component) {
        cyclePaths.add(componentPath);
      }
    }
  };

  for (const path of [...adjacency.keys()].sort(comparePath)) {
    if (!indices.has(path)) {
      visit(path);
    }
  }
  return cyclePaths;
}

function validateDuplicateRanks(
  entities: ReadonlyMap<string, EntityRecord>,
  diagnosticsByPath: Map<string, Diagnostic[]>,
): void {
  const groups = new Map<string, string[]>();
  for (const entity of entities.values()) {
    if (entity.kind !== 'task' || entity.rank === null) {
      continue;
    }
    const project = projectPath(entity);
    if (project === undefined) {
      continue;
    }
    const key = `${project}\u0000${String(entity.rank)}`;
    const paths = groups.get(key) ?? [];
    paths.push(entity.path);
    groups.set(key, paths);
  }

  for (const paths of groups.values()) {
    if (paths.length < 2) {
      continue;
    }
    for (const path of paths) {
      const diagnostics = diagnosticsByPath.get(path) ?? [];
      diagnostics.push({
        code: 'task.rank.duplicate',
        severity: 'warning',
        path,
        field: 'rank',
        message:
          'Another task in this project has the same rank; path order is used as a tie-breaker.',
        relatedPaths: paths
          .filter((candidate) => candidate !== path)
          .sort(comparePath),
      });
      diagnosticsByPath.set(path, diagnostics);
    }
  }
}

function deriveReadiness(
  task: TaskEntity,
  entities: ReadonlyMap<string, EntityRecord>,
  cyclePaths: ReadonlySet<string>,
): TaskReadiness {
  if (task.status === null || isTerminalTaskStatus(task.status)) {
    return { ready: false, blockers: [] };
  }

  const blockers: Blocker[] = [];
  for (const dependency of task.dependsOn) {
    const targetPath = dependency.resolvedPath;
    if (targetPath === undefined) {
      blockers.push({ kind: 'unresolved_dependency', relation: dependency });
      continue;
    }

    const target = entities.get(targetPath);
    if (target?.kind !== 'task' || targetPath === task.path) {
      blockers.push({
        kind: 'invalid_dependency',
        relation: dependency,
        path: targetPath,
      });
      continue;
    }

    if (projectPath(task) !== projectPath(target)) {
      continue;
    }

    if (cyclePaths.has(task.path) && cyclePaths.has(target.path)) {
      blockers.push({
        kind: 'dependency_cycle',
        relation: dependency,
        path: target.path,
        title: target.title,
        status: target.status,
      });
      continue;
    }

    if (target.status !== 'done') {
      blockers.push({
        kind: 'unfinished_dependency',
        relation: dependency,
        path: target.path,
        title: target.title,
        status: target.status,
      });
    }
  }

  return { ready: blockers.length === 0, blockers };
}

function projectPath(entity: EntityRecord): string | undefined {
  return entity.kind === 'project' ? entity.path : entity.project?.resolvedPath;
}

function addOrigin(
  origins: Map<string, readonly string[]>,
  entity: EntityRecord,
): void {
  if (
    (entity.kind !== 'task' &&
      entity.kind !== 'epic' &&
      entity.kind !== 'milestone') ||
    entity.origin?.resolvedPath === undefined
  ) {
    return;
  }
  appendMapValue(
    origins,
    originKey(entity.origin.resolvedPath, entity.origin.heading),
    entity.path,
  );
}

function appendMapValue(
  map: Map<string, readonly string[]>,
  key: string,
  value: string,
): void {
  map.set(key, [...(map.get(key) ?? []), value]);
}

function sortMapValues(
  map: ReadonlyMap<string, readonly string[]>,
): ReadonlyMap<string, readonly string[]> {
  return new Map(
    [...map.entries()]
      .sort(([left], [right]) => comparePath(left, right))
      .map(([key, values]) => [key, uniqueSorted(values)] as const),
  );
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort(comparePath);
}

function relationDiagnostic(
  sourcePath: string,
  code: string,
  severity: Diagnostic['severity'],
  field: string,
  message: string,
  resolution: Extract<LinkResolution, { kind: 'ambiguous' }>,
): Diagnostic {
  return {
    code,
    severity,
    path: sourcePath,
    field,
    message,
    relatedPaths: [...resolution.candidates],
    recovery: 'Use a path-qualified wiki link to select one note.',
  };
}

function compareDiagnostic(left: Diagnostic, right: Diagnostic): number {
  return (
    comparePath(left.path, right.path) ||
    left.code.localeCompare(right.code) ||
    (left.field ?? '').localeCompare(right.field ?? '')
  );
}

function comparePath(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: 'accent' });
}
