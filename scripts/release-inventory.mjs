import { readdir } from 'node:fs/promises';

export const PLUGIN_RUNTIME_FILES = Object.freeze([
  'main.js',
  'manifest.json',
  'styles.css',
]);

export const COMPANION_RUNTIME_FILES = Object.freeze(['project-weave-mcp.cjs']);

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
