import { normalizeVaultPath } from '../domain/markdown-parser';
import type { SourceNote } from '../domain/model';
import type { LinkResolver, VaultReader } from '../ports/vault-reader';
import { IndexBuilder } from './index-builder';
import { IndexSnapshot } from './index-snapshot';

export type IndexListener = (snapshot: IndexSnapshot) => void;

export interface IndexCoordinatorOptions {
  readonly linkResolver?: LinkResolver;
  readonly debounceMilliseconds?: number;
  /**
   * The vault's configured task categories, read on each publication so a
   * settings change reaches the next rebuild without replacing the runtime.
   */
  readonly taskCategories?: () => readonly string[];
}

export class IndexCoordinator {
  readonly #reader: VaultReader;
  readonly #builder: IndexBuilder;
  readonly #linkResolver?: LinkResolver;
  readonly #taskCategories: () => readonly string[];
  readonly #debounceMilliseconds: number;
  readonly #listeners = new Set<IndexListener>();
  readonly #sources = new Map<string, SourceNote>();
  readonly #pendingUpserts = new Set<string>();
  readonly #pendingRemovals = new Set<string>();
  #snapshot = IndexSnapshot.empty();
  #queue: Promise<void> = Promise.resolve();
  #timer: ReturnType<typeof setTimeout> | null = null;
  #generation = 0;
  #initialized = false;
  #disposed = false;
  #lastError: unknown = null;

  public constructor(
    reader: VaultReader,
    options: IndexCoordinatorOptions = {},
    builder = new IndexBuilder(),
  ) {
    this.#reader = reader;
    this.#builder = builder;
    this.#linkResolver = options.linkResolver;
    this.#taskCategories = options.taskCategories ?? (() => []);
    this.#debounceMilliseconds = options.debounceMilliseconds ?? 150;
  }

  public get snapshot(): IndexSnapshot {
    return this.#snapshot;
  }

  public get lastError(): unknown {
    return this.#lastError;
  }

  public subscribe(listener: IndexListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  public rebuild(): Promise<void> {
    return this.#enqueue(async (generation) => {
      this.#publish(this.#snapshot.withFreshness('rebuilding'));
      try {
        const sourceNotes = await this.#reader.listMarkdownNotes();
        if (!this.#canPublish(generation)) {
          return;
        }
        this.#sources.clear();
        for (const source of sourceNotes) {
          this.#sources.set(normalizeVaultPath(source.path), {
            ...source,
            path: normalizeVaultPath(source.path),
          });
        }
        this.#initialized = true;
        this.#lastError = null;
        this.#publishBuild();
      } catch (error) {
        this.#lastError = error;
        if (this.#canPublish(generation)) {
          this.#publish(this.#snapshot.withFreshness('stale_last_good'));
        }
        throw error;
      }
    });
  }

  public queueUpsert(path: string): void {
    if (this.#disposed) {
      return;
    }
    const normalized = normalizeVaultPath(path);
    this.#pendingRemovals.delete(normalized);
    this.#pendingUpserts.add(normalized);
    this.#scheduleFlush();
  }

  public queueRemove(path: string): void {
    if (this.#disposed) {
      return;
    }
    const normalized = normalizeVaultPath(path);
    this.#pendingUpserts.delete(normalized);
    this.#pendingRemovals.add(normalized);
    this.#scheduleFlush();
  }

  public queueRename(oldPath: string, newPath: string): void {
    this.queueRemove(oldPath);
    this.queueUpsert(newPath);
  }

  public async flushPending(): Promise<void> {
    if (this.#timer !== null) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
    if (this.#pendingUpserts.size === 0 && this.#pendingRemovals.size === 0) {
      return;
    }

    const upserts = [...this.#pendingUpserts];
    const removals = [...this.#pendingRemovals];
    this.#pendingUpserts.clear();
    this.#pendingRemovals.clear();

    if (!this.#initialized) {
      await this.rebuild();
      return;
    }

    await this.#enqueue(async (generation) => {
      this.#publish(this.#snapshot.withFreshness('rebuilding'));
      try {
        const readResults = await Promise.all(
          upserts.map(
            async (path) =>
              [path, await this.#reader.readMarkdownNote(path)] as const,
          ),
        );
        if (!this.#canPublish(generation)) {
          return;
        }

        for (const path of removals) {
          this.#sources.delete(path);
        }
        for (const [path, source] of readResults) {
          if (source === null) {
            this.#sources.delete(path);
          } else {
            this.#sources.set(path, { ...source, path });
          }
        }
        this.#lastError = null;
        this.#publishBuild();
      } catch (error) {
        this.#lastError = error;
        if (this.#canPublish(generation)) {
          this.#publish(this.#snapshot.withFreshness('stale_last_good'));
        }
        throw error;
      }
    });
  }

  public dispose(): void {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;
    this.#generation += 1;
    if (this.#timer !== null) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
    this.#pendingUpserts.clear();
    this.#pendingRemovals.clear();
    this.#listeners.clear();
  }

  #scheduleFlush(): void {
    if (this.#timer !== null) {
      clearTimeout(this.#timer);
    }
    this.#timer = setTimeout(() => {
      this.#timer = null;
      void this.flushPending().catch(() => {
        // The stale-last-good snapshot and lastError expose the failure to callers.
      });
    }, this.#debounceMilliseconds);
  }

  #enqueue(operation: (generation: number) => Promise<void>): Promise<void> {
    if (this.#disposed) {
      return Promise.resolve();
    }
    const generation = this.#generation;
    const result = this.#queue.then(async () => {
      if (!this.#canPublish(generation)) {
        return;
      }
      await operation(generation);
    });
    this.#queue = result.catch(() => undefined);
    return result;
  }

  #publishBuild(): void {
    const next = this.#builder.build([...this.#sources.values()], {
      revision: this.#snapshot.revision + 1,
      taskCategories: this.#taskCategories(),
      ...(this.#linkResolver === undefined
        ? {}
        : { resolver: this.#linkResolver }),
    });
    this.#publish(next);
  }

  #publish(snapshot: IndexSnapshot): void {
    this.#snapshot = snapshot;
    for (const listener of this.#listeners) {
      listener(snapshot);
    }
  }

  #canPublish(generation: number): boolean {
    return !this.#disposed && generation === this.#generation;
  }
}
