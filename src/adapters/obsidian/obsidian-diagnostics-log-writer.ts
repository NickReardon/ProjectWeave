import { TFile, TFolder, normalizePath } from 'obsidian';
import type { Vault } from 'obsidian';

import { DIAGNOSTICS_LOG_FILENAME } from '../../application/diagnostics-log';
import type { DiagnosticsLogWriter } from '../../ports/diagnostics-log-writer';
import { normalizeVaultFolderPath } from '../../settings/project-weave-settings';

/**
 * Writes only Project Weave's derived diagnostics report. It cannot express a
 * write to an arbitrary caller-selected file.
 */
export class ObsidianDiagnosticsLogWriter implements DiagnosticsLogWriter {
  readonly #vault: Vault;

  public constructor(vault: Vault) {
    this.#vault = vault;
  }

  public async writeDiagnosticsLog(
    folder: string,
    content: string,
  ): Promise<void> {
    const normalizedFolder = normalizeVaultFolderPath(folder);
    const path = normalizePath(
      `${normalizedFolder}/${DIAGNOSTICS_LOG_FILENAME}`,
    );
    await this.#ensureFolder(normalizedFolder);

    const existing = this.#vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) {
      await this.#vault.modify(existing, content);
      return;
    }
    if (existing !== null) {
      throw new Error(`A folder already occupies the report path ${path}.`);
    }
    await this.#vault.create(path, content);
  }

  async #ensureFolder(folderPath: string): Promise<void> {
    const segments = folderPath.split('/');
    let current = '';
    for (const segment of segments) {
      current = current.length === 0 ? segment : `${current}/${segment}`;
      const existing = this.#vault.getAbstractFileByPath(current);
      if (existing instanceof TFolder) {
        continue;
      }
      if (existing !== null) {
        throw new Error(`A note already occupies the log folder ${current}.`);
      }
      await this.#vault.createFolder(current);
    }
  }
}
