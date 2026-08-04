/**
 * Caret and selection preservation for views that re-render by rebuilding
 * their DOM.
 *
 * Restoring focus alone is not enough. A freshly created input has never held
 * a selection, so focusing it leaves the caret at position 0 and every
 * subsequent keystroke inserts at the front of the field.
 */

/** Input types whose selection API is usable; others throw on access. */
const SELECTABLE_INPUT_TYPES: ReadonlySet<string> = new Set([
  'text',
  'search',
  'url',
  'tel',
  'password',
]);

export type TextSelectionDirection = 'forward' | 'backward' | 'none';

export interface TextSelection {
  readonly start: number;
  readonly end: number;
  readonly direction: TextSelectionDirection;
}

/** The parts of an input or textarea this module needs. */
export interface SelectableField {
  readonly value: string;
  readonly selectionStart: number | null;
  readonly selectionEnd: number | null;
  readonly selectionDirection?: TextSelectionDirection | null;
  setSelectionRange(
    start: number,
    end: number,
    direction?: TextSelectionDirection,
  ): void;
}

/**
 * Narrow an element to a field whose selection can be read and restored, or
 * null when it is not one. Number, date, and email inputs report a tag and a
 * selection property but throw when the range is set, so they are excluded.
 */
export function asSelectableField(element: unknown): SelectableField | null {
  if (element === null || typeof element !== 'object') {
    return null;
  }
  const candidate = element as {
    tagName?: unknown;
    type?: unknown;
    value?: unknown;
    setSelectionRange?: unknown;
  };
  if (
    typeof candidate.value !== 'string' ||
    typeof candidate.setSelectionRange !== 'function'
  ) {
    return null;
  }

  const tagName =
    typeof candidate.tagName === 'string'
      ? candidate.tagName.toUpperCase()
      : '';
  if (tagName === 'TEXTAREA') {
    return element as SelectableField;
  }
  if (tagName !== 'INPUT') {
    return null;
  }
  const type =
    typeof candidate.type === 'string' ? candidate.type.toLowerCase() : 'text';
  return SELECTABLE_INPUT_TYPES.has(type) ? (element as SelectableField) : null;
}

export function captureTextSelection(
  field: SelectableField,
): TextSelection | null {
  const { selectionStart, selectionEnd } = field;
  if (selectionStart === null || selectionEnd === null) {
    return null;
  }
  return {
    start: selectionStart,
    end: selectionEnd,
    direction: field.selectionDirection ?? 'none',
  };
}

/**
 * Reapply a captured selection. Offsets are clamped to the current value,
 * because the field may have been rebuilt with different text and an
 * out-of-range offset would otherwise land the caret somewhere arbitrary.
 */
export function applyTextSelection(
  field: SelectableField,
  selection: TextSelection,
): void {
  const limit = field.value.length;
  const start = clamp(selection.start, limit);
  const end = clamp(Math.max(selection.end, start), limit);
  field.setSelectionRange(start, end, selection.direction);
}

function clamp(value: number, limit: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.min(Math.trunc(value), limit);
}
