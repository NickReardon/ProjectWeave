import { readFile, readdir } from 'node:fs/promises';

const expected = ['main.js', 'manifest.json', 'styles.css'];
const actual = (await readdir('dist')).sort();

if (JSON.stringify(actual) !== JSON.stringify(expected)) {
  throw new Error(
    `Release inventory mismatch. Expected ${expected.join(', ')}; received ${actual.join(', ') || '(empty)'}.`,
  );
}

const bundle = await readFile('dist/main.js', 'utf8');
const requiredModules = [
  ...bundle.matchAll(/require\((['"])([^'"]+)\1\)/gu),
].flatMap((match) => (match[2] === undefined ? [] : [match[2]]));
const unexpectedModules = [
  ...new Set(
    requiredModules.filter(
      (moduleName) =>
        moduleName !== 'obsidian' &&
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

if (bundle.includes('sourceMappingURL')) {
  throw new Error('Production release bundle must not contain a source map.');
}

console.log(`Release inventory verified: ${actual.join(', ')}`);
console.log(
  `Runtime imports verified: ${[...new Set(requiredModules)].sort().join(', ')}`,
);
