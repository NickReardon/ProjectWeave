import assert from 'node:assert/strict';
import test from 'node:test';
import { assertDocLinks, findDocLinkViolations } from './verify-doc-links.mjs';

test('accepts a relative Markdown link that resolves', () => {
  const entries = [
    {
      path: 'docs/project-vault/Projects/Weave/Documents/Specifications/task-management.md',
      source: 'see [Data model](data-model-and-index.md).',
    },
  ];
  const fileExists = (path) =>
    path ===
    'docs/project-vault/Projects/Weave/Documents/Specifications/data-model-and-index.md';
  assert.deepEqual(findDocLinkViolations(entries, { fileExists }), []);
});

test('rejects a relative Markdown link that does not resolve', () => {
  const entries = [
    {
      path: 'docs/project-vault/Projects/Weave/Documents/Specifications/task-management.md',
      source: 'see [Data model](data-model-and-index.md).',
    },
  ];
  const violations = findDocLinkViolations(entries, {
    fileExists: () => false,
  });
  assert.equal(violations.length, 1);
  assert.equal(
    violations[0].path,
    'docs/project-vault/Projects/Weave/Documents/Specifications/task-management.md',
  );
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
      path: 'docs/project-vault/Projects/Weave/Documents/Specifications/task-management.md',
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
      path: 'docs/ARCHITECTURE.md',
      source:
        'for example [[Tethered]] or [[Vertical Slice Definition#Travel]]',
    },
  ];
  assert.deepEqual(findDocLinkViolations(entries, { vaultNotePaths: [] }), []);
});

test('resolves a wikilink from one vault note to a specification', () => {
  const entries = [
    {
      path: 'docs/project-vault/Projects/Weave/Tasks/Some task.md',
      source: 'implements [[Documents/Specifications/product-brief]]',
    },
  ];
  const vaultNotePaths = [
    'Projects/Weave/Documents/Specifications/product-brief.md',
  ];
  assert.deepEqual(findDocLinkViolations(entries, { vaultNotePaths }), []);
});

test('resolves a wikilink from a specification to a decision record', () => {
  const entries = [
    {
      path: 'docs/project-vault/Projects/Weave/Documents/Specifications/product-brief.md',
      source:
        'decided in [[Documents/Decisions/0029-hold-every-project-document-in-the-vault|ADR 0029]]',
    },
  ];
  const vaultNotePaths = [
    'Projects/Weave/Documents/Decisions/0029-hold-every-project-document-in-the-vault.md',
  ];
  assert.deepEqual(findDocLinkViolations(entries, { vaultNotePaths }), []);
});

test('does not read a wikilink inside a fenced code block as a link', () => {
  const entries = [
    {
      path: 'docs/project-vault/Projects/Weave/Documents/Specifications/scheduling-and-milestones.md',
      source: [
        'A milestone note looks like this:',
        '',
        '```yaml',
        'type: milestone',
        'project: "[[Tethered]]"',
        'origin: "[[Vertical Slice Definition#Travel]]"',
        '```',
        '',
        'Required fields are type, project, and status.',
      ].join('\n'),
    },
  ];
  assert.deepEqual(findDocLinkViolations(entries, { vaultNotePaths: [] }), []);
});

test('does not read a wikilink inside an inline code span as a link', () => {
  const entries = [
    {
      path: 'docs/project-vault/Projects/Weave/Documents/References/testing.md',
      source:
        "Create a task whose project points nowhere, for example\n`project: '[[Nonexistent]]'`.\n",
    },
  ];
  assert.deepEqual(findDocLinkViolations(entries, { vaultNotePaths: [] }), []);
});

test('still reports a broken wikilink on an ordinary prose line', () => {
  const entries = [
    {
      path: 'docs/project-vault/Projects/Weave/Tasks/Some task.md',
      source:
        '```yaml\nproject: "[[Example]]"\n```\n\nowned by [[Epics/Epic-does-not-exist]]\n',
    },
  ];
  const violations = findDocLinkViolations(entries, { vaultNotePaths: [] });
  assert.equal(violations.length, 1);
  assert.equal(violations[0].line, 5);
  assert.match(violations[0].message, /Epic-does-not-exist/u);
});

test('still reports a broken wikilink beside an unrelated code span', () => {
  const entries = [
    {
      path: 'docs/project-vault/Projects/Weave/Tasks/Some task.md',
      source: 'set `status: doing` on [[Epics/Epic-does-not-exist]]\n',
    },
  ];
  const violations = findDocLinkViolations(entries, { vaultNotePaths: [] });
  assert.equal(violations.length, 1);
  assert.match(violations[0].message, /Epic-does-not-exist/u);
});

test('treats a tilde fence and a longer backtick run as code too', () => {
  const entries = [
    {
      path: 'docs/project-vault/Projects/Weave/Documents/Specifications/sprints.md',
      source: [
        '~~~yaml',
        'sprint: "[[Vertical Slice Sprint 1]]"',
        '~~~',
        '',
        '````markdown',
        'project: "[[Tethered]]"',
        '```',
        'still inside the outer fence: [[Also Fictional]]',
        '````',
      ].join('\n'),
    },
  ];
  assert.deepEqual(findDocLinkViolations(entries, { vaultNotePaths: [] }), []);
});

test('resumes checking wikilinks after a fence closes', () => {
  const entries = [
    {
      path: 'docs/project-vault/Projects/Weave/Documents/Specifications/sprints.md',
      source:
        '```yaml\nsprint: "[[Example Sprint]]"\n```\n\nsee [[Documents/Specifications/gone]]\n',
    },
  ];
  const violations = findDocLinkViolations(entries, { vaultNotePaths: [] });
  assert.equal(violations.length, 1);
  assert.equal(violations[0].line, 5);
  assert.match(violations[0].message, /Documents\/Specifications\/gone/u);
});

test('does not let an unclosed fence silence the next document', () => {
  const entries = [
    {
      path: 'docs/project-vault/Projects/Weave/Documents/Specifications/one.md',
      source: '```yaml\nproject: "[[Tethered]]"\n',
    },
    {
      path: 'docs/project-vault/Projects/Weave/Documents/Specifications/two.md',
      source: 'see [[Epics/Epic-does-not-exist]]\n',
    },
  ];
  const violations = findDocLinkViolations(entries, { vaultNotePaths: [] });
  assert.ok(
    violations.some(
      ({ path, message }) =>
        path ===
          'docs/project-vault/Projects/Weave/Documents/Specifications/two.md' &&
        message.includes('broken wikilink'),
    ),
  );
});

test('reports an unclosed fence rather than going quiet below it', () => {
  const entries = [
    {
      path: 'docs/project-vault/Projects/Weave/Documents/Specifications/one.md',
      source: '```yaml\nproject: "[[Tethered]]"\n',
    },
  ];
  const violations = findDocLinkViolations(entries, { vaultNotePaths: [] });
  assert.equal(violations.length, 1);
  assert.match(violations[0].message, /unclosed code fence/u);
  assert.equal(violations[0].line, 1);
});

test('does not report an unclosed fence when the fence closes', () => {
  const entries = [
    {
      path: 'docs/project-vault/Projects/Weave/Documents/Specifications/one.md',
      source: '```yaml\nproject: "[[Tethered]]"\n```\n',
    },
  ];
  const violations = findDocLinkViolations(entries, { vaultNotePaths: [] });
  assert.deepEqual(violations, []);
});

test('still checks a wikilink in real frontmatter, which is not a code fence', () => {
  const entries = [
    {
      path: 'docs/project-vault/Projects/Weave/Tasks/Some task.md',
      source:
        '---\ntype: task\nproject: "[[Projects/Weave/Project]]"\n---\n\n# Some task\n',
    },
  ];
  const violations = findDocLinkViolations(entries, { vaultNotePaths: [] });
  assert.equal(violations.length, 1);
  assert.equal(violations[0].line, 3);
  assert.match(violations[0].message, /Projects\/Weave\/Project/u);
});

test('still checks Markdown links and numbered citations inside a fence', () => {
  const entries = [
    {
      path: 'docs/project-vault/Projects/Weave/Documents/Specifications/product-brief.md',
      source: '```markdown\n[gone](nowhere.md) and Spec 09\n```\n',
    },
  ];
  const violations = findDocLinkViolations(entries, {
    fileExists: () => false,
    vaultNotePaths: [],
  });
  assert.equal(violations.length, 2);
  assert.match(violations[0].message, /broken relative link/u);
  assert.match(violations[1].message, /Spec 09/u);
});

test('rejects a numeric specification filename', () => {
  const entries = [
    {
      path: 'docs/project-vault/Projects/Weave/Documents/Specifications/09-task-management.md',
      source: '# Task Management',
    },
  ];
  const violations = findDocLinkViolations(entries);
  assert.equal(violations.length, 1);
  assert.equal(
    violations[0].path,
    'docs/project-vault/Projects/Weave/Documents/Specifications/09-task-management.md',
  );
  assert.match(violations[0].message, /numeric prefix/u);
});

test('accepts a subject-named specification filename', () => {
  const entries = [
    {
      path: 'docs/project-vault/Projects/Weave/Documents/Specifications/task-management.md',
      source: '# Task Management',
    },
  ];
  assert.deepEqual(findDocLinkViolations(entries), []);
});

test('rejects a surviving Spec NN or Design NN citation outside the archive', () => {
  const entries = [
    {
      path: 'docs/project-vault/Projects/Weave/Documents/Decisions/0001-example.md',
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
      path: 'docs/project-vault/Projects/Weave/Documents/Decisions/0025-name-specifications-by-subject.md',
      source: 'a reader resolves it: "Spec 15" names no subject.',
    },
  ];
  assert.deepEqual(findDocLinkViolations(entries), []);
});

test('ignores an archived vault note entirely, as link, wikilink, and citation source', () => {
  const entries = [
    {
      path: 'docs/project-vault/Projects/Weave/Archive/Legacy/PLAN.md',
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
      path: 'docs/project-vault/Projects/Weave/Documents/Specifications/task-management.md',
      source: '[gone](nowhere.md)',
    },
  ];
  assert.throws(
    () => assertDocLinks(entries, { fileExists: () => false }),
    /- docs\/project-vault\/Projects\/Weave\/Documents\/Specifications\/task-management\.md:1: broken relative link/u,
  );
});

const decision = (id, body = '') =>
  `---\ntype: decision\nid: "${id}"\nstatus: accepted\n---\n\n# ADR ${id}: A decision\n${body}`;

test('rejects a new duplicate decision record id', () => {
  const entries = [
    {
      path: 'docs/project-vault/Projects/Weave/Documents/Decisions/0031-one-thing.md',
      source: decision('0031'),
    },
    {
      path: 'docs/project-vault/Projects/Weave/Documents/Decisions/0031-another-thing.md',
      source: decision('0031'),
    },
  ];
  const violations = findDocLinkViolations(entries);
  assert.equal(violations.length, 2);
  assert.match(violations[0].message, /duplicate decision record id 0031/u);
  assert.match(violations[0].message, /0031-one-thing\.md/u);
  assert.throws(
    () => assertDocLinks(entries),
    /duplicate decision record id 0031/u,
  );
});

test('rejects the historical 0025 pair too: uniqueness has no exceptions', () => {
  const entries = [
    {
      path: 'docs/project-vault/Projects/Weave/Documents/Decisions/0025-merge-ready-current-work-and-evergreen-release-docs.md',
      source: decision('0025'),
    },
    {
      path: 'docs/project-vault/Projects/Weave/Documents/Decisions/0025-name-specifications-by-subject.md',
      source: decision('0025'),
    },
  ];
  const violations = findDocLinkViolations(entries);
  assert.equal(violations.length, 2);
  assert.match(violations[0].message, /duplicate decision record id 0025/u);
});

test('rejects a decision record that declares no id', () => {
  const entries = [
    {
      path: 'docs/project-vault/Projects/Weave/Documents/Decisions/0031-one-thing.md',
      source:
        '---\ntype: decision\nstatus: accepted\n---\n\n# ADR 0031: A decision\n',
    },
  ];
  const violations = findDocLinkViolations(entries);
  assert.equal(violations.length, 1);
  assert.match(violations[0].message, /declares no frontmatter id/u);
});

test('rejects a filename number that disagrees with the declared id', () => {
  const entries = [
    {
      path: 'docs/project-vault/Projects/Weave/Documents/Decisions/0032-one-thing.md',
      source: decision('0031'),
    },
  ];
  const violations = findDocLinkViolations(entries);
  assert.equal(violations.length, 1);
  assert.match(
    violations[0].message,
    /filename number 0032 disagrees with its declared id 0031/u,
  );
});

test('rejects a heading that disagrees with the declared id', () => {
  const entries = [
    {
      path: 'docs/project-vault/Projects/Weave/Documents/Decisions/0031-one-thing.md',
      source:
        '---\ntype: decision\nid: "0031"\n---\n\n# ADR 0030: A decision\n',
    },
  ];
  const violations = findDocLinkViolations(entries);
  assert.equal(violations.length, 1);
  assert.match(
    violations[0].message,
    /heading ADR 0030 disagrees with its declared id 0031/u,
  );
});

test('exempts the packaged decision template, which has no identity', () => {
  const entries = [
    {
      path: 'docs/project-vault/Projects/Weave/Documents/Decisions/0000-template.md',
      source:
        '---\ntype: decision-template\nstatus: template\n---\n\n# ADR 0000: Decision title\n',
    },
  ];
  assert.deepEqual(findDocLinkViolations(entries), []);
});

test('recognizes a record by frontmatter wherever it lives', () => {
  const entries = [
    {
      path: 'docs/project-vault/Documents/Decisions/One thing.md',
      source: decision('0031'),
    },
    {
      path: 'docs/project-vault/Documents/Decisions/Another thing.md',
      source: decision('0031'),
    },
  ];
  const violations = findDocLinkViolations(entries, { vaultNotePaths: [] });
  assert.equal(violations.length, 2);
  assert.match(violations[0].message, /duplicate decision record id 0031/u);
});

test('does not read a note of another type as a decision record', () => {
  const entries = [
    {
      path: 'docs/project-vault/Projects/Weave/Tasks/One.md',
      source: '---\ntype: task\nid: "0025"\n---\n\n# One\n',
    },
    {
      path: 'docs/project-vault/Projects/Weave/Tasks/Two.md',
      source: '---\ntype: task\nid: "0025"\n---\n\n# Two\n',
    },
  ];
  assert.deepEqual(findDocLinkViolations(entries, { vaultNotePaths: [] }), []);
});

test('ignores duplicate decision ids under the archive', () => {
  const entries = [
    {
      path: 'docs/project-vault/Projects/Weave/Archive/Legacy/0031-one.md',
      source: decision('0031'),
    },
    {
      path: 'docs/project-vault/Projects/Weave/Archive/Legacy/0031-two.md',
      source: decision('0031'),
    },
  ];
  assert.deepEqual(findDocLinkViolations(entries), []);
});
