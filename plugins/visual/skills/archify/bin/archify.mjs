#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(__dirname, '..');

const TYPES = new Set(['architecture', 'workflow', 'sequence', 'dataflow', 'lifecycle']);

function usage() {
  return `Usage:
  archify render <type> <input.json> [output.html]
  archify validate <type> <input.json> [--json]
  archify check <output.html>
  archify examples

Types:
  architecture, workflow, sequence, dataflow, lifecycle
`;
}

function fail(message, code = 2) {
  console.error(message);
  process.exit(code);
}

function rendererPath(type) {
  if (!TYPES.has(type)) {
    fail(`Unknown diagram type "${type}". Expected one of: ${[...TYPES].join(', ')}`);
  }
  return path.join(skillRoot, 'renderers', type, `render-${type}.mjs`);
}

function runNode(args, options = {}) {
  return spawnSync(process.execPath, args, {
    cwd: options.cwd || process.cwd(),
    encoding: 'utf8',
    stdio: options.stdio || 'inherit',
  });
}

function exitFrom(result) {
  if (result.error) fail(result.error.message, 1);
  process.exit(result.status ?? 1);
}

function commandRender(args) {
  const [type, input, output] = args;
  if (!type || !input) fail(usage());
  const result = runNode([rendererPath(type), input, ...(output ? [output] : [])]);
  if (result.status !== 0) exitFrom(result);
}

function commandCheck(args) {
  const [html] = args;
  if (!html) fail(usage());
  const result = runNode([path.join(skillRoot, 'scripts/check-render-output.mjs'), html]);
  if (result.status !== 0) exitFrom(result);
}

function commandExamples() {
  const result = runNode([path.join(skillRoot, 'test/render-examples.mjs')], { cwd: skillRoot });
  if (result.status !== 0) exitFrom(result);
}

function commandValidate(args) {
  const json = args.includes('--json');
  const rest = args.filter((arg) => arg !== '--json');
  const [type, input] = rest;
  if (!type || !input) fail(usage());

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'archify-validate-'));
  const out = path.join(tmp, `${type}.html`);
  let exitCode = 0;

  try {
    const render = runNode([rendererPath(type), input, out], { stdio: 'pipe' });
    if (render.status !== 0) {
      if (render.stderr) process.stderr.write(render.stderr);
      if (render.stdout) process.stdout.write(render.stdout);
      exitCode = render.status ?? 1;
    } else {
      const check = runNode([path.join(skillRoot, 'scripts/check-render-output.mjs'), out], { stdio: 'pipe' });
      if (check.status !== 0) {
        if (check.stdout) process.stdout.write(check.stdout);
        if (check.stderr) process.stderr.write(check.stderr);
        exitCode = check.status ?? 1;
      } else {
        const result = JSON.parse(check.stdout);
        if (json) {
          console.log(JSON.stringify({
            ok: true,
            type,
            input: path.resolve(input),
            checks: result.checks,
          }, null, 2));
        } else {
          console.log(`ok ${type} ${path.resolve(input)} (${result.checks.length} checks)`);
        }
      }
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  if (exitCode !== 0) process.exit(exitCode);
}

const [command, ...args] = process.argv.slice(2);

switch (command) {
  case undefined:
  case '-h':
  case '--help':
  case 'help':
    console.log(usage());
    break;
  case 'render':
    commandRender(args);
    break;
  case 'validate':
    commandValidate(args);
    break;
  case 'check':
    commandCheck(args);
    break;
  case 'examples':
    commandExamples();
    break;
  default:
    fail(`Unknown command "${command}".\n\n${usage()}`);
}
