import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { frontmatter, generate, publish, root, validate } from './build.mjs';
import { profiles } from './profiles.mjs';
import { replaceOnce } from './patches.mjs';

const files = generate();
const skill = name => [...files].find(([path]) => path.endsWith(`/${name}/SKILL.md`))[1].toString();
const fixture = (description = 'Does a thing when explicitly requested.', body = '# Test') => Buffer.from(`---\nname: sample\ndescription: ${description}\n---\n${body}\n`);

test('exact approved inventory and deterministic output; no security payload or launcher metadata', () => {
  const expected = ['domain-modeling', 'wizard', 'i-have-adhd', 'diagnosing-bugs', 'prototype', 'tdd', 'archify', 'razor', 'read', 'code-review', 'codebase-design', 'humanizer-zh', 'research', 'resolving-merge-conflicts', 'writing-for-agents', 'ask-matt', 'grill-me', 'grill-with-docs', 'grilling', 'handoff', 'implement', 'improve-codebase-architecture', 'setup-matt-pocock-skills', 'teach', 'to-questionnaire', 'to-spec', 'to-tickets', 'triage', 'wait-what', 'wayfinder', 'bro', 'improve', 'nuclear-review', 'show-me'];
  assert.deepEqual([...validate(files)].sort(), expected.sort());
  assert.deepEqual(generate(), files);
  assert.equal([...files.keys()].some(path => /sec-router|vendor\/|agent-config-sync|\/anysearch\/|\/exa\/|\/agents\/|mcp\.json/.test(path)), false);
});

test('preserved discipline and packaged resources remain available', () => {
  for (const [group, name] of [['base', 'domain-modeling'], ['plus', 'i-have-adhd']]) {
    const original = frontmatter(readFileSync(join(root, 'plugins', group, 'skills', name, 'SKILL.md'), 'utf8')).body.trim();
    assert.ok(skill(name).endsWith(original + '\n'));
  }
  for (const path of ['base/wizard/template.sh', 'base/diagnosing-bugs/scripts/hitl-loop.template.sh', 'plus/archify/bin/archify.mjs', 'plus/read/scripts/fetch.sh']) {
    const [group, name, ...rest] = path.split('/');
    assert.deepEqual(files.get(path), readFileSync(join(root, 'plugins', group, 'skills', name, ...rest)));
  }
  assert.match(skill('wizard'), /Don't run it end-to-end yourself/);
  assert.match(skill('wizard'), /documented environment variable names \(not secret values\)/);
});

test('explicit workflows carry intent in both discovery metadata and body', () => {
  for (const skills of Object.values(profiles)) for (const [name, profile] of Object.entries(skills)) {
    if (profile !== 'explicit') continue;
    const { data, body } = frontmatter(skill(name));
    assert.match(data.description, /^Only when the user explicitly requests/);
    assert.match(body, /\*\*Explicit request required:\*\*/);
    assert.equal('disable-model-invocation' in data, false);
  }
});

test('risky workflows retain their local-first and read-only boundaries', () => {
  assert.match(skill('to-spec'), /as a local draft/);
  assert.match(skill('to-tickets'), /Approval of content alone is not permission/);
  assert.match(skill('triage'), /Apply only an authorized outcome/);
  assert.match(skill('wayfinder'), /Without it, prepare a local draft map/);
  assert.match(skill('resolving-merge-conflicts'), /index contains no unrelated staged changes/);
  assert.doesNotMatch(skill('resolving-merge-conflicts'), /Stage everything|Always resolve/);
  assert.match(skill('improve'), /does not dispatch an executor/);
  assert.match(skill('nuclear-review'), /do not edit code/);
  assert.match(skill('code-review'), /git diff --cached/);
  assert.match(skill('archify'), /Do not run the bundled update checker/);
  assert.match(skill('research'), /Exa, AnySearch, or Codex Search/);
  assert.match(skill('grilling'), /end the turn to wait/);
});

test('schema validation rejects duplicated YAML keys, names, unsupported fields, and boundary overflow', () => {
  assert.throws(() => frontmatter('---\nname: a\nname: b\n---\nbody'), /unique/i);
  assert.throws(() => validate(new Map([['base/sample/SKILL.md', fixture()], ['plus/sample/SKILL.md', fixture()]])), /Duplicate name/);
  assert.throws(() => validate(new Map([['base/wrong/SKILL.md', fixture()]])), /Invalid name/);
  assert.doesNotThrow(() => validate(new Map([['base/sample/SKILL.md', fixture('x'.repeat(1024))]])));
  assert.throws(() => validate(new Map([['base/sample/SKILL.md', fixture('x'.repeat(1025))]])), /Invalid description/);
  assert.throws(() => validate(new Map([['base/sample/SKILL.md', fixture('""')]])), /Invalid description/);
  assert.throws(() => validate(new Map([['base/sample/SKILL.md', fixture('ok\nmodel: unavailable')]])), /Unsupported schema/);
});

test('reference validation distinguishes document examples from missing required resources', () => {
  const valid = new Map([['base/sample/SKILL.md', fixture('ok', '[Details](references/detail.md)')], ['base/sample/references/detail.md', Buffer.from('```md\n[Example](./src/not-a-package-resource.md)\n```\nUse `scripts/probe.sh`.')], ['base/sample/scripts/probe.sh', Buffer.from('#!/bin/sh\n')]]);
  assert.doesNotThrow(() => validate(valid));
  const broken = new Map(valid);
  broken.delete('base/sample/scripts/probe.sh');
  assert.throws(() => validate(broken), /Missing resource/);
  const brokenLink = new Map(valid);
  brokenLink.delete('base/sample/references/detail.md');
  assert.throws(() => validate(brokenLink), /Broken reference/);
  const injected = new Map(valid);
  injected.set('base/sample/references/detail.md', Buffer.from('Use AskUserQuestion.'));
  assert.throws(() => validate(injected), /Host-specific instruction/);
});

test('source patches fail on missing or ambiguous anchors', () => {
  assert.equal(replaceOnce('left middle right', 'middle', 'changed'), 'left changed right');
  assert.throws(() => replaceOnce('no anchor', 'middle', 'changed'), /one patch anchor/);
  assert.throws(() => replaceOnce('middle middle', 'middle', 'changed'), /one patch anchor/);
});

test('input fingerprint drift fails before any output is produced', () => {
  const lock = JSON.parse(readFileSync(join(root, 'amp/source-lock.json'), 'utf8'));
  lock.skills['base/research'] = '0'.repeat(64);
  assert.throws(() => generate(lock), /Upstream source drift/);
});

test('security opt-in is schema-valid, isolated, and assessment-only', () => {
  const bytes = readFileSync(join(root, 'amp/opt-in/security/sec-router/SKILL.md'));
  assert.deepEqual([...validate(new Map([['security/sec-router/SKILL.md', bytes]]))], ['sec-router']);
  const { data, body } = frontmatter(bytes.toString());
  assert.match(data.description, /^Only when the user explicitly opts into/);
  assert.match(body, /not a fully compatible security router/);
  assert.match(body, /Stop at the assessment/);
});

test('build refuses edited/unowned/stale files before overwriting anything', () => {
  // Retained for inspection; move this printed disposable fixture to Trash after tests.
  const directory = mkdtempSync(join(root, '.tmp-amp-test-'));
  console.log(`Disposable fixture (Trash after inspection): ${directory}`);
  const input = new Map([['a.txt', Buffer.from('known')], ['b.txt', Buffer.from('stable')]]);
  publish(input, directory);
  publish(input, directory, true);
  writeFileSync(join(directory, 'a.txt'), 'user edit');
  const next = new Map(input).set('b.txt', Buffer.from('changed'));
  assert.throws(() => publish(next, directory), /edited/);
  assert.equal(readFileSync(join(directory, 'a.txt'), 'utf8'), 'user edit');
  assert.equal(readFileSync(join(directory, 'b.txt'), 'utf8'), 'stable');
  writeFileSync(join(directory, 'a.txt'), 'known');
  assert.throws(() => publish(new Map([['b.txt', Buffer.from('changed')]]), directory), /stale/);
  assert.throws(() => publish(next, directory, true), /output drift/);
  writeFileSync(join(directory, 'user.txt'), 'unowned');
  assert.throws(() => publish(next, directory), /Unowned/);
  assert.equal(readFileSync(join(directory, 'b.txt'), 'utf8'), 'stable');
});

test('build rejects a symlinked output root rather than writing through it', () => {
  const directory = mkdtempSync(join(root, '.tmp-amp-test-'));
  console.log(`Disposable fixture (Trash after inspection): ${directory}`);
  const alias = join(directory, 'alias');
  const target = join(directory, 'target');
  publish(new Map([['a.txt', Buffer.from('original')]]), target);
  symlinkSync(target, alias);
  assert.throws(() => publish(new Map([['a.txt', Buffer.from('replacement')]]), alias), /symlink/);
  assert.equal(readFileSync(join(target, 'a.txt'), 'utf8'), 'original');
});
