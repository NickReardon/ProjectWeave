import assert from 'node:assert/strict';
import test from 'node:test';
import { assertDocLinks, findDocLinkViolations } from './verify-doc-links.mjs';

test('accepts a relative Markdown link that resolves', () => {
  const entries = [
    {
      path: 'docs/spec/task-management.md',
      source: 'see [Data model](data-model-and-index.md).',
    },
  ];
  const fileExists = (path) => path === 'docs/spec/data-model-and-index.md';
  assert.deepEqual(findDocLinkViolations(entries, { fileExists }), []);
});

test('rejects a relative Markdown link that does not resolve', () => {
  const entries = [
    {
      path: 'docs/spec/task-management.md',
      source: 'see [Data model](data-model-and-index.md).',
    },
  ];
  const violations = findDocLinkViolations(entries, {
    fileExists: () => false,
  });
  assert.equal(violations.length, 1);
  assert.equal(violations[0].path, 'docs/spec/task-management.md');
  assert.equal(violations[0].line, 1);
  assert.match(violations[0].message, /data-model-and-index\.md/u);
  assert.throws(
    () => assertDocLinks(entries, { fileExists: () => false }),
    /broken relative link/u,
  );
});

test('ignores URLs, mailto links, and anchor-only links', () => {
  const entries = [
    {
      path: 'docs/spec/task-management.md',
      source:
        '[web](https://example.com/x) [mail](mailto:a@example.com) [here](#heading)',
    },
  ];
  assert.deepEqual(
    findDocLinkViolations(entries, { fileExists: () => false }),
    [],
  );
});

test('resolves a link relative to the linking file directory and strips anchors', () => {
  const entries = [
    {
      path: 'docs/project-vault/Projects/Weave/Project.md',
      source: 'see [roadmap](Project.md#implementation-roadmap-v1)',
    },
  ];
  const fileExists = (path) =>
    path === 'docs/project-vault/Projects/Weave/Project.md';
  assert.deepEqual(findDocLinkViolations(entries, { fileExists }), []);
});

test('accepts a wikilink that resolves under the vault by suffix match', () => {
  const entries = [
    {
      path: 'docs/project-vault/Projects/Weave/Tasks/Some task.md',
      source: "project: '[[Projects/Weave/Project]]'\n",
    },
  ];
  const vaultNotePaths = ['Projects/Weave/Project.md'];
  assert.deepEqual(findDocLinkViolations(entries, { vaultNotePaths }), []);
});

test('rejects a broken vault wikilink', () => {
  const entries = [
    {
      path: 'docs/project-vault/Projects/Weave/Tasks/Some task.md',
      source: "project: '[[Epics/Epic-does-not-exist]]'\n",
    },
  ];
  const violations = findDocLinkViolations(entries, { vaultNotePaths: [] });
  assert.equal(violations.length, 1);
  assert.equal(violations[0].line, 1);
  assert.match(violations[0].message, /Epic-does-not-exist/u);
});

test('strips a wikilink alias and heading before resolving', () => {
  const entries = [
    {
      path: 'docs/project-vault/Projects/Weave/Tasks/Some task.md',
      source:
        '[[Projects/Weave/Project|the project]] and [[Projects/Weave/Project#Roadmap]]',
    },
  ];
  const vaultNotePaths = ['Projects/Weave/Project.md'];
  assert.deepEqual(findDocLinkViolations(entries, { vaultNotePaths }), []);
});

test('resolves an explicitly relative wikilink against the note directory', () => {
  const entries = [
    {
      path: 'docs/project-vault/Projects/Weave/Documents/Design/Some doc.md',
      source: 'split across [[../../Epics/Epic-example]]',
    },
  ];
  const fileExists = (path) =>
    path === 'docs/project-vault/Projects/Weave/Epics/Epic-example.md';
  assert.deepEqual(
    findDocLinkViolations(entries, { fileExists, vaultNotePaths: [] }),
    [],
  );
});

test('does not check wikilinks outside the project vault', () => {
  const entries = [
    {
      path: 'docs/spec/scheduling-and-milestones.md',
      source:
        'for example [[Tethered]] or [[Vertical Slice Definition#Travel]]',
    },
  ];
  assert.deepEqual(findDocLinkViolations(entries, { vaultNotePaths: [] }), []);
});

test('rejects a numeric specification filename', () => {
  const entries = [
    { path: 'docs/spec/09-task-management.md', source: '# Task Management' },
  ];
  const violations = findDocLinkViolations(entries);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].path, 'docs/spec/09-task-management.md');
  assert.match(violations[0].message, /numeric prefix/u);
});

test('accepts a subject-named specification filename', () => {
  const entries = [
    { path: 'docs/spec/task-management.md', source: '# Task Management' },
  ];
  assert.deepEqual(findDocLinkViolations(entries), []);
});

test('rejects a surviving Spec NN or Design NN citation outside the archive', () => {
  const entries = [
    {
      path: 'docs/decisions/0001-example.md',
      source: 'See Spec 09 for the old rule, or Design 16 before that.',
    },
  ];
  const violations = findDocLinkViolations(entries);
  assert.equal(violations.length, 2);
  assert.match(violations[0].message, /Spec 09/u);
  assert.match(violations[1].message, /Design 16/u);
});

test('does not flag a quoted historical citation naming the retired style', () => {
  const entries = [
    {
      path: 'docs/decisions/0025-name-specifications-by-subject.md',
      source: 'a reader resolves it: "Spec 15" names no subject.',
    },
  ];
  assert.deepEqual(findDocLinkViolations(entries), []);
});

test('ignores an archived file entirely, as both a link and citation source', () => {
  const entries = [
    {
      path: 'docs/archive/PLAN.md',
      source:
        'broken link [gone](nowhere.md), [[Nonexistent]], and Spec 09 lives here.',
    },
  ];
  assert.deepEqual(
    findDocLinkViolations(entries, {
      fileExists: () => false,
      vaultNotePaths: [],
    }),
    [],
  );
});

test('assertDocLinks joins violations as path:line: message lines', () => {
  const entries = [
    {
      path: 'docs/spec/task-management.md',
      source: '[gone](nowhere.md)',
    },
  ];
  assert.throws(
    () => assertDocLinks(entries, { fileExists: () => false }),
    /- docs\/spec\/task-management\.md:1: broken relative link/u,
  );
});
