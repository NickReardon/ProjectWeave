import { describe, expect, it } from 'vitest';

import {
  formatClock,
  templateClockFromLocalDate,
} from '../../src/domain/templates/model';
import type { TemplateClock } from '../../src/domain/templates/model';

const CLOCK: TemplateClock = {
  year: 2026,
  month: 8,
  day: 3,
  hour: 9,
  minute: 5,
  second: 42,
};

describe('formatClock', () => {
  it('pads every supported calendar and clock token', () => {
    expect(formatClock(CLOCK, 'YYYY-MM-DD HH:mm:ss')).toBe(
      '2026-08-03 09:05:42',
    );
    expect(formatClock(CLOCK, 'YYYYMMDD')).toBe('20260803');
  });

  it('emits bracketed text literally', () => {
    expect(formatClock(CLOCK, 'YYYY-MM-DD[T]HH:mm')).toBe('2026-08-03T09:05');
    expect(formatClock(CLOCK, '[Week of ]YYYY')).toBe('Week of 2026');
  });

  it('refuses a format it cannot honor exactly', () => {
    expect(formatClock(CLOCK, 'MMMM Do')).toBeNull();
    expect(formatClock(CLOCK, 'YYYY [unclosed')).toBeNull();
  });
});

describe('templateClockFromLocalDate', () => {
  it('reads the local calendar from a caller-supplied instant', () => {
    const local = new Date(2026, 7, 3, 9, 5, 42);

    expect(templateClockFromLocalDate(local)).toEqual(CLOCK);
  });
});
