import type { ProjectWeaveReadPublication } from './project-weave-read-source';
import {
  buildDiagnosticsLogDocument,
  serializeDiagnosticsLog,
} from './diagnostics-log';
import type { DiagnosticsLogWriter } from '../ports/diagnostics-log-writer';

export type DiagnosticsLogSetting = () => string;
export type DiagnosticsLogProjectRoots = () => readonly string[];
export type DiagnosticsLogErrorHandler = (error: unknown) => void;

interface PendingReport {
  readonly folder: string;
  readonly content: string;
}

/**
 * Serializes report writes so a burst of index publications cannot race and
 * leave an older report on disk than the latest snapshot.
 */
export class DiagnosticsLogService {
  readonly #writer: DiagnosticsLogWriter;
  readonly #folder: DiagnosticsLogSetting;
  readonly #projectRoots: DiagnosticsLogProjectRoots;
  readonly #onError: DiagnosticsLogErrorHandler;
  #pending: PendingReport | null = null;
  #writing = false;
  #disposed = false;

  public constructor(
    writer: DiagnosticsLogWriter,
    folder: DiagnosticsLogSetting,
    projectRoots: DiagnosticsLogProjectRoots,
    onError: DiagnosticsLogErrorHandler = () => undefined,
  ) {
    this.#writer = writer;
    this.#folder = folder;
    this.#projectRoots = projectRoots;
    this.#onError = onError;
  }

  public publish(publication: ProjectWeaveReadPublication): void {
    if (this.#disposed) {
      return;
    }

    const folder = this.#folder().trim();
    if (
      folder.length === 0 ||
      (publication.snapshot.revision === 0 &&
        publication.snapshot.freshness === 'rebuilding')
    ) {
      this.#pending = null;
      return;
    }

    this.#pending = {
      folder,
      content: serializeDiagnosticsLog(
        buildDiagnosticsLogDocument(
          publication.snapshot,
          this.#projectRoots(),
          publication.publishedAt,
        ),
      ),
    };
    void this.#drain();
  }

  public dispose(): void {
    this.#disposed = true;
    this.#pending = null;
  }

  async #drain(): Promise<void> {
    if (this.#writing || this.#disposed) {
      return;
    }
    this.#writing = true;
    try {
      while (this.#pending !== null && !this.#disposed) {
        const pending = this.#pending;
        this.#pending = null;
        try {
          await this.#writer.writeDiagnosticsLog(
            pending.folder,
            pending.content,
          );
        } catch (error) {
          this.#onError(error);
        }
      }
    } finally {
      this.#writing = false;
    }
  }
}
