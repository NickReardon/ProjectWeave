import { readdir, readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';

export const ROOT_CONTEXT_LINE_BUDGET = 70;
export const GENERATED_CONTEXT = '@AGENTS.md\n';

const SKIP_DIRECTORIES = new Set([
  '.claude',
  '.git',
  '.obsidian',
  '.project-weave-test-vault',
  'coverage',
  'dist',
  'export',
  'node_modules',
  'test-vault',
]);

export function countLines(text) {
  if (text.length === 0) return 0;
  const lines = text.split(/\r?\n/u);
  return lines.at(-1) === '' ? lines.length - 1 : lines.length;
}

export function parseSkillDescription(markdown) {
  const lines = markdown.split(/\r?\n/u);
  if (lines[0]?.trim() !== '---') return '';
  const end = lines.findIndex(
    (line, index) => index > 0 && line.trim() === '---',
  );
  if (end < 0) return '';

  for (let index = 1; index < end; index += 1) {
    const match = /^(\s*)description:\s*(.*)$/u.exec(lines[index] ?? '');
    if (match === null) continue;
    const indentation = match[1]?.length ?? 0;
    let value = (match[2] ?? '').trim();
    if (/^[|>][-+]?$/u.test(value)) {
      const parts = [];
      for (let next = index + 1; next < end; next += 1) {
        const line = lines[next] ?? '';
        const leading = /^\s*/u.exec(line)?.[0].length ?? 0;
        if (line.trim().length > 0 && leading <= indentation) break;
        if (line.trim().length > 0) parts.push(line.trim());
      }
      return parts.join(' ');
    }
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    return value;
  }
  return '';
}

export function extractWhereToLookPointers(markdown) {
  const section =
    /^## WHERE TO LOOK\s*$([\s\S]*?)(?=^## |(?![\s\S]))/mu.exec(
      markdown,
    )?.[1] ?? '';
  const pointers = new Set();
  for (const match of section.matchAll(/`([^`]+)`/gu)) {
    const candidate = (match[1] ?? '').trim();
    if (candidate.length === 0 || /\s/u.test(candidate)) continue;
    if (candidate.includes('/') || /\.(?:md|json|ya?ml)$/iu.test(candidate)) {
      pointers.add(candidate.replace(/\/$/u, ''));
    }
  }
  return [...pointers];
}

export async function findExactContextFiles(root) {
  const found = [];
  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRECTORIES.has(entry.name)) {
          await visit(join(directory, entry.name));
        }
      } else if (entry.isFile() && entry.name === 'AGENTS.md') {
        found.push(join(directory, entry.name));
      }
    }
  }
  await visit(root);
  return found.sort((left, right) => left.localeCompare(right));
}

export function globalSkillRoots(environment = process.env) {
  const userHome = environment.USERPROFILE ?? environment.HOME ?? homedir();
  const codexRoot = environment.CODEX_HOME ?? join(userHome, '.codex');
  return [
    join(userHome, '.agents', 'skills'),
    join(userHome, '.claude', 'skills'),
    join(codexRoot, 'skills'),
  ];
}

export async function skillDescriptionInventory(
  root,
  { recursive = false } = {},
) {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'EACCES') return [];
    throw error;
  }
  const inventory = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const directory = join(root, entry.name);
    const skillPath = join(directory, 'SKILL.md');
    if (await pathExists(skillPath)) {
      const description = parseSkillDescription(
        await readFile(skillPath, 'utf8'),
      );
      inventory.push({ name: entry.name, path: skillPath, description });
    }
    if (recursive) {
      for (const nested of await skillDescriptionInventory(directory, {
        recursive: true,
      })) {
        inventory.push({ ...nested, name: `${entry.name}/${nested.name}` });
      }
    }
  }
  return inventory.sort((left, right) => left.name.localeCompare(right.name));
}

export async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

export function displayPath(root, path) {
  const result = relative(root, path).replaceAll('\\', '/');
  return result.length === 0 ? '.' : result;
}

export function generatedContextPath(contextPath) {
  return join(dirname(contextPath), 'CLAUDE.md');
}

export function resolveRepositoryPath(root, pointer) {
  return resolve(root, pointer);
}
