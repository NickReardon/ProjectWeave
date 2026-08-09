/**
 * Writes the one derived diagnostics report selected by the user. This is a
 * typed export sink, not a general-purpose vault mutation capability.
 */
export interface DiagnosticsLogWriter {
  writeDiagnosticsLog(folder: string, content: string): Promise<void>;
}
