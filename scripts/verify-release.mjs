import { readFile } from 'node:fs/promises';

import {
  COMPANION_RUNTIME_FILES,
  PLUGIN_RUNTIME_FILES,
  verifyDirectoryInventory,
  verifyPluginRuntimeImports,
} from './release-inventory.mjs';

await verifyDirectoryInventory({
  directory: 'dist',
  expected: ['companion', 'plugin'],
  label: 'Build output',
});
const pluginInventory = await verifyDirectoryInventory({
  directory: 'dist/plugin',
  expected: PLUGIN_RUNTIME_FILES,
  label: 'Plugin',
});
const companionInventory = await verifyDirectoryInventory({
  directory: 'dist/companion',
  expected: COMPANION_RUNTIME_FILES,
  label: 'Companion',
});

const bundle = await readFile('dist/plugin/main.js', 'utf8');
const companion = await readFile(
  'dist/companion/project-weave-mcp.cjs',
  'utf8',
);
const requiredModules = verifyPluginRuntimeImports(bundle);

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

console.log(`Plugin inventory verified: ${pluginInventory.join(', ')}`);
console.log(`Companion inventory verified: ${companionInventory.join(', ')}`);
console.log(`Runtime imports verified: ${requiredModules.join(', ')}`);
