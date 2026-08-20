import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

export const EVERGREEN_FILES = [
  'README.md',
  '.env.example',
  'docs/project-vault/Projects/Weave/Documents/References/release.md',
];
const GENERATED_BETA_TAG = /\b\d+\.\d+\.\d+-beta\.\d+\b/u;
const CONCRETE_SHA256 = /\b[a-f0-9]{64}\b/iu;

export function findEvergreenDocumentationViolations(entries) {
  const violations = [];
  for (const { path, source } of entries) {
    if (!EVERGREEN_FILES.includes(path)) continue;
    const lines = source.split(/\r?\n/u);
    for (const [index, line] of lines.entries()) {
      if (GENERATED_BETA_TAG.test(line)) {
        violations.push({
          path,
          line: index + 1,
          message: 'remove generated beta tags from evergreen documentation',
        });
      }
      if (CONCRETE_SHA256.test(line)) {
        violations.push({
          path,
          line: index + 1,
          message:
            'remove release-specific SHA-256 values from evergreen documentation',
        });
      }
    }
  }
  return violations;
}

export function assertEvergreenDocumentation(entries) {
  const violations = findEvergreenDocumentationViolations(entries);
  if (violations.length > 0) {
    throw new Error(
      violations
        .map(({ path, line, message }) => `- ${path}:${line}: ${message}`)
        .join('\n'),
    );
  }
}

async function main() {
  const entries = await Promise.all(
    EVERGREEN_FILES.map(async (path) => ({
      path,
      source: await readFile(path, 'utf8'),
    })),
  );
  assertEvergreenDocumentation(entries);
  console.log('Evergreen documentation verified.');
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
