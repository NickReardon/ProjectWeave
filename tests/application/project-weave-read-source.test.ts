import { describe, expect, it } from 'vitest';

import {
  ProjectWeaveReadSource,
  type ProjectWeaveReadRuntime,
} from '../../src/application/project-weave-read-source';
import { IndexSnapshot } from '../../src/indexing/index-snapshot';

describe('ProjectWeaveReadSource', () => {
  it('publishes immediately with monotonic ids and runtime generations', () => {
    const source = new ProjectWeaveReadSource(snapshot(0));
    const firstRuntime = new FakeRuntime(snapshot(1));
    const secondRuntime = new FakeRuntime(snapshot(3));
    const seen: Array<readonly [number, number, number]> = [];

    source.subscribe((publication) => {
      seen.push([
        publication.publicationId,
        publication.runtimeGeneration,
        publication.snapshot.revision,
      ]);
    });
    source.bind(firstRuntime);
    firstRuntime.publish(snapshot(2));
    source.bind(secondRuntime);
    secondRuntime.publish(snapshot(4));

    expect(seen).toEqual([
      [0, 0, 0],
      [1, 1, 1],
      [2, 1, 2],
      [3, 2, 3],
      [4, 2, 4],
    ]);
  });

  it('keeps every publication query API bound to its own snapshot', async () => {
    const source = new ProjectWeaveReadSource(snapshot(0));
    const runtime = new FakeRuntime(snapshot(7));
    source.bind(runtime);
    const prior = source.current;

    runtime.publish(snapshot(8));

    const priorResult = await prior.queryApi.listProjects();
    const currentResult = await source.current.queryApi.listProjects();
    expect(priorResult.index_revision).toBe(7);
    expect(currentResult.index_revision).toBe(8);
  });

  it('ignores callbacks retained by an old runtime after rebinding', () => {
    const source = new ProjectWeaveReadSource(snapshot(0));
    const oldRuntime = new FakeRuntime(snapshot(1));
    const currentRuntime = new FakeRuntime(snapshot(2));
    const revisions: number[] = [];
    source.subscribe((publication) => {
      revisions.push(publication.snapshot.revision);
    });

    source.bind(oldRuntime);
    source.bind(currentRuntime);
    oldRuntime.publishDetached(snapshot(99));

    expect(oldRuntime.detachCalls).toBe(1);
    expect(revisions).toEqual([0, 1, 2]);
    expect(source.current.snapshot.revision).toBe(2);
  });

  it('delivers re-entrant publications once and in order to every listener', () => {
    const source = new ProjectWeaveReadSource(snapshot(0));
    const firstRuntime = new FakeRuntime(snapshot(1));
    const secondRuntime = new FakeRuntime(snapshot(2));
    const firstListenerRevisions: number[] = [];
    const secondListenerRevisions: number[] = [];

    source.subscribe((publication) => {
      firstListenerRevisions.push(publication.snapshot.revision);
      if (publication.snapshot.revision === 1) {
        source.bind(secondRuntime);
      }
    });
    source.subscribe((publication) => {
      secondListenerRevisions.push(publication.snapshot.revision);
    });

    source.bind(firstRuntime);

    expect(firstListenerRevisions).toEqual([0, 1, 2]);
    expect(secondListenerRevisions).toEqual([0, 1, 2]);
    expect(firstRuntime.detachCalls).toBe(1);
    expect(source.current.snapshot.revision).toBe(2);
  });

  it('isolates listener failures and supports idempotent unsubscribe', () => {
    const source = new ProjectWeaveReadSource(snapshot(0));
    const runtime = new FakeRuntime(snapshot(1));
    const received: number[] = [];
    source.subscribe(() => {
      throw new Error('listener failed');
    });
    const unsubscribe = source.subscribe((publication) => {
      received.push(publication.snapshot.revision);
    });

    expect(() => source.bind(runtime)).not.toThrow();
    unsubscribe();
    unsubscribe();
    runtime.publish(snapshot(2));

    expect(received).toEqual([0, 1]);
  });

  it('detaches and clears on idempotent disposal', () => {
    const source = new ProjectWeaveReadSource(snapshot(0));
    const runtime = new FakeRuntime(snapshot(1));
    const received: number[] = [];
    source.subscribe((publication) => {
      received.push(publication.snapshot.revision);
    });
    source.bind(runtime);

    source.dispose();
    source.dispose();
    runtime.publishDetached(snapshot(2));
    source.subscribe((publication) => {
      received.push(publication.snapshot.revision);
    });
    source.bind(new FakeRuntime(snapshot(3)));

    expect(runtime.detachCalls).toBe(1);
    expect(received).toEqual([0, 1]);
    expect(source.current.snapshot.revision).toBe(1);
  });
});

class FakeRuntime implements ProjectWeaveReadRuntime {
  readonly #listeners = new Set<RuntimeListener>();
  readonly #allListeners: RuntimeListener[] = [];
  public snapshot: IndexSnapshot;
  public detachCalls = 0;

  public constructor(snapshotValue: IndexSnapshot) {
    this.snapshot = snapshotValue;
  }

  public subscribe(listener: RuntimeListener): () => void {
    this.#listeners.add(listener);
    this.#allListeners.push(listener);
    return () => {
      this.detachCalls += 1;
      this.#listeners.delete(listener);
    };
  }

  public publish(snapshotValue: IndexSnapshot): void {
    this.snapshot = snapshotValue;
    for (const listener of [...this.#listeners]) {
      listener(snapshotValue);
    }
  }

  public publishDetached(snapshotValue: IndexSnapshot): void {
    this.snapshot = snapshotValue;
    for (const listener of this.#allListeners) {
      listener(snapshotValue);
    }
  }
}

type RuntimeListener = (snapshot: IndexSnapshot) => void;

function snapshot(revision: number): IndexSnapshot {
  return new IndexSnapshot({
    revision,
    freshness: 'current',
    entities: new Map(),
    diagnostics: [],
    readiness: new Map(),
    dependencies: new Map(),
    dependents: new Map(),
    tasksByProject: new Map(),
    origins: new Map(),
  });
}
