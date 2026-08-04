import { describe, expect, it } from 'vitest';

import {
  DEFAULT_TASK_SEARCH_MODE,
  fuzzyTaskSearch,
  isTaskSearchMode,
  substringTaskSearch,
  TASK_SEARCH_MODES,
  taskSearchMatcher,
  wordsTaskSearch,
  type TaskSearchCandidate,
  type TaskSearchMatcher,
} from '../../src/application/task-search';

const TASK: TaskSearchCandidate = {
  title: 'Combat dodge roll',
  path: 'Projects/Game/Tasks/Combat/Combat dodge roll.md',
};

const matched = (score: number | null): boolean => score !== null;

describe('substringTaskSearch', () => {
  it('matches a contiguous run in the title', () => {
    expect(matched(substringTaskSearch(TASK, 'dodge roll'))).toBe(true);
    expect(matched(substringTaskSearch(TASK, 'combat'))).toBe(true);
  });

  it('matches the vault path as well as the title', () => {
    expect(matched(substringTaskSearch(TASK, 'projects/game'))).toBe(true);
  });

  it('does not match tokens separated in the source', () => {
    // The long-standing behavior: the query is one literal string.
    expect(matched(substringTaskSearch(TASK, 'combat roll'))).toBe(false);
    expect(matched(substringTaskSearch(TASK, 'cdr'))).toBe(false);
  });

  it('scores every match identically so ordering is left to the caller', () => {
    expect(substringTaskSearch(TASK, 'combat')).toBe(
      substringTaskSearch(TASK, 'roll'),
    );
  });
});

describe('wordsTaskSearch', () => {
  it('matches tokens in any order and across title and path', () => {
    expect(matched(wordsTaskSearch(TASK, 'combat roll'))).toBe(true);
    expect(matched(wordsTaskSearch(TASK, 'roll combat'))).toBe(true);
    expect(matched(wordsTaskSearch(TASK, 'game dodge'))).toBe(true);
  });

  it('requires every token to appear', () => {
    expect(matched(wordsTaskSearch(TASK, 'combat parry'))).toBe(false);
  });

  it('ignores surplus whitespace between tokens', () => {
    expect(matched(wordsTaskSearch(TASK, 'combat    roll'))).toBe(true);
    expect(matched(wordsTaskSearch(TASK, '   '))).not.toBeNull();
  });
});

describe('fuzzyTaskSearch', () => {
  it('matches characters in order without requiring adjacency', () => {
    expect(matched(fuzzyTaskSearch(TASK, 'cdr'))).toBe(true);
    expect(matched(fuzzyTaskSearch(TASK, 'cmbt'))).toBe(true);
  });

  it('rejects characters that are out of order', () => {
    expect(matched(fuzzyTaskSearch(TASK, 'rdc'))).toBe(false);
    expect(matched(fuzzyTaskSearch(TASK, 'combatx'))).toBe(false);
  });

  it('scores a title hit above the same hit only in the path', () => {
    const titled: TaskSearchCandidate = {
      title: 'Combat dodge roll',
      path: 'Projects/Game/Tasks/A.md',
    };
    const buried: TaskSearchCandidate = {
      title: 'Unrelated',
      path: 'Projects/Combat dodge roll/A.md',
    };

    const titleScore = fuzzyTaskSearch(titled, 'cdr') ?? 0;
    const pathScore = fuzzyTaskSearch(buried, 'cdr') ?? 0;
    expect(titleScore).toBeGreaterThan(pathScore);
  });

  it('scores a contiguous match above a scattered one', () => {
    const contiguous = fuzzyTaskSearch(
      { title: 'combat', path: 'a.md' },
      'comb',
    );
    const scattered = fuzzyTaskSearch(
      { title: 'c o m b at', path: 'a.md' },
      'comb',
    );

    expect(contiguous ?? 0).toBeGreaterThan(scattered ?? 0);
  });

  it('is deterministic for the same candidate and query', () => {
    expect(fuzzyTaskSearch(TASK, 'cdr')).toBe(fuzzyTaskSearch(TASK, 'cdr'));
  });
});

describe('taskSearchMatcher', () => {
  it('resolves every declared mode', () => {
    for (const mode of TASK_SEARCH_MODES) {
      expect(typeof taskSearchMatcher(mode)).toBe('function');
    }
  });

  it('defaults to the long-standing substring behavior', () => {
    expect(DEFAULT_TASK_SEARCH_MODE).toBe('substring');
    expect(taskSearchMatcher(DEFAULT_TASK_SEARCH_MODE)).toBe(
      substringTaskSearch,
    );
  });

  it('recognizes only declared modes, so persisted values fail closed', () => {
    expect(isTaskSearchMode('fuzzy')).toBe(true);
    expect(isTaskSearchMode('regex')).toBe(false);
    expect(isTaskSearchMode(null)).toBe(false);
    expect(isTaskSearchMode(2)).toBe(false);
  });
});

describe('TaskSearchMatcher contract', () => {
  it('accepts an arbitrary strategy that returns a score or null', () => {
    // Stands in for a strategy added later: only the contract is exercised.
    const titleOnly: TaskSearchMatcher = (candidate, query) =>
      candidate.title.toLocaleLowerCase().includes(query) ? 5 : null;

    expect(titleOnly(TASK, 'dodge')).toBe(5);
    expect(titleOnly(TASK, 'projects')).toBeNull();
  });
});
