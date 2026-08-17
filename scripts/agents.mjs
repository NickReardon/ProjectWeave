import {
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';

import {
  countLines,
  displayPath,
  extractWhereToLookPointers,
  findExactContextFiles,
  GENERATED_CONTEXT,
  generatedContextPath,
  globalSkillRoots,
  pathExists,
  resolveRepositoryPath,
  ROOT_CONTEXT_LINE_BUDGET,
  skillDescriptionInventory,
} from './agent-context.mjs';

const root = resolve(import.meta.dirname, '..');
process.chdir(root);

const tasks = new Map([
  ['setup', taskSetup],
  ['dev', () => npmScript('dev')],
  ['build', taskBuild],
  ['test', taskTest],
  ['test:watch', () => npmScript('test:watch')],
  ['lint', taskLint],
  ['format', taskFormat],
  ['format:check', () => npmScript('format:check')],
  ['typecheck', () => npmScript('typecheck')],
  ['check', taskCheck],
  ['link', taskLink],
  ['doctor', taskDoctor],
  ['diagnostics', (args) => npmScriptWithArgs('diagnostics', args)],
  ['diagnostics:check', () => npmScript('diagnostics:check')],
  ['current-work:check', () => npmScript('current-work:check')],
  ['current-work:merge-ready', () => npmScript('current-work:merge-ready')],
  ['docs:check', () => npmScript('docs:check')],
  ['docs:links', () => npmScript('docs:links')],
  ['export', (args) => npmScriptWithArgs('export', args)],
  ['release', () => npmScript('release')],
  ['version:show', () => npmScript('version:show')],
  ['version:check', () => npmScript('version:check')],
  ['version:patch', () => npmScript('version:patch')],
  ['version:minor', () => npmScript('version:minor')],
  ['version:major', () => npmScript('version:major')],
  ['version:set', (args) => npmScriptWithArgs('version:set', args)],
  ['test-vault:create', (args) => npmScriptWithArgs('test-vault:create', args)],
  ['test-vault:reset', (args) => npmScriptWithArgs('test-vault:reset', args)],
  ['test-vault:setup', (args) => npmScriptWithArgs('test-vault:setup', args)],
  ['test-vault:update', (args) => npmScriptWithArgs('test-vault:update', args)],
  ['project-vault:install', () => npmScript('project-vault:install')],
  ['plugin:update', (args) => npmScriptWithArgs('plugin:update', args)],
  ['verify:release', () => npmScript('verify:release')],
]);

function run(command, args, displayCommand = command, displayArgs = args) {
  console.log(`--- ${displayCommand} ${displayArgs.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
  });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function runNpm(args) {
  const npmCli = join(
    dirname(process.execPath),
    'node_modules',
    'npm',
    'bin',
    'npm-cli.js',
  );
  if (existsSync(npmCli)) {
    run(process.execPath, [npmCli, ...args], 'npm', args);
  } else {
    run('npm', args);
  }
}

function npmScript(name, ...args) {
  runNpm(['run', name, ...args]);
}

function npmScriptWithArgs(name, args) {
  npmScript(name, ...(args.length > 0 ? ['--', ...args] : []));
}

function taskSetup() {
  runNpm(['ci']);
}

function taskBuild() {
  npmScript('build');
}

function taskTest() {
  npmScript('test');
}

function taskLint() {
  npmScript('format:check');
  npmScript('lint');
  npmScript('typecheck');
}

function taskFormat() {
  npmScript('format');
}

async function taskCheck(args = []) {
  await taskLink();
  await taskDoctor();
  for (const script of [
    'version:check',
    args.includes('--merge-ready')
      ? 'current-work:merge-ready'
      : 'current-work:check',
    'docs:check',
    'docs:links',
    'format:check',
    'lint',
    'typecheck',
    'test',
    'diagnostics:check',
    'build',
    'verify:release',
  ]) {
    npmScript(script);
  }
}

async function taskLink() {
  const contexts = await findExactContextFiles(root);
  for (const context of contexts) {
    const target = generatedContextPath(context);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, GENERATED_CONTEXT, 'utf8');
    console.log(`generated ${displayPath(root, target)}`);
  }

  const generatedSkills = resolve(root, '.claude', 'skills');
  await rm(generatedSkills, { recursive: true, force: true });
  const projectSkills = await skillDescriptionInventory(
    resolve(root, '.agents', 'skills'),
  );
  for (const skill of projectSkills) {
    const source = dirname(skill.path);
    const target = resolve(generatedSkills, skill.name);
    await mkdir(dirname(target), { recursive: true });
    await symlink(
      source,
      target,
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    if (!(await lstat(target)).isSymbolicLink()) {
      throw new Error(`Generated skill path is not a link: ${target}`);
    }
    console.log(`linked .claude/skills/${skill.name}`);
  }
}

async function taskDoctor() {
  let problems = 0;
  const rootContextPath = resolve(root, 'AGENTS.md');
  let rootContext = '';
  let rootContextMissing = false;
  try {
    rootContext = await readFile(rootContextPath, 'utf8');
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    rootContextMissing = true;
  }
  const lines = countLines(rootContext);

  console.log('context load — paid on every request');
  if (rootContextMissing) {
    console.log('  AGENTS.md      MISSING');
    problems += 1;
  } else if (lines > ROOT_CONTEXT_LINE_BUDGET) {
    console.log(
      `  AGENTS.md      ${String(lines)} lines   OVER the ${String(ROOT_CONTEXT_LINE_BUDGET)}-line budget`,
    );
    problems += 1;
  } else {
    console.log(
      `  AGENTS.md      ${String(lines)} lines   (budget ${String(ROOT_CONTEXT_LINE_BUDGET)})`,
    );
  }

  const projectSkills = await skillDescriptionInventory(
    resolve(root, '.agents', 'skills'),
  );
  const projectCost = projectSkills.reduce(
    (total, skill) => total + skill.description.length,
    0,
  );
  console.log(
    `  skills         ${String(projectSkills.length)} enabled, ~${String(projectCost)} description chars`,
  );

  console.log('\npointers — root WHERE TO LOOK');
  const pointers = extractWhereToLookPointers(rootContext);
  let deadPointers = 0;
  for (const pointer of pointers) {
    if (!(await pathExists(resolveRepositoryPath(root, pointer)))) {
      console.log(`  dead pointer   ${pointer}`);
      deadPointers += 1;
    }
  }
  if (deadPointers === 0)
    console.log(`  all ${String(pointers.length)} resolve`);
  problems += deadPointers;

  console.log('\ngenerated context');
  let staleGenerated = 0;
  for (const context of await findExactContextFiles(root)) {
    const target = generatedContextPath(context);
    let actual = null;
    try {
      actual = await readFile(target, 'utf8');
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
    if (actual !== GENERATED_CONTEXT) {
      console.log(`  stale or missing   ${displayPath(root, target)}`);
      staleGenerated += 1;
    }
  }
  if (staleGenerated === 0) console.log('  all projections are current');
  problems += staleGenerated;

  console.log('\ngenerated skill discovery');
  const generatedSkills = resolve(root, '.claude', 'skills');
  const expectedSkills = new Set(projectSkills.map((skill) => skill.name));
  let staleSkills = 0;
  for (const skill of projectSkills) {
    const target = resolve(generatedSkills, skill.name);
    if (!(await linkTargets(target, dirname(skill.path)))) {
      console.log(`  stale or missing   .claude/skills/${skill.name}`);
      staleSkills += 1;
    }
  }
  let generatedEntries = [];
  try {
    generatedEntries = await readdir(generatedSkills);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  for (const entry of generatedEntries) {
    if (!expectedSkills.has(entry)) {
      console.log(`  stale generated    .claude/skills/${entry}`);
      staleSkills += 1;
    }
  }
  if (staleSkills === 0) console.log('  all project skills are current');
  problems += staleSkills;

  console.log('\nglobal skills — informational machine-wide cost');
  const seen = new Set();
  let globalCount = 0;
  let globalCost = 0;
  for (const skillRoot of globalSkillRoots()) {
    for (const skill of await skillDescriptionInventory(skillRoot, {
      recursive: true,
    })) {
      const key = `${skill.name}\u0000${skill.description}`;
      if (seen.has(key)) continue;
      seen.add(key);
      globalCount += 1;
      globalCost += skill.description.length;
    }
  }
  console.log(
    `  ${String(globalCount)} discovered, ~${String(globalCost)} description chars`,
  );

  console.log('');
  if (problems > 0) {
    console.error(`${String(problems)} project context problem(s) found`);
    process.exit(1);
  }
  console.log('no project context problems found');
}

async function linkTargets(target, source) {
  try {
    if (!(await lstat(target)).isSymbolicLink()) return false;
    const [actual, expected] = await Promise.all([
      realpath(target),
      realpath(source),
    ]);
    return process.platform === 'win32'
      ? actual.toLowerCase() === expected.toLowerCase()
      : actual === expected;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

function usage() {
  console.log(
    `usage: ./agents <task> [args]\n\ncore:\n  setup                 install locked dependencies\n  dev                   watch and rebuild the development plugin\n  build                 build the production plugin\n  test | test:watch     run Vitest and Node tests\n  lint                  check formatting, ESLint, and TypeScript\n  format                apply repository formatting\n  check [--merge-ready] regenerate context and run the complete CI gate\n\nproject operations:\n  diagnostics [args]    scan a configured vault\n  diagnostics:check     scan the committed dogfood vault\n  export [args]         build verified installable artifacts\n  release               run the gate and export artifacts\n  project-vault:install build into the dogfood vault\n  plugin:update         install a pinned GitHub release into PROJECT_WEAVE_PLUGIN_PATH\n  test-vault:create     create a disposable test vault\n  test-vault:reset      reset the disposable test vault\n  test-vault:setup      seed and install into the test vault\n  test-vault:update     update its installed plugin\n  version:show          print the synchronized version\n  version:patch|minor|major\n  version:set VERSION\n\nfocused checks:\n  format:check | typecheck | current-work:check | current-work:merge-ready\n  docs:check | docs:links | version:check | verify:release\n\nagent context:\n  link                  regenerate tool-specific context files\n  doctor                audit context cost, pointers, and generated files`,
  );
}

const [requested = 'help', ...argumentsProvided] = process.argv.slice(2);
if (requested === 'help' || requested === '-h' || requested === '--help') {
  usage();
} else {
  const task = tasks.get(requested);
  if (task === undefined) {
    console.error(`agents: unknown task '${requested}'\n`);
    usage();
    process.exit(64);
  }
  await task(argumentsProvided);
}
