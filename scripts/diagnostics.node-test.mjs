import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const repositoryRoot = resolve(import.meta.dirname, '..');
const diagnosticsScript = resolve(repositoryRoot, 'scripts/diagnostics.mjs');

test('diagnostics check fails on errors without changing ordinary scan behavior', async (t) => {
  const vault = await mkdtemp(join(tmpdir(), 'project-weave-diagnostics-'));
  t.after(async () => await rm(vault, { recursive: true, force: true }));

  const projectFolder = join(vault, 'Projects', 'Game');
  await mkdir(join(projectFolder, 'Tasks'), { recursive: true });
  await writeFile(
    join(projectFolder, 'Project.md'),
    '---\ntype: project\ntitle: Game\nstatus: active\n---\n',
    'utf8',
  );
  await writeFile(
    join(projectFolder, 'Tasks', 'Broken.md'),
    [
      '---',
      'type: task',
      'title: Broken',
      'project: "[[Projects/Game/Project]]"',
      'status: complete',
      '---',
      '',
    ].join('\n'),
    'utf8',
  );

  const scan = runDiagnostics(vault);
  assert.equal(scan.status, 0);
  assert.ok(JSON.parse(scan.stdout).counts.errors > 0);

  const check = runDiagnostics(vault, '--fail-on-errors');
  assert.equal(check.status, 1);
  assert.match(check.stderr, /Diagnostics check failed:/u);
});

function runDiagnostics(vault, ...arguments_) {
  return spawnSync(
    process.execPath,
    [diagnosticsScript, '--vault', vault, ...arguments_],
    {
      cwd: repositoryRoot,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
    },
  );
}
