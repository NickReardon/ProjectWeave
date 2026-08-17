import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { after, before, test } from 'node:test';
import { join, resolve } from 'node:path';
import process from 'node:process';

import esbuild from 'esbuild';

// Protocol-level regression coverage for the three MCP companion
// diagnosability defects (see docs/project-vault/Projects/Weave/Tasks/):
// a stack trace on a missing env var, an inventory served without ever
// contacting the gateway, and raw errno text on a tool-call failure. Every
// test here drives the real built companion over stdio with fake
// credentials, exactly as it reproduces in the field -- no vault, no
// gateway, no published release.

const repositoryRoot = resolve(import.meta.dirname, '..');
const companionEntry = resolve(repositoryRoot, 'src/agent/mcp-companion.ts');

let companionBuildDirectory;
let companionPath;

before(async () => {
  companionBuildDirectory = await mkdtemp(
    join(tmpdir(), 'project-weave-mcp-companion-'),
  );
  companionPath = join(companionBuildDirectory, 'project-weave-mcp.cjs');
  await esbuild.build({
    bundle: true,
    define: { PROJECT_WEAVE_VERSION: '"0.0.0-test"' },
    entryPoints: [companionEntry],
    format: 'cjs',
    outfile: companionPath,
    platform: 'node',
    target: 'node22',
  });
});

after(async () => {
  if (companionBuildDirectory !== undefined) {
    await rm(companionBuildDirectory, { recursive: true, force: true });
  }
});

test('missing required env vars: one actionable line naming all of them, no stack trace, non-zero exit', async () => {
  const child = spawnCompanionWithEnv(
    withoutNames(process.env, [
      'PROJECT_WEAVE_ENDPOINT',
      'PROJECT_WEAVE_GRANT_ID',
      'PROJECT_WEAVE_GRANT_SECRET',
    ]),
  );
  child.stdin.end();

  const { stdout, stderr, exitCode } = await waitForExit(child);

  assert.notEqual(exitCode, 0);
  assert.equal(stdout, '', 'no MCP response is ever sent');
  const lines = stderr.trim().split(/\r?\n/u);
  assert.equal(
    lines.length,
    1,
    `expected exactly one stderr line, got: ${stderr}`,
  );
  assert.doesNotMatch(
    stderr,
    /\bat \S+ [/(]/u,
    'stderr must not contain a stack-trace frame',
  );
  assert.match(stderr, /PROJECT_WEAVE_ENDPOINT/u);
  assert.match(stderr, /PROJECT_WEAVE_GRANT_ID/u);
  assert.match(stderr, /PROJECT_WEAVE_GRANT_SECRET/u);
});

test('unreachable gateway: fails closed at connect time with actionable guidance, before serving any request', async () => {
  const endpoint = uniqueEndpoint(); // nothing is listening here
  const child = spawnCompanion(endpoint, 'grant_fake', 'fake-secret');
  send(child, initializeRequest(1));
  send(child, listToolsRequest(2));
  child.stdin.end();

  const { stdout, stderr, exitCode } = await waitForExit(child);

  assert.notEqual(exitCode, 0);
  assert.equal(
    stdout.trim(),
    '',
    'initialize/tools-list must never be answered against a dead gateway',
  );
  assert.match(stderr, /gateway/iu);
  assert.match(stderr, /(PROJECT_WEAVE_ENDPOINT|Agent Access|enable)/iu);
  assert.match(
    stderr,
    /(ENOENT|ECONNREFUSED)/u,
    'the underlying transport detail is preserved as secondary context',
  );
});

test('tool-call transport failure after a successful handshake: actionable guidance, not a raw errno', async () => {
  const endpoint = uniqueEndpoint();
  const server = net.createServer((socket) => {
    socket.setEncoding('utf8');
    let buffer = '';
    let handled = false;
    socket.on('data', (chunk) => {
      if (handled) return;
      buffer += chunk;
      const newline = buffer.indexOf('\n');
      if (newline < 0) return;
      const line = buffer.slice(0, newline).trim();
      if (line.length === 0) return;
      handled = true;
      const request = JSON.parse(line);
      // Answer the very first request (the companion's startup handshake)
      // successfully, then close the connection and stop listening so any
      // later request -- a real tool call -- hits a dead endpoint, the same
      // way a gateway that goes away mid-session would.
      socket.write(
        `${JSON.stringify({ requestId: request.requestId, ok: true, result: {} })}\n`,
        () => {
          socket.end();
          server.close();
        },
      );
    });
  });
  await new Promise((resolveListening, reject) => {
    server.once('error', reject);
    server.listen(endpoint, () => resolveListening(undefined));
  });

  const child = spawnCompanion(endpoint, 'grant_fake', 'fake-secret');
  try {
    const messages = readMessages(child);
    send(child, initializeRequest(1));
    const initializeResponse = await messages.next();
    assert.equal(initializeResponse.id, 1);
    send(child, { jsonrpc: '2.0', method: 'notifications/initialized' });

    // Give the companion's bridge socket time to observe the fake gateway's
    // close before the next call, so the tool call forces a genuine
    // reconnect attempt against the now-dead endpoint (rather than racing a
    // write onto the closing socket).
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 200));

    send(child, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'weave_diagnostics', arguments: {} },
    });
    const callResponse = await messages.next();

    assert.equal(callResponse.id, 2);
    assert.equal(callResponse.result.isError, true);
    const text = callResponse.result.content[0].text;
    assert.doesNotMatch(
      text,
      /^connect (ENOENT|ECONNREFUSED)/u,
      'failure text must not be a bare Node syscall error',
    );
    assert.match(text, /gateway/iu);
    assert.match(
      text,
      /(ENOENT|ECONNREFUSED)/u,
      'the underlying transport detail is preserved as secondary context',
    );
  } finally {
    child.kill();
    server.close();
  }
});

function spawnCompanion(endpoint, grantId, secret) {
  return spawnCompanionWithEnv({
    ...process.env,
    PROJECT_WEAVE_ENDPOINT: endpoint,
    PROJECT_WEAVE_GRANT_ID: grantId,
    PROJECT_WEAVE_GRANT_SECRET: secret,
  });
}

function spawnCompanionWithEnv(env) {
  return spawn(process.execPath, [companionPath], {
    cwd: repositoryRoot,
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

function withoutNames(env, names) {
  const copy = { ...env };
  for (const name of names) delete copy[name];
  return copy;
}

function uniqueEndpoint() {
  const id = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return process.platform === 'win32'
    ? `\\\\.\\pipe\\project-weave-mcp-test-${id}`
    : join(tmpdir(), `project-weave-mcp-test-${id}.sock`);
}

function send(child, message) {
  child.stdin.write(`${JSON.stringify(message)}\n`);
}

function initializeRequest(id) {
  return {
    jsonrpc: '2.0',
    id,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'probe', version: '0' },
    },
  };
}

function listToolsRequest(id) {
  return { jsonrpc: '2.0', id, method: 'tools/list', params: {} };
}

function waitForExit(child) {
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => (stdout += chunk));
  child.stderr.on('data', (chunk) => (stderr += chunk));
  return new Promise((resolveExit) => {
    child.on('exit', (code) => resolveExit({ stdout, stderr, exitCode: code }));
  });
}

function readMessages(child) {
  let buffer = '';
  const queue = [];
  const waiters = [];
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    buffer += chunk;
    let newline = buffer.indexOf('\n');
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line.length > 0) {
        const message = JSON.parse(line);
        const waiter = waiters.shift();
        if (waiter !== undefined) waiter(message);
        else queue.push(message);
      }
      newline = buffer.indexOf('\n');
    }
  });
  return {
    next: () =>
      queue.length > 0
        ? Promise.resolve(queue.shift())
        : new Promise((resolveNext) => waiters.push(resolveNext)),
  };
}
