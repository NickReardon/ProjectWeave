import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import test from 'node:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  countLines,
  extractWhereToLookPointers,
  parseSkillDescription,
  skillDescriptionInventory,
} from './agent-context.mjs';

test('counts logical lines with or without a trailing newline', () => {
  assert.equal(countLines('one\ntwo\n'), 2);
  assert.equal(countLines('one\ntwo'), 2);
  assert.equal(countLines(''), 0);
});

test('reads scalar and quoted skill descriptions', () => {
  assert.equal(
    parseSkillDescription(
      '---\nname: sample\ndescription: Use for sample work.\n---\n',
    ),
    'Use for sample work.',
  );
  assert.equal(
    parseSkillDescription(
      "---\ndescription: 'Use when asked to quote.'\n---\n",
    ),
    'Use when asked to quote.',
  );
});

test('counts YAML block-scalar descriptions in full', () => {
  assert.equal(
    parseSkillDescription(
      '---\nname: sample\ndescription: |\n  Use when a migration\n  must be reversed.\n---\n',
    ),
    'Use when a migration must be reversed.',
  );
  assert.equal(
    parseSkillDescription(
      '---\ndescription: >-\n  Use when working\n  with release assets.\n---\n',
    ),
    'Use when working with release assets.',
  );
});

test('extracts path-shaped pointers only from WHERE TO LOOK', () => {
  const markdown = `# Guide\n\n## WHERE TO LOOK\n\n| Need | Location |\n| --- | --- |\n| Docs | \`docs/README.md\` |\n| Specs | \`docs/project-vault/Projects/Weave/Documents/Specifications/\` |\n| Log | \`git log --oneline -20\` |\n\n## COMMANDS\n\n\`missing.md\`\n`;
  assert.deepEqual(extractWhereToLookPointers(markdown), [
    'docs/README.md',
    'docs/project-vault/Projects/Weave/Documents/Specifications',
  ]);
});

test('finds nested global skill descriptions when requested', async () => {
  const root = await mkdtemp(join(tmpdir(), 'project-weave-agent-context-'));
  try {
    const skill = join(root, '.system', 'sample');
    await mkdir(skill, { recursive: true });
    await writeFile(
      join(skill, 'SKILL.md'),
      '---\ndescription: Use for nested skill checks.\n---\n',
      'utf8',
    );
    const inventory = await skillDescriptionInventory(root, {
      recursive: true,
    });
    assert.deepEqual(
      inventory.map(({ name, description }) => ({ name, description })),
      [
        {
          name: '.system/sample',
          description: 'Use for nested skill checks.',
        },
      ],
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
