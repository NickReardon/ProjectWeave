import {
  ProjectWeaveQueryApi,
  type ProjectWeaveQueryDependencies,
} from './query-api';
import { IndexSnapshot } from '../indexing/index-snapshot';

export interface ProjectWeaveReadRuntime {
  readonly snapshot: IndexSnapshot;
  subscribe(listener: (snapshot: IndexSnapshot) => void): () => void;
}

export interface ProjectWeaveReadPublication {
  readonly publicationId: number;
  readonly runtimeGeneration: number;
  /**
   * Epoch milliseconds when this publication was made, from the clock the
   * caller supplied. Time is injected rather than read here so the read source
   * stays deterministic under test, matching how the projection takes today's
   * date from its caller.
   */
  readonly publishedAt: number;
  readonly snapshot: IndexSnapshot;
  readonly queryApi: ProjectWeaveQueryApi;
}

/** Epoch milliseconds. Injected so publication timing is testable. */
export type ProjectWeaveClock = () => number;

export type ProjectWeaveReadListener = (
  publication: ProjectWeaveReadPublication,
) => void;

interface PendingPublication {
  readonly publication: ProjectWeaveReadPublication;
  readonly listeners: readonly ProjectWeaveReadListener[];
}

/**
 * Stable, plugin-lifetime read access across replaceable indexing runtimes.
 */
export class ProjectWeaveReadSource {
  readonly #listeners = new Set<ProjectWeaveReadListener>();
  readonly #pendingPublications: PendingPublication[] = [];
  #publication: ProjectWeaveReadPublication;
  #publicationId = 0;
  #runtimeGeneration = 0;
  #detachRuntime: (() => void) | null = null;
  #notifying = false;
  #disposed = false;
  #queryDependencies: ProjectWeaveQueryDependencies = {};
  readonly #now: ProjectWeaveClock;

  public constructor(
    initialSnapshot: IndexSnapshot = IndexSnapshot.empty(),
    now: ProjectWeaveClock = () => Date.now(),
  ) {
    this.#now = now;
    this.#publication = createPublication(
      this.#publicationId,
      this.#runtimeGeneration,
      initialSnapshot,
      this.#now(),
    );
  }

  public get current(): ProjectWeaveReadPublication {
    return this.#publication;
  }

  public bind(
    runtime: ProjectWeaveReadRuntime,
    queryDependencies: ProjectWeaveQueryDependencies = {},
  ): void {
    if (this.#disposed) {
      return;
    }

    this.#runtimeGeneration += 1;
    this.#queryDependencies = queryDependencies;
    const generation = this.#runtimeGeneration;
    this.#detachCurrentRuntime();

    let publishedDuringSubscribe = false;
    const detach = once(
      runtime.subscribe((snapshot) => {
        publishedDuringSubscribe = true;
        this.#publishFromRuntime(snapshot, generation);
      }),
    );

    if (this.#disposed || generation !== this.#runtimeGeneration) {
      detach();
      return;
    }

    this.#detachRuntime = detach;
    if (!publishedDuringSubscribe) {
      this.#publishFromRuntime(runtime.snapshot, generation);
    }
  }

  public subscribe(listener: ProjectWeaveReadListener): () => void {
    if (this.#disposed) {
      return () => undefined;
    }

    this.#listeners.add(listener);
    this.#notify(listener, this.#publication);

    let subscribed = true;
    return () => {
      if (!subscribed) {
        return;
      }
      subscribed = false;
      this.#listeners.delete(listener);
    };
  }

  public dispose(): void {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;
    this.#detachCurrentRuntime();
    this.#listeners.clear();
    this.#pendingPublications.length = 0;
  }

  #publishFromRuntime(snapshot: IndexSnapshot, generation: number): void {
    if (this.#disposed || generation !== this.#runtimeGeneration) {
      return;
    }

    this.#publicationId += 1;
    const publication = createPublication(
      this.#publicationId,
      generation,
      snapshot,
      this.#now(),
      this.#queryDependencies,
    );
    this.#publication = publication;
    this.#pendingPublications.push({
      publication,
      listeners: [...this.#listeners],
    });
    this.#drainPublications();
  }

  #drainPublications(): void {
    if (this.#notifying) {
      return;
    }

    this.#notifying = true;
    try {
      while (!this.#disposed) {
        const pending = this.#pendingPublications.shift();
        if (pending === undefined) {
          break;
        }
        for (const listener of pending.listeners) {
          if (this.#disposed) {
            break;
          }
          if (this.#listeners.has(listener)) {
            this.#notify(listener, pending.publication);
          }
        }
      }
    } finally {
      this.#notifying = false;
    }
  }

  #notify(
    listener: ProjectWeaveReadListener,
    publication: ProjectWeaveReadPublication,
  ): void {
    try {
      listener(publication);
    } catch {
      // One consumer must not prevent publication to the remaining consumers.
    }
  }

  #detachCurrentRuntime(): void {
    const detach = this.#detachRuntime;
    this.#detachRuntime = null;
    detach?.();
  }
}

function createPublication(
  publicationId: number,
  runtimeGeneration: number,
  snapshot: IndexSnapshot,
  publishedAt: number,
  queryDependencies: ProjectWeaveQueryDependencies = {},
): ProjectWeaveReadPublication {
  return Object.freeze({
    publicationId,
    runtimeGeneration,
    publishedAt,
    snapshot,
    queryApi: new ProjectWeaveQueryApi(() => snapshot, queryDependencies),
  });
}

function once(callback: () => void): () => void {
  let active = true;
  return () => {
    if (!active) {
      return;
    }
    active = false;
    callback();
  };
}
