import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'archify-cli-'));
const cli = path.join(skillRoot, 'bin/archify.mjs');

function run(args, options = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: options.cwd || skillRoot,
    encoding: 'utf8',
    env: options.env || process.env,
  });
}

test('cli: help lists commands and diagram types', () => {
  const result = run(['--help']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /archify render <type>/);
  assert.match(result.stdout, /architecture, workflow, sequence, dataflow, lifecycle/);
});

test('cli: render writes a diagram html file', () => {
  const out = path.join(tmp, 'workflow.html');
  const input = path.join(skillRoot, 'examples/agent-tool-call.workflow.json');
  const result = run(['render', 'workflow', input, out]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(out), true);
  assert.match(fs.readFileSync(out, 'utf8'), /Agent Tool Call Workflow/);
});

test('cli: check validates rendered html', () => {
  const out = path.join(tmp, 'workflow-check.html');
  const input = path.join(skillRoot, 'examples/agent-tool-call.workflow.json');
  assert.equal(run(['render', 'workflow', input, out]).status, 0);

  const result = run(['check', out]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /"ok": true/);
});

test('cli: validate emits structured json without keeping html output', () => {
  const input = path.join(skillRoot, 'examples/agent-tool-call.workflow.json');
  const before = new Set(fs.readdirSync(tmp));
  const result = run(['validate', 'workflow', input, '--json']);
  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.type, 'workflow');
  assert.equal(parsed.checks.length, 4);
  assert.deepEqual(new Set(fs.readdirSync(tmp)), before);
});

test('cli: validate returns renderer errors for bad input', () => {
  const input = path.join(tmp, 'bad.workflow.json');
  const validateTmp = path.join(tmp, 'validate-failure-tmp');
  const doc = JSON.parse(fs.readFileSync(path.join(skillRoot, 'examples/agent-tool-call.workflow.json'), 'utf8'));
  doc.edges[0].to = 'ghost';
  fs.writeFileSync(input, JSON.stringify(doc));
  fs.mkdirSync(validateTmp);

  const result = run(['validate', 'workflow', input], {
    env: { ...process.env, TMPDIR: validateTmp },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unknown target "ghost"/);
  assert.deepEqual(fs.readdirSync(validateTmp), []);
});

process.on('exit', () => fs.rmSync(tmp, { recursive: true, force: true }));
