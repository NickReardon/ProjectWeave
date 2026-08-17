import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const DEFAULT_PATH = 'docs/CURRENT_WORK.md';

/**
 * CURRENT_WORK.md is a mid-flight record: what is in progress on this
 * checkout, rewritten rather than appended. See ADR 0023. Checkout state is
 * the point of the file, so this gate no longer rejects it; it rejects the
 * file growing back into the accumulated accounting it used to be.
 */
const MAX_LINES = 90;

/** A dated gate entry — the shape the archived append-only log was made of. */
const DATED_EVIDENCE =
  /\b(?:passed|ran|verified|succeeded)\b[^.]{0,80}?\bon\s+\d{4}-\d{2}-\d{2}\b|\bon\s+\d{4}-\d{2}-\d{2}\b[^.]{0,80}?\b(?:passed|ran|verified|succeeded)\b/iu;

export function findCurrentWorkViolations(source) {
  const violations = [];
  const lines = source.split(/\r?\n/u);

  if (lines.length > MAX_LINES) {
    violations.push({
      line: lines.length,
      message: `keep the mid-flight record under ${MAX_LINES} lines; move finished history into the commit log`,
    });
  }

  for (const [index, line] of lines.entries()) {
    const lineNumber = index + 1;

    if (/^## Automated verification\s*$/iu.test(line)) {
      violations.push({
        line: lineNumber,
        message:
          'remove the accumulated verification log; a commit records the gate result for its own change',
      });
    }
    if (DATED_EVIDENCE.test(line)) {
      violations.push({
        line: lineNumber,
        message:
          'remove dated gate evidence; `git log` is the accounting and cannot drift from it',
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
    `${path} is accumulating history instead of recording mid-flight state:\n${violations
      .map(({ line, message }) => `- line ${line}: ${message}`)
      .join('\n')}`,
  );
}

async function main() {
  const path = process.argv[2] ?? DEFAULT_PATH;
  const source = await readFile(path, 'utf8');
  assertCurrentWork(source, path);
  console.log(`Mid-flight record verified: ${path}`);
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
