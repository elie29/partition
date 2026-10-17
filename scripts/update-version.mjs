#!/usr/bin/env node

// Partition - one command to set the version of the package. Node >= 22, no dependency.
//
//   npm run update-version <X.Y.Z | patch | minor | major>
//   node scripts/update-version.mjs <X.Y.Z | patch | minor | major> [--dry-run] [--root <dir>]
//   node scripts/update-version.mjs --check [--root <dir>]
//
// The version is written in four places: apm.yml, the badge and the install commands of
// README.md, the example of SECURITY.md, and the top dated entry of CHANGELOG.md, which a
// release makes from the content of [Unreleased]. This script writes all four; --check says
// whether they agree. It touches nothing else and runs no git.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const VERSION = '\\d+\\.\\d+\\.\\d+';
const PLACEHOLDER = 'TODO: say what changed';

// One entry per place: how to read the versions written there, and how to write a new one.
const PLACES = [
  { file: 'apm.yml', what: 'version', pattern: new RegExp(`^(version:\\s*)(${VERSION})\\s*$`, 'm') },
  { file: 'README.md', what: 'version badge', pattern: new RegExp(`(badge/version-)(${VERSION})(?=-)`, 'g') },
  { file: 'README.md', what: 'install commands', pattern: new RegExp(`(elie29/partition#v)(${VERSION})`, 'g') },
  {
    file: 'SECURITY.md',
    what: 'pinned tag example',
    pattern: new RegExp(`(elie29/partition#v)(${VERSION})`, 'g'),
  },
];
const CHANGELOG = 'CHANGELOG.md';
const ENTRY = new RegExp(`^## \\[(${VERSION})\\] - \\d{4}-\\d{2}-\\d{2}\\s*$`, 'm');
const UNRELEASED = /^## \[Unreleased\][ \t]*(?=\r?$)/m;

const fail = (message, code = 1) => {
  const e = new Error(message);
  e.exitCode = code;
  throw e;
};
const compare = (a, b) => {
  const x = a.split('.').map(Number);
  const y = b.split('.').map(Number);
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
};
const all = (text, pattern) => [
  ...text.matchAll(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`)),
];

function readState(root) {
  const text = {};
  for (const file of new Set([...PLACES.map((p) => p.file), CHANGELOG])) {
    try {
      text[file] = fs.readFileSync(path.join(root, file), 'utf8');
    } catch {
      fail(`${file} not found in ${root}`, 2);
    }
  }
  const found = PLACES.map((p) => {
    const versions = all(text[p.file], p.pattern).map((m) => m[2]);
    if (versions.length === 0) fail(`${p.file}: no ${p.what} found; the script would silently skip it`, 2);
    return { ...p, versions };
  });
  // changelogTop is null until a first entry is dated: the version of apm.yml is then not released yet.
  const entry = text[CHANGELOG].match(ENTRY);
  if (!entry && !UNRELEASED.test(text[CHANGELOG]))
    fail(`${CHANGELOG}: no "## [Unreleased]" or "## [X.Y.Z] - YYYY-MM-DD" entry found`, 2);
  return { text, found, current: found[0].versions[0], changelogTop: entry ? entry[1] : null };
}

// What disagrees with apm.yml, as a list of sentences. Empty when everything agrees.
function check(root) {
  const s = readState(root);
  const problems = [];
  for (const p of s.found) {
    for (const v of new Set(p.versions))
      if (v !== s.current) problems.push(`${p.file}: ${p.what} says ${v}, apm.yml says ${s.current}`);
  }
  if (s.changelogTop !== null && s.changelogTop !== s.current)
    problems.push(`${CHANGELOG}: the top entry is ${s.changelogTop}, apm.yml says ${s.current}`);
  if (s.text[CHANGELOG].includes(PLACEHOLDER)) problems.push(`${CHANGELOG}: an entry still holds "${PLACEHOLDER}"`);
  return { current: s.current, problems };
}

function resolveTarget(arg, current) {
  const [major, minor, patch] = current.split('.').map(Number);
  if (arg === 'patch') return `${major}.${minor}.${patch + 1}`;
  if (arg === 'minor') return `${major}.${minor + 1}.0`;
  if (arg === 'major') return `${major + 1}.0.0`;
  const v = arg.replace(/^v/, '');
  if (!new RegExp(`^${VERSION}$`).test(v)) fail(`"${arg}" is not a version. Give X.Y.Z, or patch, minor or major.`, 2);
  return v;
}

function update(root, arg, { dryRun = false, today = new Date() } = {}) {
  const s = readState(root);
  const next = resolveTarget(arg, s.current);
  const released = s.changelogTop !== null;
  if (compare(next, s.current) < (released ? 1 : 0))
    fail(`${next} is ${released ? 'not higher than' : 'lower than'} the current version, ${s.current}.`);

  const out = { ...s.text };
  const changes = [];
  let placeholder = false;
  for (const p of s.found) {
    out[p.file] = out[p.file].replace(new RegExp(p.pattern.source, p.pattern.flags), (_, before) => `${before}${next}`);
    changes.push(`${p.file}: ${p.what} (${p.versions.length} place${p.versions.length > 1 ? 's' : ''})`);
  }
  if (s.changelogTop !== next) {
    const eol = out[CHANGELOG].includes('\r\n') ? '\r\n' : '\n';
    const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const heading = `## [${next}] - ${date}`;
    const entry = [heading, '', '### Changed', '', `- ${PLACEHOLDER}`, '', ''].join(eol);
    const log = out[CHANGELOG];
    const u = log.match(UNRELEASED);
    if (!u) {
      const at = log.search(ENTRY);
      out[CHANGELOG] = log.slice(0, at) + entry + log.slice(at);
      placeholder = true;
    } else {
      const rest = log.slice(u.index + u[0].length);
      const end = rest.search(/^## /m);
      if ((end === -1 ? rest : rest.slice(0, end)).trim()) {
        // Keep a Changelog: the content of [Unreleased] becomes the release, a fresh [Unreleased] opens above it.
        out[CHANGELOG] = `${log.slice(0, u.index)}## [Unreleased]${eol}${eol}${heading}${rest}`;
      } else {
        const filler = end === -1 ? entry.slice(0, -eol.length) : entry;
        out[CHANGELOG] =
          `${log.slice(0, u.index)}## [Unreleased]${eol}${eol}${filler}${end === -1 ? '' : rest.slice(end)}`;
        placeholder = true;
      }
    }
    changes.push(
      placeholder
        ? `${CHANGELOG}: new entry [${next}] - ${date}, to fill`
        : `${CHANGELOG}: [Unreleased] becomes [${next}] - ${date}, under a new empty [Unreleased]`,
    );
  }
  if (!dryRun)
    for (const [file, content] of Object.entries(out))
      if (content !== s.text[file]) fs.writeFileSync(path.join(root, file), content);
  return { from: s.current, to: next, changes, dryRun, placeholder };
}

function main(argv) {
  // npm keeps a flag typed after the script name (`npm run update-version minor --dry-run`) for itself.
  const opt = { root: REPO, dryRun: process.env.npm_config_dry_run === 'true' };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--check') opt.check = true;
    else if (a === '--dry-run') opt.dryRun = true;
    else if (a === '--root') {
      const dir = argv[++i];
      if (dir === undefined || dir.startsWith('-')) fail('--root needs a folder', 2);
      opt.root = path.resolve(dir);
    } else if (a === '--help' || a === '-h') opt.help = true;
    else if (a.startsWith('--')) fail(`unknown option ${a}`, 2);
    else rest.push(a);
  }
  const usage = 'npm run update-version <X.Y.Z | patch | minor | major>';
  if (opt.help) {
    console.log(usage);
    return 0;
  }
  if (opt.check) {
    const r = check(opt.root);
    if (r.problems.length === 0) {
      console.log(`Version ${r.current}: the four places agree.`);
      return 0;
    }
    console.log(`Version ${r.current} in apm.yml, but:`);
    for (const p of r.problems) console.log(`- ${p}`);
    return 1;
  }
  if (rest.length !== 1) {
    console.error(usage);
    return 2;
  }
  const r = update(opt.root, rest[0], { dryRun: opt.dryRun });
  console.log(`${r.dryRun ? 'Would set' : 'Set'} the version: ${r.from} -> ${r.to}`);
  for (const c of r.changes) console.log(`- ${c}`);
  if (!r.dryRun) {
    console.log(
      `\nNext:\n1. ${r.placeholder ? `Write what changed in ${CHANGELOG}, in place of "${PLACEHOLDER}".` : `Read the entry [${r.to}] of ${CHANGELOG}.`}\n2. npm test\n3. Commit, then: git tag -a v${r.to} -m "v${r.to}" && git push --follow-tags`,
    );
  }
  return 0;
}

// Run as a command, not when imported. Node resolves links for import.meta.url, not for argv[1].
const isMain = () => {
  try {
    return fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
};

if (process.argv[1] && isMain()) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (e) {
    console.error(`update-version: ${e.message}`);
    process.exitCode = e.exitCode ?? 2;
  }
}

export { check, PLACEHOLDER, update };
