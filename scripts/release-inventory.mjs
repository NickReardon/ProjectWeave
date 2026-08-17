import { readdir } from 'node:fs/promises';

export const PLUGIN_RUNTIME_FILES = Object.freeze([
  'main.js',
  'manifest.json',
  'styles.css',
]);

export const COMPANION_RUNTIME_FILES = Object.freeze(['project-weave-mcp.cjs']);

const ALLOWED_PLUGIN_RUNTIME_MODULES = Object.freeze([
  'obsidian',
  'node:fs/promises',
  'node:net',
]);

export async function verifyDirectoryInventory({ directory, expected, label }) {
  const actual = (await readdir(directory)).sort();
  assertExactInventory({ actual, expected, label });
  return actual;
}

export function assertExactInventory({ actual, expected, label }) {
  const normalizedActual = [...actual].sort();
  const normalizedExpected = [...expected].sort();
  if (JSON.stringify(normalizedActual) === JSON.stringify(normalizedExpected)) {
    return;
  }

  const actualSet = new Set(normalizedActual);
  const expectedSet = new Set(normalizedExpected);
  const missing = normalizedExpected.filter((file) => !actualSet.has(file));
  const extra = normalizedActual.filter((file) => !expectedSet.has(file));
  const details = [
    missing.length === 0 ? null : `missing ${missing.join(', ')}`,
    extra.length === 0 ? null : `unexpected ${extra.join(', ')}`,
  ].filter(Boolean);
  throw new Error(`${label} inventory mismatch: ${details.join('; ')}.`);
}

export function verifyPluginRuntimeImports(bundle) {
  const requiredModules = [
    ...bundle.matchAll(/require\((['"])([^'"]+)\1\)/gu),
  ].flatMap((match) => (match[2] === undefined ? [] : [match[2]]));
  const dynamicNodeModules = [
    ...bundle.matchAll(/\bimport\((['"])(node:[^'"]+)\1\)/gu),
  ].flatMap((match) => (match[2] === undefined ? [] : [match[2]]));
  if (dynamicNodeModules.length > 0) {
    throw new Error(
      `Release bundle contains unsupported dynamic Node imports: ${[
        ...new Set(dynamicNodeModules),
      ]
        .sort()
        .join(', ')}.`,
    );
  }
  const unexpectedModules = [
    ...new Set(
      requiredModules.filter(
        (moduleName) =>
          !ALLOWED_PLUGIN_RUNTIME_MODULES.includes(moduleName) &&
          !moduleName.startsWith('@codemirror/') &&
          !moduleName.startsWith('@lezer/'),
      ),
    ),
  ].sort();
  if (unexpectedModules.length > 0) {
    throw new Error(
      `Release bundle contains unsupported runtime imports: ${unexpectedModules.join(', ')}.`,
    );
  }
  return [...new Set(requiredModules)].sort();
}
