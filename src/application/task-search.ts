/**
 * The seam for task search matching, and the strategies that ship with it.
 *
 * The workbench projection depends on the `TaskSearchMatcher` contract rather
 * than on one algorithm, so the matching strategy can change without touching
 * the model, the view, or their tests.
 *
 * `substring` is the default and the only strategy with a runtime caller. The
 * others are implemented and tested but not yet reachable from the UI; see the
 * known loose ends in `docs/CURRENT_WORK.md`.
 *
 * To add a strategy, write a `TaskSearchMatcher` and register it below:
 *
 * - A pure alternative belongs here beside the others.
 * - One backed by Obsidian's `prepareFuzzySearch` belongs in the UI layer,
 *   because application code must not import Obsidian. This mirrors how
 *   `LinkResolver` keeps a pure default separate from `ObsidianLinkResolver`.
 * - Letting the user choose additionally needs a persisted setting, which is
 *   a compatibility surface and is not built.
 *
 * Matching against note properties or body text is a different problem. This
 * contract can only see what `TaskSearchCandidate` carries, and body text in
 * particular is discarded during indexing, so exposing it is a snapshot
 * decision rather than a matcher swap.
 */

/**
 * The text a search matches against, reduced from a task.
 *
 * Widening this is non-breaking: a matcher that ignores a new field keeps
 * compiling and behaving identically.
 */
export interface TaskSearchCandidate {
  readonly title: string;
  readonly path: string;
}

/**
 * Score a candidate against an already trimmed and lowercased query.
 *
 * Returns null when the candidate does not match; otherwise a score where
 * higher is better. The score exists so relevance ordering can be added later
 * without changing this contract — subsequence matching is far less useful
 * when every hit ranks equally. A matcher with no notion of relevance returns
 * a constant, which leaves ordering to the projection's deterministic
 * comparator.
 *
 * Scores are only comparable within one matcher. Nothing compares a substring
 * score against a fuzzy score.
 */
export type TaskSearchMatcher = (
  candidate: TaskSearchCandidate,
  query: string,
) => number | null;

export const TASK_SEARCH_MODES = ['substring', 'words', 'fuzzy'] as const;
export type TaskSearchMode = (typeof TASK_SEARCH_MODES)[number];

export const DEFAULT_TASK_SEARCH_MODE: TaskSearchMode = 'substring';

/** Score shared by every match a relevance-free matcher accepts. */
const FLAT_SCORE = 0;

/**
 * Literal contiguous substring of the title or path, case-insensitive.
 *
 * The long-standing default: `dodge roll` matches `Combat dodge roll`,
 * `combat roll` does not.
 */
export const substringTaskSearch: TaskSearchMatcher = (candidate, query) =>
  candidate.title.toLocaleLowerCase().includes(query) ||
  candidate.path.toLocaleLowerCase().includes(query)
    ? FLAT_SCORE
    : null;

/**
 * Every whitespace-separated token must appear somewhere in the title or path,
 * in any order. Fixes `combat roll` without the surprises of subsequence
 * matching.
 */
export const wordsTaskSearch: TaskSearchMatcher = (candidate, query) => {
  const tokens = query.split(/\s+/u).filter((token) => token.length > 0);
  if (tokens.length === 0) {
    return FLAT_SCORE;
  }
  const haystack = (
    candidate.title +
    '\n' +
    candidate.path
  ).toLocaleLowerCase();
  return tokens.every((token) => haystack.includes(token)) ? FLAT_SCORE : null;
};

/**
 * Subsequence matching: query characters must appear in order but need not be
 * adjacent, so `cdr` matches `Combat dodge roll`. Scores reward adjacency and
 * word-boundary hits, and a title match outranks a path match.
 *
 * The projection currently filters on these scores without ordering by them,
 * so results still arrive in rank order rather than best-first. Ranking is a
 * sort change in the projection, not a change to this matcher.
 */
export const fuzzyTaskSearch: TaskSearchMatcher = (candidate, query) => {
  const compact = query.replace(/\s+/gu, '');
  if (compact.length === 0) {
    return FLAT_SCORE;
  }
  const title = subsequenceScore(candidate.title.toLocaleLowerCase(), compact);
  const path = subsequenceScore(candidate.path.toLocaleLowerCase(), compact);
  if (title === null && path === null) {
    return null;
  }
  // A title hit is worth more than the same hit buried in a folder name.
  const titleScore = title === null ? null : title + TITLE_BONUS;
  return Math.max(
    titleScore ?? Number.NEGATIVE_INFINITY,
    path ?? Number.NEGATIVE_INFINITY,
  );
};

const TITLE_BONUS = 20;
const ADJACENT_BONUS = 4;
const BOUNDARY_BONUS = 3;
const CHARACTER_SCORE = 1;

function subsequenceScore(text: string, query: string): number | null {
  let cursor = 0;
  let score = 0;
  let run = 0;

  for (const character of query) {
    const found = text.indexOf(character, cursor);
    if (found === -1) {
      return null;
    }
    if (found === cursor && cursor > 0) {
      run += 1;
      score += ADJACENT_BONUS + run;
    } else {
      run = 0;
      score += CHARACTER_SCORE;
    }
    if (found === 0 || isWordBoundary(text.charAt(found - 1))) {
      score += BOUNDARY_BONUS;
    }
    cursor = found + 1;
  }

  // Prefer the shorter of two otherwise equal candidates, bounded so a very
  // long path cannot dominate the character scores.
  return score - Math.min(text.length, 200) / 200;
}

function isWordBoundary(character: string): boolean {
  return character === '' || /[\s/\\_.-]/u.test(character);
}

const MATCHERS: Readonly<Record<TaskSearchMode, TaskSearchMatcher>> = {
  substring: substringTaskSearch,
  words: wordsTaskSearch,
  fuzzy: fuzzyTaskSearch,
};

export function taskSearchMatcher(mode: TaskSearchMode): TaskSearchMatcher {
  return MATCHERS[mode];
}

/** Guards a persisted or externally supplied mode so it fails closed. */
export function isTaskSearchMode(value: unknown): value is TaskSearchMode {
  return (
    typeof value === 'string' &&
    (TASK_SEARCH_MODES as readonly string[]).includes(value)
  );
}
