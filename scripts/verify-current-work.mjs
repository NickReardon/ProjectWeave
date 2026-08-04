import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const DEFAULT_PATH = 'docs/CURRENT_WORK.md';
const BRANCH_IDENTIFIER =
  /(?:\b(?:branch|checkout|head)(?:\s+(?:at|from|is|named|on))?\s+`?|\bon\s+`?)(?:build|chore|codex|docs|feat|fix|refactor|release|test)\/[a-z0-9._/-]+\b/iu;

export function findCurrentWorkViolations(source) {
  const violations = [];
  const lines = source.split(/\r?\n/u);

  for (const [index, line] of lines.entries()) {
    const lineNumber = index + 1;

    if (/^## (?:Snapshot|Active slices)\s*$/iu.test(line)) {
      violations.push({
        line: lineNumber,
        message:
          'remove checkout-oriented sections; describe only post-merge operational state',
      });
    }
    if (/^\s*-\s+\*\*(?:Branch|Commit|Branch hygiene):\*\*/iu.test(line)) {
      violations.push({
        line: lineNumber,
        message:
          'remove current checkout identity; commits are allowed only as validation evidence',
      });
    }
    if (BRANCH_IDENTIFIER.test(line)) {
      violations.push({
        line: lineNumber,
        message:
          'remove branch identifiers; keep pre-merge handoff details outside CURRENT_WORK.md',
      });
    }
    if (/^\s*(?:[-*]|\d+\.)\s+.*\bmerge\b.*\b(?:branch|main)\b/iu.test(line)) {
      violations.push({
        line: lineNumber,
        message:
          'write the next decision for the post-merge state, not as a merge instruction',
      });
    }
  }

  return violations;
}

export function assertCurrentWork(source, path = DEFAULT_PATH) {
  const violations = findCurrentWorkViolations(source);
  if (violations.length === 0) {
    return;
  }

  throw new Error(
    `${path} contains volatile checkout state:\n${violations
      .map(({ line, message }) => `- line ${line}: ${message}`)
      .join('\n')}`,
  );
}

async function main() {
  const path = process.argv[2] ?? DEFAULT_PATH;
  const source = await readFile(path, 'utf8');
  assertCurrentWork(source, path);
  console.log(`Current-work handoff verified: ${path}`);
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

const isMain =
  process.argv[1] !== undefined &&
  pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  main().catch((error) => {
    console.error(errorMessage(error));
    process.exitCode = 1;
  });
}
