import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDocument, stringify } from 'yaml';
import { profiles } from './profiles.mjs';
import { adapt } from './patches.mjs';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const digest = value => createHash('sha256').update(value).digest('hex');

export function walk(directory, prefix = '') {
  if (lstatSync(directory).isSymbolicLink()) throw new Error(`Refusing symlink: ${directory}`);
  const files = new Map();
  for (const name of readdirSync(directory).sort()) {
    const path = join(directory, name);
    if (lstatSync(path).isSymbolicLink()) throw new Error(`Refusing symlink: ${path}`);
    const key = prefix + name;
    if (lstatSync(path).isDirectory()) {
      for (const entry of walk(path, `${key}/`)) files.set(...entry);
    } else files.set(key, readFileSync(path));
  }
  return files;
}

export function frontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error('Missing YAML frontmatter');
  const doc = parseDocument(match[1], { uniqueKeys: true });
  if (doc.errors.length) throw new Error(doc.errors.map(e => e.message).join('; '));
  return { data: doc.toJS(), body: match[2] };
}

export function sources() {
  const result = {};
  for (const [group, skills] of Object.entries(profiles)) {
    for (const name of Object.keys(skills)) {
      const files = walk(join(root, 'plugins', group, 'skills', name));
      result[`${group}/${name}`] = digest([...files].map(([path, bytes]) => `${path}\0${digest(bytes)}\n`).join(''));
    }
  }
  return result;
}

export function validate(files) {
  const names = new Set();
  for (const [path, bytes] of files) {
    if (!path.endsWith('.md')) continue;
    const text = bytes.toString();
    if (path.endsWith('/SKILL.md')) {
      const { data, body } = frontmatter(text);
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.name) || data.name.length > 64 || dirname(path).split('/').at(-1) !== data.name) throw new Error(`Invalid name: ${path}`);
      if (names.has(data.name)) throw new Error(`Duplicate name: ${data.name}`);
      names.add(data.name);
      if (typeof data.description !== 'string' || !data.description.trim() || data.description.length > 1024) throw new Error(`Invalid description: ${path}`);
      if (Object.keys(data).some(key => !['name', 'description', 'license', 'metadata'].includes(key))) throw new Error(`Unsupported schema: ${path}`);
      if (!body.trim()) throw new Error(`Empty body: ${path}`);
      if (text.split('\n').length > 500) throw new Error(`Skill exceeds 500 lines: ${path}`);
    }
    // Scan instructions, including disclosed references, not just entrypoints.
    if (/AskUserQuestion|SendMessage|Bash\(open|disable-model-invocation|subagent_type|run_in_background|isolation:|\bsonnet\b|\bhaiku\b|\/clear\b|\/compact\b|\/learn\b|\.claude\/|\.pi\/|\*\*Explore\*\*/.test(text)) throw new Error(`Host-specific instruction: ${path}`);
    const prose = text.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1\s*$/gm, '');
    for (const match of prose.matchAll(/\[[^\]\n]+\]\(([^\s)]+)\)/g)) {
      const target = match[1].split('#')[0];
      if (!target || /^(?:[a-z]+:|\/)/i.test(target) || /[<>]/.test(target)) continue;
      const destination = relative('/', resolve('/', dirname(path), target));
      if (!files.has(destination)) throw new Error(`Broken reference: ${path} -> ${target}`);
    }
    for (const match of prose.matchAll(/`((?:scripts|references|schemas|examples|bin|assets|renderers)\/[\w./-]+\.(?:md|sh|py|mjs|json|html))`/g)) {
      const destination = join(dirname(path), match[1]);
      // Resource paths in nested references are relative to the skill directory.
      const skillRoot = path.split('/').slice(0, 2).join('/');
      if (!files.has(destination) && !files.has(join(skillRoot, match[1]))) throw new Error(`Missing resource: ${path} -> ${match[1]}`);
    }
  }
  return names;
}

export function generate(lock = JSON.parse(readFileSync(join(root, 'amp/source-lock.json'), 'utf8'))) {
  if (JSON.stringify(sources()) !== JSON.stringify(lock.skills)) throw new Error('Upstream source drift: review changes and explicitly record a new source lock.');
  const files = new Map();
  const policy = readFileSync(join(root, 'amp/policy.md'), 'utf8').trim();
  for (const [group, skills] of Object.entries(profiles)) {
    for (const [name, profile] of Object.entries(skills)) {
      for (const [path, bytes] of walk(join(root, 'plugins', group, 'skills', name))) {
        if (path.startsWith('agents/')) continue; // Other-host launcher metadata stays upstream.
        const key = `${group}/${name}/${path}`;
        let output = bytes;
        if (path.endsWith('.md')) {
          let text = bytes.toString();
          if (path === 'SKILL.md') {
            const { data, body } = frontmatter(text);
            let description = data.description.trim();
            if (name === 'code-review') description = 'Reviews a diff against repository standards and the originating spec, reporting both axes separately. Use when asked to review changes, a branch, or a PR.';
            if (name === 'research') description = 'Investigates a question against primary sources and writes cited findings. Use when the user requests research, API documentation, or sourced fact gathering.';
            if (profile === 'explicit') description = `Only when the user explicitly requests the ${name} workflow (or explicitly authorizes it as part of a larger workflow). ${description}`;
            if (name === 'razor') description = 'Audits whether requirements, workflow steps, fields, states, modules, layers, or abstractions deserve to exist. Use when asked to simplify, apply Occam’s razor, trim scope, or challenge over-engineering. Returns evidence-led Keep/Merge/Defer/Delete/Replace/Prove-first verdicts; review only.';
            const metadata = { ...(data.metadata ?? {}), 'amp-adapter': profile, 'source-commit': lock.commit };
            const header = { name, description, ...(data.license ? { license: data.license } : {}), metadata };
            const gate = profile === 'explicit' ? `\n\n**Explicit request required:** Activate only for a user-requested ${name} workflow, including an explicitly approved larger workflow. Otherwise recommend it and wait. Loading this skill does not authorize external writes or implementation.\n` : '';
            let adaptedBody = adapt(name, path, body).trim();
            if (name === 'humanizer-zh') {
              files.set(`${group}/${name}/references/style-guide.md`, Buffer.from(adaptedBody + '\n'));
              adaptedBody = '# Humanizer-zh\n\n编辑中文文本时，先阅读 [完整写作指南](references/style-guide.md)，保留事实、归因、含义和原有语气。用自然表达替换模板化措辞，不捏造经历或引用。需要澄清时在普通对话中提问。仅修改用户授权的文本。';
            }
            text = `---\n${stringify(header).trimEnd()}\n---\n\n${policy}${gate}\n\n${adaptedBody}\n`;
          } else text = adapt(name, path, text);
          // Convert only known skill invocations, never arbitrary routes/URLs.
          for (const skill of Object.values(profiles).flatMap(Object.keys)) text = text.replace(new RegExp(`(?<![\\w:/])/${skill}(?![\\w/-])`, 'g'), skill);
          text = text.replaceAll('the Skill tool', 'the available skill tool');
          output = Buffer.from(text);
        }
        files.set(key, output);
      }
    }
  }
  validate(files);
  return files;
}

export function publish(files, directory, check = false) {
  // Refuse user edits and stale files before writing anything; never delete.
  const current = existsSync(directory) ? walk(directory) : new Map();
  const receiptPath = join(directory, '.build-receipt.json');
  const previous = existsSync(receiptPath) ? JSON.parse(readFileSync(receiptPath, 'utf8')) : {};
  for (const [path, bytes] of current) {
    if (path === '.build-receipt.json') continue;
    if (!files.has(path) || previous[path] !== digest(bytes)) throw new Error(`Unowned, edited, or stale generated file; preserve it before rebuilding: ${path}`);
  }
  if (check) {
    for (const [path, bytes] of files) if (!current.get(path)?.equals(bytes)) throw new Error(`Generated output drift: ${path}`);
    if (Object.keys(previous).length !== files.size) throw new Error('Build receipt drift');
    return;
  }
  for (const [path, bytes] of files) {
    const destination = join(directory, path);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, bytes);
  }
  writeFileSync(receiptPath, JSON.stringify(Object.fromEntries([...files].map(([path, bytes]) => [path, digest(bytes)])), null, 2) + '\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, commit] = process.argv.slice(2);
  if (command === '--record-source') {
    if (!/^[0-9a-f]{40}$/.test(commit ?? '')) throw new Error('Supply a reviewed full source commit');
    const changed = execFileSync('git', ['diff', commit, '--name-only', '--', 'plugins/'], { cwd: root, encoding: 'utf8' });
    if (changed.trim()) throw new Error('Source tree differs from the supplied commit');
    writeFileSync(join(root, 'amp/source-lock.json'), JSON.stringify({ repository: 'https://github.com/KorenKrita/skills', commit, skills: sources() }, null, 2) + '\n');
    console.log(`Recorded reviewed source ${commit}`);
  } else {
    if (command && command !== '--check') throw new Error('Usage: node amp/build.mjs [--check | --record-source COMMIT]');
    const files = generate();
    publish(files, join(root, 'amp/generated'), command === '--check');
    console.log(`${command ? 'Checked' : 'Built'} ${validate(files).size} skills, ${files.size} files; sec-router excluded.`);
  }
}
