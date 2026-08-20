import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { posix, resolve, sep } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const DOCS_ROOT = 'docs';
const ARCHIVE_PREFIX = 'docs/archive/';
const SPEC_PREFIX = 'docs/spec/';
const PROJECT_VAULT_PREFIX = 'docs/project-vault/';

const MARKDOWN_LINK = /\[[^\]]*\]\(([^)]+)\)/gu;
const WIKILINK = /\[\[([^\]]+)\]\]/gu;
const NUMERIC_SPEC_BASENAME = /^\d+[-_]/u;
const NUMERIC_BASENAME_PREFIX = /^(\d+)-/u;
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---/u;
const FRONTMATTER_TYPE = /^type:\s*(\S+)\s*$/mu;
const FRONTMATTER_ID = /^id:\s*['"]?([^'"\s]+)['"]?\s*$/mu;
const DECISION_HEADING = /^#\s*ADR\s*(\d+)/mu;
const NUMBERED_CITATION = /\b(?:Spec|Design) \d+\b/gu;
const QUOTE_CHARS = new Set(['"', "'", '“', '”', '‘', '’']);

/**
 * One historical collision survives: two accepted records declare `id: 0025`.
 * An accepted record is immutable and its id is what other documents cite it
 * by, so the pair stands as history rather than being renumbered;
 * `../docs/decisions/README.md` owns that rule. The exact pair is
 * grandfathered rather than the id, so a third 0025 is still a violation.
 */
const HISTORICAL_DUPLICATE_DECISIONS = new Map([
  [
    '0025',
    [
      '0025-merge-ready-current-work-and-evergreen-release-docs.md',
      '0025-name-specifications-by-subject.md',
    ],
  ],
]);

function isArchived(path) {
  return path.startsWith(ARCHIVE_PREFIX);
}

function toPosix(path) {
  return path.split(sep).join('/');
}

/**
 * A relative Markdown link target is a candidate for existence-checking when
 * it is not a URL, a mailto link, or an anchor-only in-page reference.
 */
function isCheckableLinkTarget(target) {
  const trimmed = target.trim();
  if (trimmed === '') return false;
  if (trimmed.startsWith('#')) return false;
  if (/^[a-z][a-z0-9+.-]*:/iu.test(trimmed)) return false; // any URL scheme, incl. mailto:
  return true;
}

function stripAnchorAndQuery(target) {
  return target.split('#')[0].split('?')[0];
}

function decodeTarget(target) {
  try {
    return decodeURIComponent(target);
  } catch {
    return target;
  }
}

function resolveRelativeLink(fromPath, target) {
  const stripped = decodeTarget(stripAnchorAndQuery(target).trim());
  if (stripped === '') return null;
  if (stripped.startsWith('/')) return stripped.slice(1);
  return posix.normalize(posix.join(posix.dirname(fromPath), stripped));
}

function stripWikilinkSuffixes(target) {
  return target.split('|')[0].split('#')[0].trim();
}

/**
 * Wikilinks in the dogfood vault resolve the way Obsidian's own "shortest
 * path" link resolution does: the authored target is matched against the
 * *end* of a real note's path relative to the vault root
 * (`docs/project-vault/`), aligned on a path separator. A task note links
 * `[[Projects/Weave/Project]]` (the whole vault-relative path) and an epic
 * note links `[[Milestones/v1 release]]` (a path relative to the project
 * folder one level down) — both resolve under this single rule because both
 * are true suffixes of the note's actual vault-relative path.
 *
 * A target that is explicitly relative (starts with `./` or `../`) instead
 * resolves relative to the linking note's own directory, exactly like a
 * relative Markdown link — Obsidian honors that form too.
 */
function wikilinkResolves(fromPath, target, vaultNotePaths, fileExists) {
  if (target.startsWith('./') || target.startsWith('../')) {
    const resolved = posix.normalize(
      posix.join(posix.dirname(fromPath), `${target}.md`),
    );
    return fileExists(resolved);
  }
  const suffix = `${target}.md`;
  for (const notePath of vaultNotePaths) {
    if (notePath === suffix || notePath.endsWith(`/${suffix}`)) return true;
  }
  return false;
}

function isQuotedMatch(line, index, length) {
  const before = line[index - 1];
  const after = line[index + length];
  return QUOTE_CHARS.has(before) && QUOTE_CHARS.has(after);
}

/**
 * A decision record is identified by its frontmatter rather than by where it
 * sits or what it is called. `type: decision` makes a note a record and `id`
 * is what other documents cite it by, so a record without an id has no
 * identity. The number in the filename and in the heading are conveniences,
 * and a convenience may not contradict the identifier.
 *
 * Recognizing records by frontmatter rather than by directory keeps the rule
 * working when the decision log moves into the vault and its filenames stop
 * carrying numbers. The packaged template is exempt: it declares
 * `type: decision-template` and carries no identity of its own.
 */
function readDecisionId(source) {
  const frontmatter = FRONTMATTER.exec(source)?.[1];
  if (frontmatter === undefined) return null;
  if (FRONTMATTER_TYPE.exec(frontmatter)?.[1] !== 'decision') return null;
  return FRONTMATTER_ID.exec(frontmatter)?.[1] ?? null;
}

function basenameOf(path) {
  return path.slice(path.lastIndexOf('/') + 1);
}

function findDecisionIdentityViolations(path, source) {
  const frontmatter = FRONTMATTER.exec(source)?.[1];
  if (frontmatter === undefined) return [];
  if (FRONTMATTER_TYPE.exec(frontmatter)?.[1] !== 'decision') return [];

  const id = FRONTMATTER_ID.exec(frontmatter)?.[1];
  if (id === undefined) {
    return [
      {
        path,
        line: 1,
        message:
          'decision record declares no frontmatter id, which is the identifier it is cited by',
      },
    ];
  }

  const violations = [];
  const named = NUMERIC_BASENAME_PREFIX.exec(basenameOf(path))?.[1];
  const heading = DECISION_HEADING.exec(source)?.[1];

  if (named !== undefined && named !== id) {
    violations.push({
      path,
      line: 1,
      message: `decision record filename number ${named} disagrees with its declared id ${id}`,
    });
  }

  if (heading !== undefined && heading !== id) {
    violations.push({
      path,
      line: 1,
      message: `decision record heading ADR ${heading} disagrees with its declared id ${id}`,
    });
  }

  return violations;
}

/**
 * A declared id is a citation identifier, so two records may never share one.
 * This is a property of the set rather than of a single file, so it is checked
 * across all entries at once.
 */
function findDuplicateDecisionIds(entries) {
  const byId = new Map();

  for (const { path, source } of entries) {
    if (isArchived(path)) continue;
    const id = readDecisionId(source);
    if (id === null) continue;
    const seen = byId.get(id) ?? [];
    seen.push(path);
    byId.set(id, seen);
  }

  const violations = [];

  for (const [id, paths] of byId) {
    if (paths.length < 2) continue;
    const found = [...paths].sort();
    const basenames = found.map(basenameOf);
    const historical = HISTORICAL_DUPLICATE_DECISIONS.get(id);
    if (
      historical !== undefined &&
      basenames.length === historical.length &&
      basenames.every((basename) => historical.includes(basename))
    ) {
      continue;
    }
    for (const path of found) {
      violations.push({
        path,
        line: 1,
        message: `duplicate decision record id ${id}: ${basenames.join(', ')}`,
      });
    }
  }

  return violations;
}

export function findDocLinkViolations(entries, options = {}) {
  const { fileExists = () => false, vaultNotePaths = [] } = options;
  const violations = [];

  for (const { path, source } of entries) {
    if (isArchived(path)) continue;

    if (path.startsWith(SPEC_PREFIX)) {
      const basename = path.slice(SPEC_PREFIX.length);
      if (NUMERIC_SPEC_BASENAME.test(basename)) {
        violations.push({
          path,
          line: 1,
          message: `specification filename carries a numeric prefix: ${basename}`,
        });
      }
    }

    violations.push(...findDecisionIdentityViolations(path, source));

    const lines = source.split(/\r?\n/u);
    const inVault = path.startsWith(PROJECT_VAULT_PREFIX);

    for (const [index, line] of lines.entries()) {
      const lineNumber = index + 1;

      for (const match of line.matchAll(MARKDOWN_LINK)) {
        const target = match[1];
        if (!isCheckableLinkTarget(target)) continue;
        const resolved = resolveRelativeLink(path, target);
        if (resolved === null) continue;
        if (!fileExists(resolved)) {
          violations.push({
            path,
            line: lineNumber,
            message: `broken relative link to ${target} (resolved: ${resolved})`,
          });
        }
      }

      if (inVault) {
        for (const match of line.matchAll(WIKILINK)) {
          const rawTarget = match[1];
          const target = stripWikilinkSuffixes(rawTarget);
          if (target === '') continue;
          if (!wikilinkResolves(path, target, vaultNotePaths, fileExists)) {
            violations.push({
              path,
              line: lineNumber,
              message: `broken wikilink to [[${rawTarget}]]`,
            });
          }
        }
      }

      for (const match of line.matchAll(NUMBERED_CITATION)) {
        if (isQuotedMatch(line, match.index, match[0].length)) continue;
        violations.push({
          path,
          line: lineNumber,
          message: `surviving numbered citation: ${match[0]}`,
        });
      }
    }
  }

  violations.push(...findDuplicateDecisionIds(entries));

  return violations;
}

export function assertDocLinks(entries, options = {}) {
  const violations = findDocLinkViolations(entries, options);
  if (violations.length > 0) {
    throw new Error(
      violations
        .map(({ path, line, message }) => `- ${path}:${line}: ${message}`)
        .join('\n'),
    );
  }
}

async function listMarkdownFiles(root, dir) {
  const entries = await readdir(resolve(root, dir), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const childPosix = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (entry.name === '.obsidian') continue;
      files.push(...(await listMarkdownFiles(root, childPosix)));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(childPosix);
    }
  }
  return files;
}

/**
 * Drop paths git ignores. Tools installed into the dogfood vault write their
 * own files there — BRAT keeps an update log of `[[date]]` entries — and those
 * are tool output rather than project documents. The gate checks the documents
 * the repository carries, so git's own answer is the right filter.
 */
async function withoutIgnoredFiles(root, paths) {
  if (paths.length === 0) return paths;
  try {
    const ignored = await new Promise((resolveList, rejectList) => {
      const git = spawn('git', ['check-ignore', '--stdin'], { cwd: root });
      let out = '';
      git.stdout.on('data', (chunk) => (out += chunk));
      git.on('error', rejectList);
      // Exit code 1 means nothing matched, which is success for this purpose.
      git.on('close', (code) =>
        code === 0 || code === 1
          ? resolveList(out)
          : rejectList(new Error(`git check-ignore exited ${code}`)),
      );
      git.stdin.end(`${paths.join('\n')}\n`);
    });
    const ignoredSet = new Set(
      ignored
        .split('\n')
        .map((line) => line.trim().replaceAll('\\', '/'))
        .filter(Boolean),
    );
    return paths.filter((path) => !ignoredSet.has(path));
  } catch {
    // No git, or no repository. Check everything rather than silently skipping.
    return paths;
  }
}

async function main() {
  const root = resolve(import.meta.dirname, '..');
  const docFiles = await withoutIgnoredFiles(
    root,
    await listMarkdownFiles(root, DOCS_ROOT),
  );

  const entries = await Promise.all(
    docFiles.map(async (path) => ({
      path,
      source: await readFile(resolve(root, path), 'utf8'),
    })),
  );

  const vaultNotePaths = docFiles
    .filter((path) => path.startsWith(PROJECT_VAULT_PREFIX))
    .map((path) => path.slice(PROJECT_VAULT_PREFIX.length));

  const fileExists = (path) => existsSync(resolve(root, toPosix(path)));

  assertDocLinks(entries, { fileExists, vaultNotePaths });
  console.log('Documentation links and naming verified.');
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
