import { ItemView, Notice } from 'obsidian';
import type { ViewStateResult, WorkspaceLeaf } from 'obsidian';

import {
  buildProjectWorkbenchModel,
  DEFAULT_PROJECT_WORKBENCH_TASK_STATUSES,
  PROJECT_WORKBENCH_DUE_STATES,
  type ProjectWorkbenchDiagnosticItem,
  type ProjectWorkbenchDiagnosticsModel,
  type ProjectWorkbenchDueState,
  type ProjectWorkbenchModel,
  type ProjectWorkbenchProjectOption,
  type ProjectWorkbenchTaskFilterOption,
} from '../application/project-workbench-model';
import type {
  ProjectWeaveReadPublication,
  ProjectWeaveReadSource,
} from '../application/project-weave-read-source';
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskPriority,
  type TaskStatus,
} from '../domain/model';
import {
  applyTextSelection,
  asSelectableField,
  captureTextSelection,
  type TextSelection,
} from './text-selection';

export const PROJECT_WORKBENCH_VIEW_TYPE = 'project-weave-workbench';

const INITIAL_READY_DISPLAY_LIMIT = 10;
const READY_DISPLAY_INCREMENT = 25;
const MAX_READY_DISPLAY_LIMIT = 200;
const INITIAL_TASK_DISPLAY_LIMIT = 25;
const TASK_DISPLAY_INCREMENT = 25;
const MAX_TASK_DISPLAY_LIMIT = 200;
const INITIAL_DIAGNOSTIC_DISPLAY_LIMIT = 10;
const DIAGNOSTIC_DISPLAY_INCREMENT = 25;
const MAX_DIAGNOSTIC_DISPLAY_LIMIT = 200;
const WORKBENCH_STATE_VERSION = 1;

export interface ProjectWorkbenchActions {
  rebuildIndex(): Promise<void>;
}

/** What must survive a full re-render so typing is not disrupted. */
interface WorkbenchFocusState {
  readonly key: string;
  readonly selection: TextSelection | null;
}

interface DiagnosticSectionOptions {
  readonly title: string;
  readonly ariaLabel: string;
  readonly intro: string;
  readonly emptyMessage?: string;
  readonly focusPrefix: 'project-diagnostics' | 'unassigned-diagnostics';
  readonly limitLabel: string;
  readonly currentDisplayLimit: number;
  readonly increaseDisplayLimit: () => void;
  readonly emphasized?: boolean;
}

export class ProjectWorkbenchView extends ItemView {
  readonly #readSource: ProjectWeaveReadSource;
  readonly #actions: ProjectWorkbenchActions;
  #publication: ProjectWeaveReadPublication;
  #selectedProjectPath: string | null = null;
  #activePathHint: string | null = null;
  #readyDisplayLimit = INITIAL_READY_DISPLAY_LIMIT;
  #taskDisplayLimit = INITIAL_TASK_DISPLAY_LIMIT;
  #taskStatuses = new Set<TaskStatus>(DEFAULT_PROJECT_WORKBENCH_TASK_STATUSES);
  #taskSearch = '';
  #taskPriority: TaskPriority | null = null;
  #taskEpicPath: string | null = null;
  #taskMilestonePath: string | null = null;
  #taskOwner: string | null = null;
  #taskDueState: ProjectWorkbenchDueState | null = null;
  #diagnosticDisplayLimit = INITIAL_DIAGNOSTIC_DISPLAY_LIMIT;
  #unassignedDiagnosticDisplayLimit = INITIAL_DIAGNOSTIC_DISPLAY_LIMIT;
  #unsubscribe: (() => void) | null = null;
  #opened = false;

  public constructor(
    leaf: WorkspaceLeaf,
    readSource: ProjectWeaveReadSource,
    actions: ProjectWorkbenchActions,
  ) {
    super(leaf);
    this.#readSource = readSource;
    this.#actions = actions;
    this.#publication = readSource.current;
    this.navigation = false;

    this.addAction('refresh-cw', 'Rebuild Project Weave index', () => {
      void this.#rebuildIndex();
    });
  }

  public override getViewType(): string {
    return PROJECT_WORKBENCH_VIEW_TYPE;
  }

  public override getDisplayText(): string {
    return 'Project Weave';
  }

  public override getIcon(): string {
    return 'layout-dashboard';
  }

  public override getState(): Record<string, unknown> {
    return {
      stateVersion: WORKBENCH_STATE_VERSION,
      selectedProjectPath: this.#selectedProjectPath,
    };
  }

  public selectProject(projectPath: string): void {
    if (this.#selectedProjectPath === projectPath) {
      return;
    }
    this.#selectedProjectPath = projectPath;
    this.#activePathHint = null;
    this.#readyDisplayLimit = INITIAL_READY_DISPLAY_LIMIT;
    this.#taskDisplayLimit = INITIAL_TASK_DISPLAY_LIMIT;
    this.#taskStatuses = new Set<TaskStatus>(
      DEFAULT_PROJECT_WORKBENCH_TASK_STATUSES,
    );
    this.#taskSearch = '';
    this.#taskPriority = null;
    this.#taskEpicPath = null;
    this.#taskMilestonePath = null;
    this.#taskOwner = null;
    this.#taskDueState = null;
    this.#diagnosticDisplayLimit = INITIAL_DIAGNOSTIC_DISPLAY_LIMIT;
    this.#unassignedDiagnosticDisplayLimit = INITIAL_DIAGNOSTIC_DISPLAY_LIMIT;
    if (this.#opened) {
      this.#render();
    }
    void this.app.workspace.requestSaveLayout();
  }

  public override async setState(
    state: unknown,
    result: ViewStateResult,
  ): Promise<void> {
    this.#selectedProjectPath = selectedProjectPathFromState(state);
    this.#activePathHint = null;
    this.#readyDisplayLimit = INITIAL_READY_DISPLAY_LIMIT;
    this.#taskDisplayLimit = INITIAL_TASK_DISPLAY_LIMIT;
    this.#taskStatuses = new Set<TaskStatus>(
      DEFAULT_PROJECT_WORKBENCH_TASK_STATUSES,
    );
    this.#taskSearch = '';
    this.#taskPriority = null;
    this.#taskEpicPath = null;
    this.#taskMilestonePath = null;
    this.#taskOwner = null;
    this.#taskDueState = null;
    this.#diagnosticDisplayLimit = INITIAL_DIAGNOSTIC_DISPLAY_LIMIT;
    this.#unassignedDiagnosticDisplayLimit = INITIAL_DIAGNOSTIC_DISPLAY_LIMIT;
    await super.setState(state, result);
    if (this.#opened) {
      this.#render();
    }
  }

  protected override async onOpen(): Promise<void> {
    this.#opened = true;
    this.contentEl.addClass('project-weave-workbench');
    if (this.#selectedProjectPath === null) {
      this.#activePathHint = this.app.workspace.getActiveFile()?.path ?? null;
    }
    this.#unsubscribe?.();
    this.#unsubscribe = this.#readSource.subscribe((publication) => {
      const isNewPublication =
        publication.publicationId !== this.#publication.publicationId;
      this.#publication = publication;
      if (isNewPublication) {
        this.#readyDisplayLimit = INITIAL_READY_DISPLAY_LIMIT;
        this.#taskDisplayLimit = INITIAL_TASK_DISPLAY_LIMIT;
        this.#diagnosticDisplayLimit = INITIAL_DIAGNOSTIC_DISPLAY_LIMIT;
        this.#unassignedDiagnosticDisplayLimit =
          INITIAL_DIAGNOSTIC_DISPLAY_LIMIT;
      }
      this.#render();
    });
  }

  protected override async onClose(): Promise<void> {
    this.#opened = false;
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    this.contentEl.empty();
  }

  #render(): void {
    if (!this.#opened) {
      return;
    }

    const focusState = this.#captureFocusState();
    const model = buildProjectWorkbenchModel({
      publication: this.#publication,
      selectedProjectPath: this.#selectedProjectPath,
      activePath: this.#activePathHint,
      readyDisplayLimit: this.#readyDisplayLimit,
      taskDisplayLimit: this.#taskDisplayLimit,
      taskStatuses: [...this.#taskStatuses],
      taskSearch: this.#taskSearch,
      taskPriority: this.#taskPriority,
      taskEpicPath: this.#taskEpicPath,
      taskMilestonePath: this.#taskMilestonePath,
      taskOwner: this.#taskOwner,
      taskDueState: this.#taskDueState,
      taskToday: localDateKey(new Date()),
      diagnosticDisplayLimit: this.#diagnosticDisplayLimit,
      unassignedDiagnosticDisplayLimit: this.#unassignedDiagnosticDisplayLimit,
    });

    if (model.state === 'project' && this.#selectedProjectPath === null) {
      this.#selectedProjectPath = model.project.path;
      this.#activePathHint = null;
      void this.app.workspace.requestSaveLayout();
    }

    this.contentEl.empty();
    const root = this.contentEl.createDiv({
      cls: 'project-weave-workbench__content',
    });
    this.#renderHeader(root, model);
    this.#renderBanner(root, model);
    this.#renderUnassignedDiagnostics(root, model);

    switch (model.state) {
      case 'loading':
        this.#renderMessage(
          root,
          'Indexing project notes…',
          'The dashboard will update automatically.',
        );
        break;
      case 'no_projects':
        this.#renderMessage(
          root,
          'No projects are indexed',
          'No valid non-archived project notes were found. Check project frontmatter and indexed folders in Settings → Community plugins → Project Weave.',
        );
        break;
      case 'choose_project':
        this.#renderMessage(
          root,
          'Choose a project',
          'More than one project is available. Your selection stays with this dashboard tab.',
        );
        break;
      case 'project_unavailable':
        this.#renderMessage(
          root,
          'Selected project is unavailable',
          'The path ' +
            model.requestedProjectPath +
            ' is no longer indexed as an available project note. It may be archived, malformed, or outside the folder scope.',
        );
        break;
      case 'project':
        this.#renderProject(root, model);
        break;
    }
    this.#restoreFocus(focusState);
  }

  #renderHeader(root: HTMLElement, model: ProjectWorkbenchModel): void {
    const header = root.createEl('header', {
      cls: 'project-weave-workbench__header',
    });
    const heading = header.createDiv({
      cls: 'project-weave-workbench__heading',
    });
    heading.createDiv({
      cls: 'project-weave-workbench__eyebrow',
      text: 'Project Weave',
    });
    heading.createEl('h1', {
      text:
        model.state === 'project' ? model.project.title : 'Project workbench',
    });
    if (model.state === 'project') {
      heading.createDiv({
        cls: 'project-weave-workbench__project-meta',
        text: model.project.status + ' · ' + model.project.path,
      });
    }

    const controls = header.createDiv({
      cls: 'project-weave-workbench__controls',
    });
    if (model.projectOptions.length > 0) {
      this.#renderProjectPicker(controls, model);
    }
    const refresh = controls.createEl('button', {
      cls: 'project-weave-workbench__refresh',
      text: 'Refresh',
      attr: {
        type: 'button',
        'data-workbench-focus-key': 'refresh',
      },
    });
    refresh.addEventListener('click', () => {
      void this.#rebuildIndex();
    });

    root.createDiv({
      cls: 'project-weave-workbench__revision',
      text:
        'Index ' +
        model.indexFreshness.replaceAll('_', ' ') +
        ' · revision ' +
        String(model.indexRevision) +
        diagnosticRevisionSummary(model),
      attr: {
        role: 'status',
        'aria-live': 'polite',
        'aria-atomic': 'true',
      },
    });
  }

  #renderProjectPicker(
    container: HTMLElement,
    model: ProjectWorkbenchModel,
  ): void {
    const label = container.createEl('label', {
      cls: 'project-weave-workbench__project-picker',
    });
    label.createSpan({ text: 'Project' });
    const select = label.createEl('select', {
      attr: {
        'aria-label': 'Selected Project Weave project',
        'data-workbench-focus-key': 'project-picker',
      },
    });
    const selectedPath =
      model.state === 'project'
        ? model.project.path
        : model.state === 'project_unavailable'
          ? model.requestedProjectPath
          : null;
    const hasSelectedOption =
      selectedPath !== null &&
      model.projectOptions.some((option) => option.path === selectedPath);

    if (!hasSelectedOption) {
      select.createEl('option', {
        text:
          model.state === 'project_unavailable'
            ? 'Unavailable: ' + model.requestedProjectPath
            : 'Choose a project…',
        value: '',
        attr: { disabled: 'true', selected: 'true' },
      });
    }

    for (const option of model.projectOptions) {
      const optionElement = select.createEl('option', {
        text: projectOptionLabel(option, model.projectOptions),
        value: option.path,
      });
      if (option.path === selectedPath) {
        optionElement.selected = true;
      }
    }

    select.addEventListener('change', () => {
      if (select.value.length === 0) {
        return;
      }
      this.selectProject(select.value);
    });
  }

  #renderBanner(root: HTMLElement, model: ProjectWorkbenchModel): void {
    if (model.banner === null) {
      return;
    }
    root.createDiv({
      cls:
        'project-weave-workbench__banner project-weave-workbench__banner--' +
        model.banner.kind,
      text: model.banner.message,
      attr: {
        role: model.banner.kind === 'stale_last_good' ? 'alert' : 'status',
      },
    });
  }

  #renderMessage(root: HTMLElement, title: string, description: string): void {
    const empty = root.createDiv({
      cls: 'project-weave-workbench__empty',
    });
    empty.createEl('h2', { text: title });
    empty.createEl('p', { text: description });
  }

  #renderProject(
    root: HTMLElement,
    model: Extract<ProjectWorkbenchModel, { state: 'project' }>,
  ): void {
    const metrics = root.createEl('section', {
      cls: 'project-weave-workbench__metrics',
      attr: { 'aria-label': 'Project summary' },
    });
    const values = [
      ['Tasks', model.counts.tasks],
      ['Ready', model.counts.ready],
      ['In progress', model.counts.inProgress],
      ['Blocked', model.counts.blocked],
      ['Project diagnostics', model.counts.diagnostics],
    ] as const;
    for (const [label, value] of values) {
      const metric = metrics.createDiv({
        cls: 'project-weave-workbench__metric',
      });
      metric.createDiv({
        cls: 'project-weave-workbench__metric-value',
        text: String(value),
      });
      metric.createDiv({
        cls: 'project-weave-workbench__metric-label',
        text: label,
      });
    }

    this.#renderReadyNow(root, model);
    this.#renderAllTasks(root, model);
    this.#renderDiagnostics(root, model);
  }

  #renderReadyNow(
    root: HTMLElement,
    model: Extract<ProjectWorkbenchModel, { state: 'project' }>,
  ): void {
    const readySection = root.createEl('section', {
      cls: 'project-weave-workbench__ready',
    });
    const readyHeading = readySection.createDiv({
      cls: 'project-weave-workbench__section-heading',
    });
    readyHeading.createEl('h2', {
      text: 'Ready Now',
      attr: {
        tabindex: '-1',
        'data-workbench-focus-key': 'ready-heading',
      },
    });
    readyHeading.createSpan({
      text:
        String(model.ready.displayed) +
        ' of ' +
        String(model.ready.total) +
        ' ready',
    });

    if (model.taskState === 'no_tasks') {
      this.#renderMessage(
        readySection,
        'No tasks in this project',
        'Project Weave found the project note, but no task notes resolve to it yet.',
      );
      return;
    }
    if (model.taskState === 'no_ready') {
      this.#renderMessage(
        readySection,
        'No todo tasks are ready right now',
        'No todo task currently has all prerequisites satisfied. Work may be in backlog, active, completed, waiting, or blocked.',
      );
      return;
    }

    const list = readySection.createEl('ol', {
      cls: 'project-weave-workbench__ready-list',
    });
    for (const item of model.ready.items) {
      const row = list.createEl('li', {
        cls: 'project-weave-workbench__ready-item',
      });
      const openTask = row.createEl('button', {
        cls: 'project-weave-workbench__task-link',
        text: item.title,
        attr: {
          type: 'button',
          'data-workbench-focus-key': 'task:' + item.path,
        },
      });
      openTask.addEventListener('click', () => {
        void this.#openNote(item.path);
      });

      const metadata = [
        item.rank === null ? null : 'rank ' + String(item.rank),
        item.priority === 'normal' ? null : item.priority,
        item.unlockCount === 0 ? null : 'unlocks ' + String(item.unlockCount),
      ].filter((value): value is string => value !== null);
      if (metadata.length > 0) {
        row.createDiv({
          cls: 'project-weave-workbench__task-meta',
          text: metadata.join(' · '),
        });
      }
    }

    if (model.ready.truncated) {
      if (this.#readyDisplayLimit < MAX_READY_DISPLAY_LIMIT) {
        const loadMore = readySection.createEl('button', {
          cls: 'project-weave-workbench__load-more',
          text: 'Show more',
          attr: {
            type: 'button',
            'data-workbench-focus-key': 'load-more',
          },
        });
        loadMore.addEventListener('click', () => {
          this.#readyDisplayLimit = Math.min(
            MAX_READY_DISPLAY_LIMIT,
            this.#readyDisplayLimit + READY_DISPLAY_INCREMENT,
          );
          this.#render();
        });
      } else {
        readySection.createEl('p', {
          cls: 'project-weave-workbench__limit-note',
          text: 'Showing the first 200 ready tasks.',
        });
      }
    }
  }

  #renderAllTasks(
    root: HTMLElement,
    model: Extract<ProjectWorkbenchModel, { state: 'project' }>,
  ): void {
    const section = root.createEl('section', {
      cls: 'project-weave-workbench__all-tasks',
      attr: { 'aria-label': 'All project tasks' },
    });
    const heading = section.createDiv({
      cls: 'project-weave-workbench__section-heading',
    });
    heading.createEl('h2', {
      text: 'All Tasks',
      attr: {
        tabindex: '-1',
        'data-workbench-focus-key': 'all-tasks-heading',
      },
    });
    heading.createSpan({
      text:
        String(model.allTasks.displayed) +
        ' of ' +
        String(model.allTasks.total) +
        ' matching',
    });

    const filters = section.createDiv({
      cls: 'project-weave-workbench__task-filters',
    });
    const searchLabel = filters.createEl('label', {
      cls: 'project-weave-workbench__task-search',
    });
    searchLabel.createSpan({ text: 'Search' });
    const search = searchLabel.createEl('input', {
      attr: {
        type: 'search',
        value: this.#taskSearch,
        placeholder: 'Title or path',
        'data-workbench-focus-key': 'task-filter-search',
      },
    });
    search.addEventListener('input', () => {
      this.#taskSearch = search.value;
      this.#taskDisplayLimit = INITIAL_TASK_DISPLAY_LIMIT;
      this.#render();
    });

    const statusFilters = filters.createEl('fieldset', {
      cls: 'project-weave-workbench__status-filters',
    });
    statusFilters.createEl('legend', { text: 'Statuses' });
    const statusOptions = statusFilters.createDiv({
      cls: 'project-weave-workbench__status-options',
    });
    for (const status of TASK_STATUSES) {
      const label = statusOptions.createEl('label');
      const checkbox = label.createEl('input', {
        attr: {
          type: 'checkbox',
          'data-workbench-focus-key': 'task-filter-status:' + status,
        },
      });
      checkbox.checked = this.#taskStatuses.has(status);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          this.#taskStatuses.add(status);
        } else {
          this.#taskStatuses.delete(status);
        }
        this.#taskDisplayLimit = INITIAL_TASK_DISPLAY_LIMIT;
        this.#render();
      });
      label.createSpan({ text: taskStatusLabel(status) });
    }

    const reset = filters.createEl('button', {
      cls: 'project-weave-workbench__reset-filters',
      text: 'Reset filters',
      attr: {
        type: 'button',
        'data-workbench-focus-key': 'task-filter-reset',
      },
    });

    reset.addEventListener('click', () => {
      this.#taskStatuses = new Set<TaskStatus>(
        DEFAULT_PROJECT_WORKBENCH_TASK_STATUSES,
      );
      this.#taskSearch = '';
      this.#taskPriority = null;
      this.#taskEpicPath = null;
      this.#taskMilestonePath = null;
      this.#taskOwner = null;
      this.#taskDueState = null;
      this.#taskDisplayLimit = INITIAL_TASK_DISPLAY_LIMIT;
      this.#render();
    });

    const details = filters.createDiv({
      cls: 'project-weave-workbench__task-filter-details',
    });
    this.#renderTaskFilterSelect(
      details,
      'Priority',
      'task-filter-priority',
      TASK_PRIORITIES.map((priority) => ({
        value: priority,
        label: taskStatusLabel(priority),
      })),
      this.#taskPriority,
      (value) => {
        this.#taskPriority = value as TaskPriority | null;
      },
    );
    this.#renderTaskFilterSelect(
      details,
      'Epic',
      'task-filter-epic',
      model.allTasks.filterOptions.epics,
      this.#taskEpicPath,
      (value) => {
        this.#taskEpicPath = value;
      },
    );
    this.#renderTaskFilterSelect(
      details,
      'Milestone',
      'task-filter-milestone',
      model.allTasks.filterOptions.milestones,
      this.#taskMilestonePath,
      (value) => {
        this.#taskMilestonePath = value;
      },
    );
    this.#renderTaskFilterSelect(
      details,
      'Owner',
      'task-filter-owner',
      model.allTasks.filterOptions.owners,
      this.#taskOwner,
      (value) => {
        this.#taskOwner = value;
      },
    );
    this.#renderTaskFilterSelect(
      details,
      'Due',
      'task-filter-due',
      PROJECT_WORKBENCH_DUE_STATES.map((dueState) => ({
        value: dueState,
        label: dueStateLabel(dueState),
      })),
      this.#taskDueState,
      (value) => {
        this.#taskDueState = value as ProjectWorkbenchDueState | null;
      },
    );

    if (model.counts.tasks === 0) {
      this.#renderMessage(
        section,
        'No tasks in this project',
        'Project Weave found the project note, but no task notes resolve to it yet.',
      );
      return;
    }
    if (model.allTasks.total === 0) {
      this.#renderMessage(
        section,
        'No tasks match these filters',
        'Change the search text or select additional statuses. Done and cancelled are hidden by default.',
      );
      return;
    }

    const list = section.createEl('ol', {
      cls: 'project-weave-workbench__task-list',
    });
    for (const item of model.allTasks.items) {
      const row = list.createEl('li', {
        cls: 'project-weave-workbench__task-item',
      });
      const titleRow = row.createDiv({
        cls: 'project-weave-workbench__task-title-row',
      });
      const openTask = titleRow.createEl('button', {
        cls: 'project-weave-workbench__task-link',
        text: item.title,
        attr: {
          type: 'button',
          title: 'Open ' + item.path,
          'data-workbench-focus-key': 'all-task:' + item.path,
        },
      });
      openTask.addEventListener('click', () => {
        void this.#openNote(item.path);
      });
      titleRow.createSpan({
        cls: 'project-weave-workbench__task-status',
        text: taskStatusLabel(item.status),
      });
      row.createDiv({
        cls: 'project-weave-workbench__task-path',
        text: item.path,
      });
      const readiness =
        item.blockerCount > 0
          ? String(item.blockerCount) +
            (item.blockerCount === 1 ? ' blocker' : ' blockers')
          : item.ready
            ? 'ready'
            : null;
      const metadata = [
        item.rank === null ? null : 'rank ' + String(item.rank),
        item.priority === 'normal' ? null : item.priority,
        item.epic === null ? null : 'epic ' + item.epic.title,
        item.milestone === null ? null : 'milestone ' + item.milestone.title,
        item.owner === null ? null : 'owner ' + item.owner,
        item.dueDate === null ? null : 'due ' + item.dueDate,
        readiness,
      ].filter((value): value is string => value !== null);
      if (metadata.length > 0) {
        row.createDiv({
          cls: 'project-weave-workbench__task-meta',
          text: metadata.join(' · '),
        });
      }
    }

    if (model.allTasks.truncated) {
      if (this.#taskDisplayLimit < MAX_TASK_DISPLAY_LIMIT) {
        const loadMore = section.createEl('button', {
          cls: 'project-weave-workbench__load-more',
          text: 'Show more tasks',
          attr: {
            type: 'button',
            'data-workbench-focus-key': 'all-tasks-load-more',
          },
        });
        loadMore.addEventListener('click', () => {
          this.#taskDisplayLimit = Math.min(
            MAX_TASK_DISPLAY_LIMIT,
            this.#taskDisplayLimit + TASK_DISPLAY_INCREMENT,
          );
          this.#render();
        });
      } else {
        section.createEl('p', {
          cls: 'project-weave-workbench__limit-note',
          text:
            'Showing the first 200 of ' +
            String(model.allTasks.total) +
            ' matching tasks.',
        });
      }
    }
  }
  #renderTaskFilterSelect(
    container: HTMLElement,
    labelText: string,
    focusKey: string,
    options: readonly ProjectWorkbenchTaskFilterOption[],
    selectedValue: string | null,
    onChange: (value: string | null) => void,
  ): void {
    const label = container.createEl('label');
    label.createSpan({ text: labelText });
    const select = label.createEl('select', {
      attr: {
        'aria-label': labelText + ' task filter',
        'data-workbench-focus-key': focusKey,
      },
    });
    select.createEl('option', { text: 'Any', value: '' });
    for (const option of options) {
      select.createEl('option', {
        text: option.label,
        value: option.value,
      });
    }
    if (
      selectedValue !== null &&
      !options.some((option) => option.value === selectedValue)
    ) {
      select.createEl('option', {
        text: 'Unavailable: ' + selectedValue,
        value: selectedValue,
      });
    }
    select.value = selectedValue ?? '';
    select.addEventListener('change', () => {
      onChange(select.value.length === 0 ? null : select.value);
      this.#taskDisplayLimit = INITIAL_TASK_DISPLAY_LIMIT;
      this.#render();
    });
  }

  #renderDiagnostics(
    root: HTMLElement,
    model: Extract<ProjectWorkbenchModel, { state: 'project' }>,
  ): void {
    this.#renderDiagnosticSection(root, model.diagnostics, {
      title: 'Project diagnostics',
      ariaLabel: 'Project diagnostics',
      intro:
        'Open an affected note, then correct the named field or relationship.',
      emptyMessage: 'No diagnostics for this project.',
      focusPrefix: 'project-diagnostics',
      limitLabel: 'project diagnostics',
      currentDisplayLimit: this.#diagnosticDisplayLimit,
      increaseDisplayLimit: () => {
        this.#diagnosticDisplayLimit = Math.min(
          MAX_DIAGNOSTIC_DISPLAY_LIMIT,
          this.#diagnosticDisplayLimit + DIAGNOSTIC_DISPLAY_INCREMENT,
        );
      },
    });
  }

  #renderUnassignedDiagnostics(
    root: HTMLElement,
    model: ProjectWorkbenchModel,
  ): void {
    if (model.unassignedDiagnostics.total === 0) {
      return;
    }
    this.#renderDiagnosticSection(root, model.unassignedDiagnostics, {
      title: 'Unassigned diagnostics',
      ariaLabel: 'Diagnostics not assigned to a project',
      intro:
        'These notes could not be associated with any available project. Open each note and correct the named field or link.',
      focusPrefix: 'unassigned-diagnostics',
      limitLabel: 'unassigned diagnostics',
      currentDisplayLimit: this.#unassignedDiagnosticDisplayLimit,
      increaseDisplayLimit: () => {
        this.#unassignedDiagnosticDisplayLimit = Math.min(
          MAX_DIAGNOSTIC_DISPLAY_LIMIT,
          this.#unassignedDiagnosticDisplayLimit + DIAGNOSTIC_DISPLAY_INCREMENT,
        );
      },
      emphasized: true,
    });
  }

  #renderDiagnosticSection(
    root: HTMLElement,
    diagnostics: ProjectWorkbenchDiagnosticsModel,
    options: DiagnosticSectionOptions,
  ): void {
    const section = root.createEl('section', {
      cls:
        'project-weave-workbench__diagnostics' +
        (options.emphasized === true
          ? ' project-weave-workbench__diagnostics--unassigned'
          : ''),
      attr: { 'aria-label': options.ariaLabel },
    });
    const heading = section.createDiv({
      cls: 'project-weave-workbench__section-heading',
    });
    heading.createEl('h2', {
      text: options.title,
      attr: {
        tabindex: '-1',
        'data-workbench-focus-key': options.focusPrefix + '-heading',
      },
    });
    heading.createSpan({
      text: diagnosticSummary(diagnostics),
    });
    if (diagnostics.total === 0) {
      section.createEl('p', {
        cls: 'project-weave-workbench__diagnostics-empty',
        text: options.emptyMessage ?? 'No diagnostics.',
      });
      return;
    }
    section.createEl('p', {
      cls: 'project-weave-workbench__diagnostics-intro',
      text: options.intro,
    });

    const groupList = section.createDiv({
      cls: 'project-weave-workbench__diagnostic-groups',
    });
    for (const group of groupDiagnosticsByPath(diagnostics.items)) {
      const article = groupList.createEl('article', {
        cls: 'project-weave-workbench__diagnostic-group',
        attr: { 'aria-label': 'Diagnostics for ' + group.path },
      });
      const groupHeader = article.createDiv({
        cls: 'project-weave-workbench__diagnostic-group-header',
      });
      const openNote = groupHeader.createEl('button', {
        cls: 'project-weave-workbench__diagnostic-path',
        text: group.path,
        attr: {
          type: 'button',
          title: 'Open affected note',
          'aria-label': 'Open affected note ' + group.path,
          'data-workbench-focus-key':
            options.focusPrefix + '-note:' + group.path,
        },
      });
      openNote.addEventListener('click', () => {
        void this.#openNote(group.path);
      });
      groupHeader.createSpan({
        cls: 'project-weave-workbench__diagnostic-group-count',
        text: String(group.items.length) + ' shown',
      });

      const issues = article.createEl('ul', {
        cls: 'project-weave-workbench__diagnostic-list',
      });
      for (const [issueIndex, issue] of group.items.entries()) {
        const row = issues.createEl('li', {
          cls:
            'project-weave-workbench__diagnostic project-weave-workbench__diagnostic--' +
            issue.severity,
        });
        const typeRow = row.createDiv({
          cls: 'project-weave-workbench__diagnostic-type',
        });
        typeRow.createSpan({
          cls: 'project-weave-workbench__diagnostic-severity',
          text: issue.severity,
        });
        typeRow.createEl('code', { text: issue.code });
        row.createEl('p', {
          cls: 'project-weave-workbench__diagnostic-message',
          text: issue.message,
        });
        if (issue.field !== undefined) {
          row.createDiv({
            cls: 'project-weave-workbench__diagnostic-field',
            text: 'Field: ' + issue.field,
          });
        }
        if (issue.recovery !== undefined) {
          const recovery = row.createEl('p', {
            cls: 'project-weave-workbench__diagnostic-recovery',
          });
          recovery.createEl('strong', { text: 'How to fix: ' });
          recovery.appendText(issue.recovery);
        }
        if (issue.relatedPaths !== undefined && issue.relatedPaths.length > 0) {
          const related = row.createDiv({
            cls: 'project-weave-workbench__diagnostic-related',
          });
          related.createEl('strong', { text: 'Related notes: ' });
          for (const [index, relatedPath] of issue.relatedPaths.entries()) {
            if (index > 0) {
              related.appendText(' · ');
            }
            const openRelated = related.createEl('button', {
              cls: 'project-weave-workbench__diagnostic-related-path',
              text: relatedPath,
              attr: {
                type: 'button',
                'aria-label': 'Open related note ' + relatedPath,
                'data-workbench-focus-key': diagnosticRelatedFocusKey(
                  options.focusPrefix,
                  group.path,
                  issue,
                  issueIndex,
                  relatedPath,
                  index,
                ),
              },
            });
            openRelated.addEventListener('click', () => {
              void this.#openNote(relatedPath);
            });
          }
        }
      }
    }

    if (diagnostics.truncated) {
      if (options.currentDisplayLimit < MAX_DIAGNOSTIC_DISPLAY_LIMIT) {
        const loadMore = section.createEl('button', {
          cls: 'project-weave-workbench__load-more',
          text: 'Show more diagnostics',
          attr: {
            type: 'button',
            'data-workbench-focus-key': options.focusPrefix + '-load-more',
          },
        });
        loadMore.addEventListener('click', () => {
          options.increaseDisplayLimit();
          this.#render();
        });
      } else {
        section.createEl('p', {
          cls: 'project-weave-workbench__limit-note',
          text:
            'Showing the first 200 of ' +
            String(diagnostics.total) +
            ' ' +
            options.limitLabel +
            '.',
        });
      }
    }
  }

  async #openNote(path: string): Promise<void> {
    const file = this.app.vault.getFileByPath(path);
    if (file === null) {
      new Notice(
        'That note is no longer available. Refreshing the index may help.',
      );
      return;
    }
    try {
      const leaf = this.app.workspace.getLeaf('tab');
      await leaf.openFile(file, { active: true });
    } catch (error) {
      console.error('Project Weave could not open a note', error);
      new Notice('Project Weave could not open that note.');
    }
  }

  async #rebuildIndex(): Promise<void> {
    try {
      await this.#actions.rebuildIndex();
    } catch (error) {
      console.error('Project Weave could not refresh the workbench', error);
      new Notice('Project Weave could not refresh the dashboard.');
    }
  }

  #captureFocusState(): WorkbenchFocusState | null {
    const activeElement = this.contentEl.ownerDocument.activeElement;
    if (activeElement === null || !this.contentEl.contains(activeElement)) {
      return null;
    }
    const key = activeElement.getAttribute('data-workbench-focus-key');
    if (key === null) {
      return null;
    }
    const field = asSelectableField(activeElement);
    return {
      key,
      selection: field === null ? null : captureTextSelection(field),
    };
  }

  #restoreFocus(focusState: WorkbenchFocusState | null): void {
    if (focusState === null) {
      return;
    }
    const focusKey = focusState.key;
    // Only the exact element carries a caret worth restoring; the fallbacks
    // below land on headings, where a selection means nothing.
    if (this.#focusByKey(focusKey, focusState.selection)) {
      return;
    }
    if (
      (focusKey === 'load-more' || focusKey.startsWith('task:')) &&
      this.#focusByKey('ready-heading')
    ) {
      return;
    }
    if (
      (focusKey === 'all-tasks-load-more' ||
        focusKey.startsWith('all-task:')) &&
      this.#focusByKey('all-tasks-heading')
    ) {
      return;
    }
    for (const prefix of [
      'project-diagnostics',
      'unassigned-diagnostics',
    ] as const) {
      if (
        (focusKey === prefix + '-load-more' ||
          focusKey.startsWith(prefix + '-note:') ||
          focusKey.startsWith(prefix + '-related:')) &&
        this.#focusByKey(prefix + '-heading')
      ) {
        return;
      }
    }
    if (this.#focusByKey('project-picker')) {
      return;
    }
    this.#focusByKey('refresh');
  }

  #focusByKey(
    focusKey: string,
    selection: TextSelection | null = null,
  ): boolean {
    const focusTarget = [
      ...this.contentEl.querySelectorAll<HTMLElement>(
        '[data-workbench-focus-key]',
      ),
    ].find(
      (element) =>
        element.getAttribute('data-workbench-focus-key') === focusKey,
    );
    if (focusTarget === undefined) {
      return false;
    }
    focusTarget.focus({ preventScroll: true });
    if (selection !== null) {
      const field = asSelectableField(focusTarget);
      if (field !== null) {
        applyTextSelection(field, selection);
      }
    }
    return true;
  }
}

function diagnosticRevisionSummary(model: ProjectWorkbenchModel): string {
  const parts: string[] = [];
  if (model.state === 'project') {
    parts.push('project diagnostics: ' + diagnosticSummary(model.diagnostics));
  }
  if (model.unassignedDiagnostics.total > 0) {
    parts.push(
      'unassigned diagnostics: ' +
        diagnosticSummary(model.unassignedDiagnostics),
    );
  }
  return parts.length === 0 ? '' : ' · ' + parts.join(' · ');
}

function diagnosticSummary(
  diagnostics: ProjectWorkbenchDiagnosticsModel,
): string {
  const parts = [
    diagnosticCountLabel(diagnostics.errors, 'error'),
    diagnosticCountLabel(diagnostics.warnings, 'warning'),
    diagnosticCountLabel(diagnostics.info, 'info', 'info'),
  ].filter((part): part is string => part !== null);
  if (parts.length === 0) {
    return '0 issues';
  }
  const showing =
    diagnostics.displayed === diagnostics.total
      ? ''
      : ' · showing ' +
        String(diagnostics.displayed) +
        ' of ' +
        String(diagnostics.total);
  return parts.join(' · ') + showing;
}

function diagnosticRelatedFocusKey(
  focusPrefix: DiagnosticSectionOptions['focusPrefix'],
  sourcePath: string,
  issue: ProjectWorkbenchDiagnosticItem,
  issueIndex: number,
  relatedPath: string,
  relatedIndex: number,
): string {
  return (
    focusPrefix +
    '-related:' +
    JSON.stringify([
      sourcePath,
      issue.severity,
      issue.code,
      issue.field ?? null,
      issue.message,
      issueIndex,
      relatedIndex,
      relatedPath,
    ])
  );
}

function diagnosticCountLabel(
  count: number,
  label: string,
  plural = label + 's',
): string | null {
  if (count === 0) {
    return null;
  }
  return String(count) + ' ' + (count === 1 ? label : plural);
}

interface ProjectWorkbenchDiagnosticGroup {
  readonly path: string;
  readonly items: readonly ProjectWorkbenchDiagnosticItem[];
}

function groupDiagnosticsByPath(
  items: readonly ProjectWorkbenchDiagnosticItem[],
): readonly ProjectWorkbenchDiagnosticGroup[] {
  const groups = new Map<string, ProjectWorkbenchDiagnosticItem[]>();
  for (const item of items) {
    const group = groups.get(item.path);
    if (group === undefined) {
      groups.set(item.path, [item]);
    } else {
      group.push(item);
    }
  }
  return [...groups].map(([path, groupItems]) => ({
    path,
    items: groupItems,
  }));
}

function taskStatusLabel(status: string): string {
  const label = status.replace('-', ' ');
  return label.charAt(0).toLocaleUpperCase() + label.slice(1);
}

function dueStateLabel(dueState: ProjectWorkbenchDueState): string {
  switch (dueState) {
    case 'past':
      return 'Past due date';
    case 'today':
      return 'Due today';
    case 'future':
      return 'Future due date';
    case 'none':
      return 'No due date';
  }
}

function localDateKey(date: Date): string {
  return (
    String(date.getFullYear()).padStart(4, '0') +
    '-' +
    String(date.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(date.getDate()).padStart(2, '0')
  );
}

function selectedProjectPathFromState(state: unknown): string | null {
  if (typeof state !== 'object' || state === null) {
    return null;
  }
  const record = state as Record<string, unknown>;
  const selectedProjectPath = record['selectedProjectPath'];
  if (typeof selectedProjectPath !== 'string') {
    return null;
  }
  const trimmed = selectedProjectPath.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function projectOptionLabel(
  option: ProjectWorkbenchProjectOption,
  options: readonly ProjectWorkbenchProjectOption[],
): string {
  const duplicateTitle = options.some(
    (candidate) =>
      candidate.path !== option.path &&
      candidate.title.toLocaleLowerCase() === option.title.toLocaleLowerCase(),
  );
  return duplicateTitle ? option.title + ' — ' + option.path : option.title;
}
