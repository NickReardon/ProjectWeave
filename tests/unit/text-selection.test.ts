import { describe, expect, it } from 'vitest';

import {
  applyTextSelection,
  asSelectableField,
  captureTextSelection,
  type SelectableField,
} from '../../src/ui/text-selection';

/** Minimal stand-in for an input; the module needs no real DOM. */
function field(options: {
  tagName?: string;
  type?: string;
  value?: string;
  selectionStart?: number | null;
  selectionEnd?: number | null;
  selectionDirection?: 'forward' | 'backward' | 'none' | null;
}): Record<string, unknown> & { readonly applied: unknown[] } {
  const applied: unknown[] = [];
  return {
    tagName: options.tagName ?? 'INPUT',
    type: options.type ?? 'search',
    value: options.value ?? '',
    selectionStart: options.selectionStart ?? null,
    selectionEnd: options.selectionEnd ?? null,
    selectionDirection: options.selectionDirection ?? null,
    setSelectionRange(start: number, end: number, direction?: string) {
      applied.push([start, end, direction]);
    },
    applied,
  };
}

describe('asSelectableField', () => {
  it('accepts inputs whose selection API is usable', () => {
    for (const type of ['text', 'search', 'url', 'tel', 'password']) {
      expect(asSelectableField(field({ type }))).not.toBeNull();
    }
    expect(asSelectableField(field({ tagName: 'TEXTAREA' }))).not.toBeNull();
  });

  it('rejects input types that throw when a range is set', () => {
    // Chromium raises InvalidStateError for these, so they must never reach
    // setSelectionRange.
    for (const type of ['number', 'date', 'email', 'checkbox', 'range']) {
      expect(asSelectableField(field({ type }))).toBeNull();
    }
  });

  it('rejects anything that is not a text field', () => {
    expect(asSelectableField(field({ tagName: 'BUTTON' }))).toBeNull();
    expect(asSelectableField(field({ tagName: 'SELECT' }))).toBeNull();
    expect(asSelectableField(null)).toBeNull();
    expect(asSelectableField(undefined)).toBeNull();
    expect(asSelectableField('input')).toBeNull();
    expect(asSelectableField({ tagName: 'INPUT' })).toBeNull();
  });

  it('treats an input without an explicit type as text', () => {
    const bare = { tagName: 'INPUT', value: '', setSelectionRange: () => {} };
    expect(asSelectableField(bare)).not.toBeNull();
  });
});

describe('captureTextSelection', () => {
  it('captures a caret position and its direction', () => {
    const source = field({
      value: 'combat',
      selectionStart: 6,
      selectionEnd: 6,
      selectionDirection: 'forward',
    });

    expect(captureTextSelection(source as unknown as SelectableField)).toEqual({
      start: 6,
      end: 6,
      direction: 'forward',
    });
  });

  it('defaults an absent direction to none', () => {
    const source = field({ value: 'ab', selectionStart: 1, selectionEnd: 2 });

    expect(captureTextSelection(source as unknown as SelectableField)).toEqual({
      start: 1,
      end: 2,
      direction: 'none',
    });
  });

  it('returns null when the field reports no selection', () => {
    expect(
      captureTextSelection(field({}) as unknown as SelectableField),
    ).toBeNull();
  });
});

describe('applyTextSelection', () => {
  it('restores the caret so typing continues where it left off', () => {
    // The regression this exists for: a rebuilt input focuses with the caret
    // at 0, so every keystroke inserted at the front and reversed the text.
    const target = field({ value: 'combat' });

    applyTextSelection(target as unknown as SelectableField, {
      start: 6,
      end: 6,
      direction: 'forward',
    });

    expect(target.applied).toEqual([[6, 6, 'forward']]);
  });

  it('clamps offsets to a value that changed between renders', () => {
    const target = field({ value: 'ab' });

    applyTextSelection(target as unknown as SelectableField, {
      start: 99,
      end: 99,
      direction: 'none',
    });

    expect(target.applied).toEqual([[2, 2, 'none']]);
  });

  it('never produces a reversed or negative range', () => {
    const target = field({ value: 'abcdef' });

    applyTextSelection(target as unknown as SelectableField, {
      start: -5,
      end: -9,
      direction: 'none',
    });

    expect(target.applied).toEqual([[0, 0, 'none']]);
  });

  it('truncates a fractional offset rather than passing it through', () => {
    const target = field({ value: 'abcdef' });

    applyTextSelection(target as unknown as SelectableField, {
      start: 2.7,
      end: 4.2,
      direction: 'none',
    });

    expect(target.applied).toEqual([[2, 4, 'none']]);
  });
});
