import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import { normalizeVaultPath } from '../src/domain/markdown-parser';
import type { Diagnostic, SourceNote } from '../src/domain/model';
import { getProjectDiagnostics } from '../src/application/project-diagnostics';
import { IndexBuilder } from '../src/indexing/index-builder';
import { normalizeProjectRoots } from '../src/settings/project-weave-settings';

interface Options {
  readonly vaultPath: string;
  readonly projectRoots: readonly string[];
  readonly projectPath: string | null;
  readonly categories: readonly string[];
  readonly outputPath: string | null;
  readonly pretty: boolean;
  readonly failOnErrors: boolean;
  readonly watch: boolean;
  readonly help: boolean;
}

const DEFAULT_PROJECT_ROOT = 'Projects';

async function parseArguments(argv: readonly string[]): Promise<Options> {
  let vaultPath: string | null = null;
  let projectPath: string | null = null;
  let outputPath: string | null = null;
  const roots: string[] = [];
  const categories: string[] = [];
  let pretty = false;
  let failOnErrors = false;
  let watch = false;
  let help = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    switch (argument) {
      case '--vault':
        vaultPath = nextArgument(argv, ++index, '--vault');
        break;
      case '--root':
        roots.push(nextArgument(argv, ++index, '--root'));
        break;
      case '--project':
        projectPath = nextArgument(argv, ++index, '--project');
        break;
      case '--category':
        categories.push(nextArgument(argv, ++index, '--category'));
        break;
      case '--out':
        outputPath = nextArgument(argv, ++index, '--out');
        break;
      case '--pretty':
        pretty = true;
        break;
      case '--fail-on-errors':
        failOnErrors = true;
        break;
      case '--watch':
        watch = true;
        break;
      case '--help':
      case '-h':
        help = true;
        break;
      default:
        throw new Error(`Unsupported argument: ${argument ?? ''}.`);
    }
  }

  if (help) {
    return {
      vaultPath: resolve('.'),
      projectRoots: [DEFAULT_PROJECT_ROOT],
      projectPath: null,
      categories: [],
      outputPath: null,
      pretty: false,
      failOnErrors: false,
      watch: false,
      help: true,
    };
  }
  if (vaultPath === null) {
    const environmentPath = process.env.PROJECT_WEAVE_VAULT?.trim();
    vaultPath =
      environmentPath !== undefined && environmentPath.length > 0
        ? environmentPath
        : await loadDotEnvVaultPath();
  }
  if (vaultPath === null || vaultPath.length === 0) {
    throw new Error(
      'No vault configured. Pass --vault, set PROJECT_WEAVE_VAULT, or add it to .env.',
    );
  }
  if (watch && outputPath === null) {
    throw new Error(
      '--watch requires --out so each refresh remains valid JSON.',
    );
  }
  if (watch && failOnErrors) {
    throw new Error('--fail-on-errors cannot be combined with --watch.');
  }

  return {
    vaultPath: resolve(vaultPath),
    projectRoots: normalizeProjectRoots(
      roots.length === 0 ? [DEFAULT_PROJECT_ROOT] : roots,
    ),
    projectPath: projectPath === null ? null : normalizeVaultPath(projectPath),
    categories: [
      ...new Set(categories.map((category) => category.trim())),
    ].filter((category) => category.length > 0),
    outputPath: outputPath === null ? null : resolve(outputPath),
    pretty,
    failOnErrors,
    watch,
    help,
  };
}

function nextArgument(
  argv: readonly string[],
  index: number,
  option: string,
): string {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) {
    throw new Error(`${option} expects a value.`);
  }
  return value;
}

function printUsage(): void {
  console.log(`Project Weave diagnostics

Usage:
  npm run diagnostics [-- --vault <path>] [options]

The vault may also be set with PROJECT_WEAVE_VAULT in the environment or .env.

Options:
  --root <folder>      Indexed vault folder; repeatable (default: Projects)
  --project <path>     Return diagnostics assigned to one project note
  --category <value>   Enable task category validation; repeatable
  --out <file>         Write JSON to a file instead of stdout
  --pretty             Format JSON with indentation
  --fail-on-errors     Exit unsuccessfully when any error diagnostic is found
  --watch              Re-run after Markdown changes (requires --out)
`);
}

async function loadDotEnvVaultPath(): Promise<string | null> {
  const contents = await readFile(resolve('.env'), 'utf8').catch(
    (error: unknown) => {
      if (isMissingPath(error)) {
        return null;
      }
      throw error;
    },
  );
  if (contents === null) {
    return null;
  }
  for (const line of contents.split(/\r?\n/u)) {
    const match = /^(?:export\s+)?PROJECT_WEAVE_VAULT\s*=\s*(.*)$/u.exec(
      line.trim(),
    );
    if (match !== null) {
      const value = unquoteEnvValue(match[1] ?? '');
      return value.length === 0 ? null : value;
    }
  }
  return null;
}

function unquoteEnvValue(value: string): string {
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    return value.slice(1, -1).trim();
  }
  return value.trim();
}

async function collectNotes(
  vaultPath: string,
  projectRoots: readonly string[],
): Promise<readonly SourceNote[]> {
  const paths: string[] = [];
  for (const root of projectRoots) {
    await visit(vaultPath, root, paths);
  }
  paths.sort(comparePath);
  return Promise.all(
    paths.map(async (path) => {
      const absolutePath = join(vaultPath, ...path.split('/'));
      const content = await readFile(absolutePath, 'utf8');
      return {
        path,
        content,
        fingerprint: fingerprint(content),
      };
    }),
  );
}

async function visit(
  vaultPath: string,
  prefix: string,
  paths: string[],
): Promise<void> {
  const directory = join(vaultPath, ...prefix.split('/').filter(Boolean));
  const entries = await readdir(directory, { withFileTypes: true }).catch(
    (error: unknown) => {
      if (isMissingPath(error)) {
        return [];
      }
      throw error;
    },
  );
  for (const entry of entries) {
    if (entry.name === '.obsidian') {
      continue;
    }
    const path = prefix.length === 0 ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      await visit(vaultPath, path, paths);
    } else if (
      entry.isFile() &&
      entry.name.toLocaleLowerCase().endsWith('.md') &&
      !paths.includes(path)
    ) {
      paths.push(path);
    }
  }
}

function isMissingPath(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}

function comparePath(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: 'accent' });
}

function fingerprint(content: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < content.length; index += 1) {
    hash ^= content.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `cli-fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function buildOutput(
  options: Options,
  diagnostics: readonly Diagnostic[],
  noteCount: number,
): string {
  const payload = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    vault: options.vaultPath,
    project_roots: options.projectRoots,
    project: options.projectPath,
    note_count: noteCount,
    counts: {
      total: diagnostics.length,
      errors: diagnostics.filter((issue) => issue.severity === 'error').length,
      warnings: diagnostics.filter((issue) => issue.severity === 'warning')
        .length,
      info: diagnostics.filter((issue) => issue.severity === 'info').length,
    },
    diagnostics,
  };
  return JSON.stringify(payload, null, options.pretty ? 2 : 0) + '\n';
}

async function refresh(options: Options): Promise<number> {
  const notes = await collectNotes(options.vaultPath, options.projectRoots);
  const snapshot = new IndexBuilder().build(notes, {
    revision: 1,
    taskCategories: options.categories,
  });
  const diagnostics =
    options.projectPath === null
      ? snapshot.diagnostics
      : getProjectDiagnostics(snapshot, options.projectPath);
  const output = buildOutput(options, diagnostics, notes.length);
  if (options.outputPath === null) {
    process.stdout.write(output);
  } else {
    await mkdir(dirname(options.outputPath), { recursive: true });
    await writeFile(options.outputPath, output, 'utf8');
  }
  return diagnostics.filter((issue) => issue.severity === 'error').length;
}

async function run(options: Options): Promise<void> {
  if (options.help) {
    printUsage();
    return;
  }
  const errorCount = await refresh(options);
  if (!options.watch) {
    if (options.failOnErrors && errorCount > 0) {
      console.error(
        `Diagnostics check failed: ${errorCount} error diagnostic${errorCount === 1 ? '' : 's'} found.`,
      );
      process.exitCode = 1;
    }
    return;
  }

  const { watch } = await import('node:fs');
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  let queued = false;
  const rerun = (): void => {
    if (running) {
      queued = true;
      return;
    }
    running = true;
    void refresh(options)
      .catch((error: unknown) => {
        console.error(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        running = false;
        if (queued) {
          queued = false;
          rerun();
        }
      });
  };
  const watcher = watch(
    options.vaultPath,
    { recursive: true },
    (_event, name) => {
      if (name !== null && !String(name).toLocaleLowerCase().endsWith('.md')) {
        return;
      }
      if (timer !== null) {
        clearTimeout(timer);
      }
      timer = setTimeout(rerun, 100);
    },
  );
  const close = (): void => {
    watcher.close();
    process.exit(0);
  };
  process.once('SIGINT', close);
  process.once('SIGTERM', close);
  await new Promise<void>(() => undefined);
}

try {
  await run(await parseArguments(process.argv.slice(2)));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
