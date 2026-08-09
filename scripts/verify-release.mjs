import { readFile, readdir } from 'node:fs/promises';

const expected = [
  'main.js',
  'manifest.json',
  'project-weave-mcp.cjs',
  'styles.css',
];
const actual = (await readdir('dist')).sort();

if (JSON.stringify(actual) !== JSON.stringify(expected)) {
  throw new Error(
    `Release inventory mismatch. Expected ${expected.join(', ')}; received ${actual.join(', ') || '(empty)'}.`,
  );
}

const bundle = await readFile('dist/main.js', 'utf8');
const companion = await readFile('dist/project-weave-mcp.cjs', 'utf8');
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
if (companion.includes('sourceMappingURL')) {
  throw new Error('Production companion bundle must not contain a source map.');
}
for (const forbidden of [
  'weave_propose_',
  'weave_proposal_commit',
  'NoteWriter',
]) {
  if (companion.includes(forbidden)) {
    throw new Error(
      `Read-only companion contains forbidden write surface: ${forbidden}.`,
    );
  }
}
for (const tool of [
  'weave_projects_list',
  'weave_project_context',
  'weave_search',
  'weave_read_note',
  'weave_related_work',
  'weave_focus',
  'weave_sequence',
  'weave_action_context',
  'weave_creation_context',
  'weave_diagnostics',
]) {
  if (!companion.includes(tool)) {
    throw new Error(`Read-only companion is missing tool: ${tool}.`);
  }
}
if (!companion.includes('2025-06-18')) {
  throw new Error('MCP companion does not carry protocol 2025-06-18 support.');
}

console.log(`Release inventory verified: ${actual.join(', ')}`);
console.log(
  `Runtime imports verified: ${[...new Set(requiredModules)].sort().join(', ')}`,
);
