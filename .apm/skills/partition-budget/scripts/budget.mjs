#!/usr/bin/env node
// Partition - Context Budget gauges. Node >= 22, no dependency.
//
//   node budget.mjs [--root DIR] [--json] [--check]
//   node budget.mjs --package DIR [--max-always N] [--max-skill N]
//
// Tokens are estimated as characters / chars_per_token (4 by default). The estimate is
// stable, which is what a trend needs; it is not what a model would bill.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------- YAML subset
// Block maps, block lists, one-line flow lists of scalars, quoted and plain scalars,
// comments. Anything else fails with its line number. Keep this block identical in
// budget.mjs and c4-drawio.mjs (tests/c4.test.mjs checks it).
// <yaml-subset>
export function parseYaml(text, file = 'yaml') {
  const fail = (n, msg) => {
    throw new Error(`${file}:${n}: ${msg}`);
  };
  const stripComment = (s) => {
    let q = null;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (q) {
        if (c === q && s[i - 1] !== '\\') q = null;
        continue;
      }
      if (c === '"' || c === "'") {
        q = c;
        continue;
      }
      if (c === '#' && (i === 0 || /\s/.test(s[i - 1]))) return s.slice(0, i);
    }
    return s;
  };
  const lines = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    if (/^ *\t/.test(raw)) fail(i + 1, 'tab in indentation; use spaces');
    const s = stripComment(raw).replace(/\s+$/, '');
    if (s.trim() === '') return;
    if (s.trim() === '---') {
      if (lines.length) fail(i + 1, 'several documents are not supported');
      return;
    }
    lines.push({ n: i + 1, indent: s.length - s.trimStart().length, text: s.trim() });
  });
  const keyEnd = (s) => {
    let q = null;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (q) {
        if (c === q) q = null;
        continue;
      }
      if ((c === '"' || c === "'") && i === 0) {
        q = c;
        continue;
      }
      if (c === ':' && (i === s.length - 1 || s[i + 1] === ' ')) return i;
    }
    return -1;
  };
  const unquote = (s, n) => {
    if (s.startsWith('"')) {
      if (!s.endsWith('"') || s.length < 2) fail(n, 'unterminated double-quoted string');
      return s.slice(1, -1).replace(/\\(["\\nt])/g, (_, c) => ({ n: '\n', t: '\t' })[c] ?? c);
    }
    if (s.startsWith("'")) {
      if (!s.endsWith("'") || s.length < 2) fail(n, 'unterminated single-quoted string');
      return s.slice(1, -1).replace(/''/g, "'");
    }
    return null;
  };
  const scalar = (s, n) => {
    const quoted = unquote(s, n);
    if (quoted !== null) return quoted;
    if (s.startsWith('{')) fail(n, 'flow maps { } are not supported; use block style');
    if (/^[|>][+-]?$/.test(s)) fail(n, 'block scalars (| and >) are not supported; keep the value on one line');
    if (/^[&*!]/.test(s))
      fail(n, `"${s}" starts with &, * or !; put it in quotes (anchors, aliases and tags are not supported)`);
    if (s.startsWith('[')) {
      if (!s.endsWith(']')) fail(n, 'a flow list must close on the same line');
      const inner = s.slice(1, -1).trim();
      if (inner === '') return [];
      const items = [];
      let cur = '';
      let q = null;
      for (const c of inner) {
        if (q) {
          cur += c;
          if (c === q) q = null;
          continue;
        }
        if (c === '"' || c === "'") {
          q = c;
          cur += c;
          continue;
        }
        if (c === '[' || c === '{') fail(n, 'nested flow collections are not supported');
        if (c === ',') {
          items.push(cur.trim());
          cur = '';
          continue;
        }
        cur += c;
      }
      items.push(cur.trim());
      return items.map((it) => scalar(it, n));
    }
    if (s.includes(': ')) fail(n, `"${s}" holds ": "; put the value in quotes`);
    if (s === 'true') return true;
    if (s === 'false') return false;
    if (s === 'null' || s === '~') return null;
    if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
    return s;
  };
  const isItem = (l) => l.text === '-' || l.text.startsWith('- ');
  let pos = 0;
  const parseBlock = (indent) => (isItem(lines[pos]) ? parseList(indent) : parseMap(indent));
  function parseMap(indent) {
    const obj = {};
    while (pos < lines.length && lines[pos].indent === indent && !isItem(lines[pos])) {
      const line = lines[pos];
      const k = keyEnd(line.text);
      if (k < 0) fail(line.n, `expected "key: value", got "${line.text}"`);
      const rawKey = line.text.slice(0, k).trim();
      const key = unquote(rawKey, line.n) ?? rawKey;
      if (Object.hasOwn(obj, key)) fail(line.n, `duplicate key "${key}"`);
      const rest = line.text.slice(k + 1).trim();
      pos++;
      if (rest !== '') {
        obj[key] = scalar(rest, line.n);
        continue;
      }
      const next = lines[pos];
      if (next && next.indent > indent) obj[key] = parseBlock(next.indent);
      else if (next && next.indent === indent && isItem(next)) obj[key] = parseList(indent);
      else obj[key] = null;
    }
    if (pos < lines.length && lines[pos].indent > indent) fail(lines[pos].n, 'unexpected indentation');
    return obj;
  }
  function parseList(indent) {
    const arr = [];
    while (pos < lines.length && lines[pos].indent === indent && isItem(lines[pos])) {
      const line = lines[pos];
      const rest = line.text === '-' ? '' : line.text.slice(1).trimStart();
      if (rest === '') {
        pos++;
        const next = lines[pos];
        arr.push(next && next.indent > indent ? parseBlock(next.indent) : null);
      } else if (!/^["'\[]/.test(rest) && keyEnd(rest) >= 0) {
        const inner = indent + (line.text.length - rest.length);
        lines[pos] = { n: line.n, indent: inner, text: rest };
        arr.push(parseMap(inner));
      } else {
        arr.push(scalar(rest, line.n));
        pos++;
      }
    }
    if (pos < lines.length && lines[pos].indent > indent) fail(lines[pos].n, 'unexpected indentation');
    return arr;
  }
  if (lines.length === 0) return {};
  const root = parseBlock(lines[0].indent);
  if (pos < lines.length) fail(lines[pos].n, 'unexpected indentation');
  return root;
}
// </yaml-subset>

// ---------------------------------------------------------------- files and globs
const SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  'vendor',
  'dist',
  'build',
  'target',
  'apm_modules',
  'coverage',
  '__pycache__',
  '.astro',
  '.idea',
  '.vs',
  'venv',
  '.venv',
]);

export function globToRegex(glob) {
  let g = String(glob).replace(/\\/g, '/').replace(/^\.\//, '');
  if (g.endsWith('/')) g += '**';
  let re = '';
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === '*') {
      if (g[i + 1] === '*') {
        if (g[i + 2] === '/') {
          re += '(?:.*/)?';
          i += 2;
        } else {
          re += '.*';
          i += 1;
        }
      } else re += '[^/]*';
    } else if (c === '?') re += '[^/]';
    else if (c === '{') {
      const end = g.indexOf('}', i);
      if (end < 0) {
        re += '\\{';
        continue;
      }
      re +=
        '(?:' +
        g
          .slice(i + 1, end)
          .split(',')
          .map((p) => p.replace(/[.+^$()|[\]\\]/g, '\\$&'))
          .join('|') +
        ')';
      i = end;
    } else re += c.replace(/[.+^$()|[\]\\]/g, '\\$&');
  }
  return new RegExp('^' + re + '$');
}

function walk(root) {
  const out = [];
  const visit = (dir, rel) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) visit(path.join(dir, e.name), r);
      } else if (e.isFile()) out.push(r);
    }
  };
  visit(root, '');
  return out;
}

const cache = new Map();
function chars(root, rel) {
  const abs = path.resolve(root, rel);
  if (cache.has(abs)) return cache.get(abs);
  let n = 0;
  try {
    const buf = fs.readFileSync(abs);
    if (!buf.subarray(0, 8000).includes(0)) n = buf.toString('utf8').length; // binary files count for nothing
  } catch {
    n = -1;
  }
  cache.set(abs, n);
  return n;
}

function frontmatter(root, rel) {
  let text;
  try {
    text = fs.readFileSync(path.resolve(root, rel), 'utf8');
  } catch {
    return { meta: {}, body: '' };
  }
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { meta: {}, body: text };
  let meta = {};
  try {
    meta = parseYaml(m[1], rel);
  } catch {
    meta = looseMeta(m[1]);
  }
  return { meta, body: text.slice(m[0].length) };
}

// Front matter written by other tools may leave the subset (long plain descriptions with
// ": " in them). Only top-level "key: rest of line" pairs and "- item" lists are kept.
function looseMeta(src) {
  const meta = {};
  let key = null;
  for (const line of src.split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (kv) {
      key = kv[1];
      meta[key] = kv[2].replace(/^["']|["']$/g, '');
      if (kv[2] === '') meta[key] = [];
      continue;
    }
    const item = line.match(/^\s+-\s+(.*)$/);
    if (item && key && Array.isArray(meta[key])) meta[key].push(item[1].replace(/^["']|["']$/g, ''));
  }
  return meta;
}

const asList = (v) =>
  (v == null ? [] : Array.isArray(v) ? v : String(v).split(',')).map((s) => String(s).trim()).filter(Boolean);
const isEverywhere = (globs) => globs.length === 0 || globs.some((g) => g === '**' || g === '**/*' || g === '*');

// ---------------------------------------------------------------- the schema of docs/partition.yml
// assets/partition.schema.json is the only list of the keys; the editor reads it too. validate reads only
// the keywords below, and a package test keeps the schema to them. A key without a value counts as absent.
export const SCHEMA_KEYWORDS = [
  '$schema',
  'title',
  'description',
  'type',
  'properties',
  'additionalProperties',
  'items',
  'enum',
  'required',
  'exclusiveMinimum',
];
const kindOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : Number.isInteger(v) ? 'integer' : typeof v);

export function validate(value, schema, at = '') {
  const where = at || '(root)';
  const kind = kindOf(value);
  if (schema.type && kind !== schema.type && !(schema.type === 'number' && kind === 'integer'))
    return [`${where}: expected ${schema.type}, found ${kind}`];
  if (schema.enum && !schema.enum.includes(value))
    return [`${where}: ${JSON.stringify(value)} is not one of ${schema.enum.map((v) => JSON.stringify(v)).join(', ')}`];
  if (schema.exclusiveMinimum !== undefined && typeof value === 'number' && !(value > schema.exclusiveMinimum))
    return [`${where}: ${value} is not above ${schema.exclusiveMinimum}`];
  const out = [];
  if (kind === 'object') {
    const under = (key) => (at ? `${at}.${key}` : key);
    for (const key of schema.required ?? []) if (value[key] == null) out.push(`${under(key)}: missing`);
    for (const [key, v] of Object.entries(value)) {
      if (v === null) continue;
      const sub =
        (Object.hasOwn(schema.properties ?? {}, key) ? schema.properties[key] : null) ??
        (typeof schema.additionalProperties === 'object' ? schema.additionalProperties : null);
      if (sub) out.push(...validate(v, sub, under(key)));
      else if (schema.additionalProperties === false) out.push(`${under(key)}: unknown key`);
    }
  }
  if (kind === 'array' && schema.items) value.forEach((v, i) => out.push(...validate(v, schema.items, `${at}[${i}]`)));
  return out;
}

function readSchema() {
  try {
    return JSON.parse(fs.readFileSync(new URL('../assets/partition.schema.json', import.meta.url), 'utf8'));
  } catch (e) {
    const err = new Error(
      `partition.schema.json cannot be read beside this script (${e.code ?? e.message}); install the package again`,
    );
    err.exitCode = 2;
    throw err;
  }
}

// ---------------------------------------------------------------- project mode
const TARGETS = {
  claude: {
    entry: ['CLAUDE.md', '.claude/CLAUDE.md'],
    instruction: '.claude/rules/partition.md',
    rules: ['.claude/rules/**/*.md'],
    scopeKey: 'paths',
    skills: ['.claude/skills/*/SKILL.md'],
    agents: ['.claude/agents/*.md'],
  },
  copilot: {
    entry: ['.github/copilot-instructions.md', 'AGENTS.md'],
    instruction: '.github/instructions/partition.instructions.md',
    rules: ['.github/instructions/**/*.instructions.md'],
    scopeKey: 'applyTo',
    skills: ['.agents/skills/*/SKILL.md', '.github/skills/*/SKILL.md'],
    agents: ['.github/agents/*.agent.md'],
  },
};

export function measureProject(root) {
  const cfgFile = path.join(root, 'docs', 'partition.yml');
  if (!fs.existsSync(cfgFile)) {
    const e = new Error(
      'docs/partition.yml not found. Create it with the partition-budget skill (assets/partition.yml).',
    );
    e.exitCode = 2;
    throw e;
  }
  const cfg = parseYaml(fs.readFileSync(cfgFile, 'utf8'), 'docs/partition.yml');
  const cpt = cfg.budget?.chars_per_token ?? 4;
  const findings = validate(cfg, readSchema());
  if (findings.length) {
    const e = new Error(
      `docs/partition.yml does not follow partition.schema.json:\n${findings.map((f) => `  - ${f}`).join('\n')}`,
    );
    e.exitCode = 2;
    throw e;
  }
  const limits = { always: cfg.budget?.always ?? 32000 };
  const targetName = cfg.target ?? 'claude';
  const target = TARGETS[targetName];
  const tok = (n) => Math.ceil(Math.max(n, 0) / cpt);
  const files = walk(root);
  const match = (globs) => {
    const res = asList(globs).map(globToRegex);
    return files.filter((f) => res.some((r) => r.test(f)));
  };

  // What every session loads, whatever the bounded context.
  const entry = match(target.entry);
  // The instruction of the package is always on by design (BR-6): not a rule file.
  const instruction = match(target.instruction);
  const rules = match(target.rules)
    .filter((f) => !instruction.includes(f))
    .map((f) => {
      const { meta } = frontmatter(root, f);
      const globs = asList(meta[target.scopeKey]);
      return { file: f, globs, scoped: !isEverywhere(globs), tokens: tok(chars(root, f)) };
    });
  const unscoped = rules.filter((r) => !r.scoped);
  const descriptions = [...match(target.skills), ...match(target.agents)].map((f) => {
    const { meta } = frontmatter(root, f);
    return { file: f, tokens: tok(`${meta.name ?? ''} ${meta.description ?? ''}`.length) };
  });
  const shared = {
    entry: entry.map((f) => ({ file: f, tokens: tok(chars(root, f)) })),
    instruction: instruction.map((f) => ({ file: f, tokens: tok(chars(root, f)) })),
    unscopedRules: unscoped.map(({ file, tokens }) => ({ file, tokens })),
    descriptions: { count: descriptions.length, tokens: descriptions.reduce((a, d) => a + d.tokens, 0) },
  };
  // The invariant register is read with every bounded context.
  const registerFile = cfg.paths?.invariants ?? `${cfg.paths?.specs ?? 'docs/specs'}/invariants.md`;
  shared.register =
    chars(root, registerFile) >= 0 ? { file: registerFile, tokens: tok(chars(root, registerFile)) } : null;
  shared.tokens =
    shared.entry.reduce((a, e) => a + e.tokens, 0) +
    shared.instruction.reduce((a, i) => a + i.tokens, 0) +
    shared.unscopedRules.reduce((a, r) => a + r.tokens, 0) +
    shared.descriptions.tokens +
    (shared.register?.tokens ?? 0);

  const specs = cfg.paths?.specs ?? 'docs/specs';
  const contexts = asList0(cfg.contexts).map((c) => {
    // A bounded context in an area has its spec under the area, and reads the area file.
    const specDir = c.spec ?? (c.area ? `${specs}/${c.area}/${c.id}` : `${specs}/${c.id}`);
    const specChars = chars(root, path.join(specDir, 'spec.md'));
    let areaFile = null;
    if (c.area) {
      const file = `${specs}/${c.area}/area.md`;
      const n = chars(root, file);
      areaFile = { area: c.area, file, found: n >= 0, tokens: tok(n) };
    }
    // The code is not counted: it only decides which scoped rules apply.
    const code = match(c.code);
    const scoped = rules.filter((r) => r.scoped && code.some((f) => r.globs.map(globToRegex).some((re) => re.test(f))));
    const always = shared.tokens + tok(specChars) + (areaFile?.tokens ?? 0) + scoped.reduce((a, r) => a + r.tokens, 0);
    return {
      id: c.id,
      specDir,
      specFound: specChars >= 0,
      spec: tok(specChars),
      areaFile,
      scopedRules: scoped.map(({ file, tokens }) => ({ file, tokens })),
      always,
      alwaysOver: always > limits.always,
    };
  });

  return {
    root,
    target: targetName,
    charsPerToken: cpt,
    limits,
    shared,
    contexts,
    plans: measurePlans(root, cfg, tok, limits),
    changes: measureChanges(root),
  };
}
const asList0 = (v) => (Array.isArray(v) ? v : []);

// A plan is resumed from its header, its task index and the task named in "Resume at".
function measurePlans(root, cfg, tok, limits) {
  const dir = cfg.paths?.plans ?? 'docs/plans';
  let names = [];
  try {
    names = fs.readdirSync(path.resolve(root, dir)).filter((n) => n.endsWith('.md'));
  } catch {
    return [];
  }
  const out = [];
  for (const name of names) {
    const text = fs.readFileSync(path.resolve(root, dir, name), 'utf8');
    const status = text.match(/^>\s*\*\*Status:\*\*\s*(.+)$/m)?.[1].trim();
    if (!status || /^done/i.test(status)) continue;
    const resume = text.match(/^>\s*\*\*Resume at:\*\*\s*(.+)$/m)?.[1] ?? '';
    const taskNo = resume.match(/Task\s+(\d+)/i)?.[1];
    const lines = text.split(/\r?\n/);
    const isHeading = (l) => /^#{1,6}\s/.test(l);
    let head = lines.length;
    const tasksAt = lines.findIndex((l) => /^##\s+Tasks\s*$/.test(l));
    if (tasksAt >= 0) {
      head = lines.findIndex((l, i) => i > tasksAt && isHeading(l));
      if (head < 0) head = lines.length;
    }
    let surface = lines.slice(0, head).join('\n').length;
    if (taskNo) {
      const at = lines.findIndex((l, i) => i >= head && new RegExp(`^#{2,4}\\s+Task\\s+${taskNo}\\b`).test(l));
      if (at >= 0) {
        const level = lines[at].match(/^#+/)[0].length;
        let end = lines.findIndex((l, i) => i > at && isHeading(l) && l.match(/^#+/)[0].length <= level);
        if (end < 0) end = lines.length;
        surface += lines.slice(at, end).join('\n').length;
      }
    }
    out.push({
      file: `${dir}/${name}`,
      status,
      whole: tok(text.length),
      resume: tok(surface),
      wholeOver: tok(text.length) > limits.always,
    });
  }
  return out;
}

// First warning sign: an ordinary change touches more and more files.
function measureChanges(root) {
  try {
    const log = execFileSync(
      'git',
      ['-C', root, 'log', '--no-merges', '-n', '60', '--name-only', '--pretty=format:@@'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    const counts = log
      .split('@@')
      .slice(1)
      .map((c) => c.split('\n').filter((l) => l.trim()).length)
      .filter((n) => n > 0);
    const median = (a) => {
      if (!a.length) return null;
      const s = [...a].sort((x, y) => x - y);
      const m = s.length >> 1;
      return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
    };
    return {
      measured: true,
      commits: counts.length,
      recent: median(counts.slice(0, 30)),
      earlier: median(counts.slice(30, 60)),
    };
  } catch {
    return { measured: false };
  }
}

// ---------------------------------------------------------------- package mode (BR-2)
export function measurePackage(dir, maxAlways = 2000, maxSkill = 3000, cpt = 4) {
  const tok = (n) => Math.ceil(n / cpt);
  const files = walk(dir);
  const pick = (re) => files.filter((f) => re.test(f));
  const always = [];
  for (const f of pick(/^\.apm\/instructions\/.*\.instructions\.md$/)) {
    const { meta, body } = frontmatter(dir, f);
    if (isEverywhere(asList(meta.applyTo))) always.push({ file: f, what: 'instruction', tokens: tok(body.length) });
  }
  const skills = [];
  for (const f of pick(/^\.apm\/skills\/[^/]+\/SKILL\.md$/)) {
    const { meta } = frontmatter(dir, f);
    const folder = f.split('/')[2];
    always.push({
      file: f,
      what: 'skill description',
      tokens: tok(`${meta.name ?? folder} ${meta.description ?? ''}`.length),
    });
    skills.push({
      file: f,
      folder,
      name: meta.name ?? null,
      tokens: tok(chars(dir, f)),
      over: tok(chars(dir, f)) > maxSkill,
    });
  }
  for (const f of pick(/^\.apm\/agents\/.*\.agent\.md$/)) {
    const { meta } = frontmatter(dir, f);
    always.push({
      file: f,
      what: 'agent description',
      tokens: tok(`${meta.name ?? ''} ${meta.description ?? ''}`.length),
    });
  }
  const total = always.reduce((a, x) => a + x.tokens, 0);
  let name = path.basename(dir);
  try {
    const m = fs.readFileSync(path.join(dir, 'apm.yml'), 'utf8').match(/^name:\s*['"]?([^'"#\n]+?)['"]?\s*(?:#.*)?$/m);
    if (m) name = m[1];
  } catch {
    // no apm.yml: the folder name stands for the package
  }
  return {
    dir,
    name,
    maxAlways,
    maxSkill,
    always,
    alwaysTokens: total,
    alwaysOver: total > maxAlways,
    skills,
    ok: total <= maxAlways && skills.every((s) => !s.over),
  };
}

// ---------------------------------------------------------------- output
const n = (x) => String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const flag = (over) => (over ? 'OVER' : 'ok');

function printProject(r) {
  const L = [];
  // Sections start at ##: the output is pasted under the title of a record.
  L.push(
    `Measured on ${new Date().toISOString().slice(0, 10)}. Target: ${r.target}. Tokens estimated as characters / ${r.charsPerToken}.`,
    `Threshold per bounded context: _Always_ ${n(r.limits.always)}.`,
    '',
  );
  L.push('## Loaded by every session', '', '| Source | Tokens |', '| --- | ---: |');
  for (const e of r.shared.entry) L.push(`| ${e.file} | ${n(e.tokens)} |`);
  for (const i of r.shared.instruction) L.push(`| ${i.file} (instruction) | ${n(i.tokens)} |`);
  for (const u of r.shared.unscopedRules) L.push(`| ${u.file} (rule without a scope) | ${n(u.tokens)} |`);
  if (r.shared.register) L.push(`| ${r.shared.register.file} (invariant register) | ${n(r.shared.register.tokens)} |`);
  L.push(
    `| ${r.shared.descriptions.count} skill and agent descriptions | ${n(r.shared.descriptions.tokens)} |`,
    `| **Total** | **${n(r.shared.tokens)}** |`,
    '',
  );
  const share = (x, limit, over) => `${Math.round((x / limit) * 100)} % ${flag(over)}`;
  L.push('## Bounded contexts', '', `| Bounded context | Always | of ${n(r.limits.always)} |`, '| --- | ---: | ---: |');
  for (const c of r.contexts)
    L.push(`| ${c.id} | ${n(c.always)} | ${share(c.always, r.limits.always, c.alwaysOver)} |`);
  if (!r.contexts.length) L.push('| (none declared) | | |');
  L.push('');
  if (r.contexts.length) {
    L.push(
      'What makes them up:',
      '',
      '| Bounded context | Every session | Spec | Area file | Scoped rules |',
      '| --- | ---: | ---: | ---: | ---: |',
    );
    for (const c of r.contexts) {
      const area = c.areaFile ? (c.areaFile.found ? n(c.areaFile.tokens) : 'none') : '—';
      L.push(
        `| ${c.id} | ${n(r.shared.tokens)} | ${c.specFound ? n(c.spec) : 'missing'} | ${area} | ${n(c.scopedRules.reduce((a, x) => a + x.tokens, 0))} |`,
      );
    }
    L.push('');
  }
  L.push(
    '_Always_ = every session (the invariant register included) + spec + area file + scoped rules: what any task of the bounded context loads before reading code.',
    '',
  );
  const areas = new Map();
  for (const c of r.contexts) {
    if (!c.areaFile) continue;
    if (!areas.has(c.areaFile.area)) areas.set(c.areaFile.area, { ...c.areaFile, readers: [] });
    areas.get(c.areaFile.area).readers.push(c.id);
  }
  for (const a of areas.values())
    L.push(
      a.found
        ? `Area file of ${a.area}: ${a.file} (${n(a.tokens)}), read by ${a.readers.join(', ')}.`
        : `Area ${a.area}: no area file at ${a.file} (bounded contexts: ${a.readers.join(', ')}).`,
    );
  if (areas.size) L.push('');
  L.push('## Plans in progress', '');
  if (!r.plans.length) L.push('None.', '');
  else {
    L.push('| Plan | Whole file | Read on resume | Verdict |', '| --- | ---: | ---: | --- |');
    for (const p of r.plans)
      L.push(`| ${p.file} | ${n(p.whole)} | ${n(p.resume)} | ${p.wholeOver ? 'never read whole' : 'ok'} |`);
    L.push('');
  }
  L.push('## Files touched per change', '');
  if (!r.changes.measured) L.push('Not measured: no git history here.');
  else if (r.changes.earlier == null)
    L.push(`Median over the last ${r.changes.commits} commits: ${r.changes.recent}. Not enough history for a trend.`);
  else L.push(`Median of the last 30 commits: ${r.changes.recent}. The 30 before: ${r.changes.earlier}.`);
  return L.join('\n');
}

function printPackage(r) {
  // Named after its apm.yml, never by its folder: a record pasted from this output carries no local path.
  const L = [`## Package budget — ${r.name}`, '', '| Always loaded | Tokens |', '| --- | ---: |'];
  for (const a of r.always) L.push(`| ${a.file} (${a.what}) | ${n(a.tokens)} |`);
  L.push(
    `| **Total** (limit ${n(r.maxAlways)}) | **${n(r.alwaysTokens)}** ${flag(r.alwaysOver)} |`,
    '',
    `| SKILL.md (limit ${n(r.maxSkill)}) | Tokens | Verdict |`,
    '| --- | ---: | --- |',
  );
  for (const s of r.skills) L.push(`| ${s.folder} | ${n(s.tokens)} | ${flag(s.over)} |`);
  return L.join('\n');
}

function main(argv) {
  const opt = { root: process.cwd() };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') opt.json = true;
    else if (a === '--check') opt.check = true;
    else if (['--root', '--package', '--max-always', '--max-skill'].includes(a)) opt[a.slice(2)] = argv[++i];
    else if (a === '--help' || a === '-h') {
      console.log(
        'node budget.mjs [--root DIR] [--json] [--check]\nnode budget.mjs --package DIR [--max-always N] [--max-skill N]',
      );
      return 0;
    } else {
      console.error(`unknown option ${a}`);
      return 2;
    }
  }
  try {
    if (opt.package) {
      const r = measurePackage(
        path.resolve(opt.package),
        Number(opt['max-always'] ?? 2000),
        Number(opt['max-skill'] ?? 3000),
      );
      console.log(opt.json ? JSON.stringify(r, null, 2) : printPackage(r));
      return r.ok ? 0 : 1;
    }
    const root = path.resolve(opt.root);
    const r = measureProject(root);
    console.log(opt.json ? JSON.stringify(r, null, 2) : printProject(r));
    const over = r.contexts.some((c) => c.alwaysOver);
    return opt.check && over ? 1 : 0;
  } catch (e) {
    console.error(`budget: ${e.message}`);
    return e.exitCode ?? 2;
  }
}

// Run as a command, not when imported. Node resolves links for import.meta.url, not for argv[1].
const isMain = () => {
  try {
    return fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
};

if (process.argv[1] && isMain()) process.exit(main(process.argv.slice(2)));
