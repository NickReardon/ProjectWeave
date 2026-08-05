/**
 * The only write-capable port in Project Weave.
 *
 * It is deliberately not a general vault writer. There is one operation —
 * create a note that does not exist — and no way to express modification,
 * overwrite, move, or delete. A caller holding this port cannot damage
 * existing content even if it is wrong about everything else.
 *
 * Every use must pass through the typed proposal and commit services, which
 * own confirmation, fingerprint re-checks, and validation. Nothing else in the
 * plugin may depend on this port.
 */
export type NoteCreateOutcome =
  /** The note was created with exactly the requested bytes. */
  | { readonly kind: 'created' }
  /** Something already occupies the path; nothing was written. */
  | { readonly kind: 'exists' }
  /** The path lies outside the writable scope; nothing was written. */
  | { readonly kind: 'out_of_scope' }
  /** The vault refused the write; nothing is known to have been written. */
  | { readonly kind: 'failed'; readonly message: string };

export interface NoteWriter {
  /**
   * Create a note, including any missing parent folders.
   *
   * Implementations must never overwrite. A path that already exists returns
   * `exists` rather than replacing content, even when the existing bytes are
   * identical to the requested ones.
   */
  createNote(path: string, content: string): Promise<NoteCreateOutcome>;
}
