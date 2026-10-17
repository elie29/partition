// Tests of scripts/update-version.mjs, the script that writes the version in the four places that carry it.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { repo, tmp } from './helpers.mjs';

const script = path.join(repo, 'scripts', 'update-version.mjs');
const { update, check, PLACEHOLDER } = await import(pathToFileURL(script).href);
const read = (dir, file) => fs.readFileSync(path.join(dir, file), 'utf8');
const run = (dir, ...args) => {
  try {
    return {
      code: 0,
      out: execFileSync('node', [script, '--root', dir, ...args], { encoding: 'utf8', stdio: 'pipe' }),
    };
  } catch (e) {
    return { code: e.status, out: `${e.stdout}${e.stderr}` };
  }
};
const project = (extra = {}) =>
  tmp({
    'apm.yml': 'name: partition\nversion: 0.1.0\ndescription: "x"\n',
    'README.md':
      '![Version](https://img.shields.io/badge/version-0.1.0-0b78a0.svg)\n\napm install elie29/partition#v0.1.0 --target claude\napm install elie29/partition#v0.1.0 --target copilot\n\n| patch: `0.1.0` to `0.1.1` |\ngit tag -a v0.2.0 -m "v0.2.0"\n',
    'SECURITY.md': 'pin a tag (`elie29/partition#v0.1.0`) rather than a branch.\n',
    'CHANGELOG.md': '# Changelog\n\n## [0.1.0] - 2026-06-05\n\nFirst version.\n',
    ...extra,
  });

test('a new version is written in the four places, and nowhere else', () => {
  const dir = project();
  const r = update(dir, '0.2.0', { today: new Date(2026, 10, 3) });
  assert.equal(r.from, '0.1.0');
  assert.equal(r.to, '0.2.0');
  assert.match(read(dir, 'apm.yml'), /^version: 0\.2\.0$/m);
  const readme = read(dir, 'README.md');
  assert.match(readme, /badge\/version-0\.2\.0-0b78a0/);
  assert.equal(readme.match(/elie29\/partition#v0\.2\.0/g).length, 2);
  assert.ok(readme.includes('| patch: `0.1.0` to `0.1.1` |'), 'an example in the prose is left alone');
  assert.match(read(dir, 'SECURITY.md'), /elie29\/partition#v0\.2\.0/);
  const log = read(dir, 'CHANGELOG.md');
  assert.ok(
    log.indexOf('## [0.2.0] - 2026-11-03') < log.indexOf('## [0.1.0] - 2026-06-05'),
    'the new entry comes first',
  );
  assert.ok(log.includes(PLACEHOLDER));
  assert.ok(log.includes('First version.'));
});

test('a release turns the content of [Unreleased] into the new dated entry, under a fresh empty [Unreleased]', () => {
  const dir = project({
    'CHANGELOG.md':
      '# Changelog\n\n## [Unreleased]\n\n### Added\n\n- A new skill.\n\n## [0.1.0] - 2026-06-05\n\nFirst version.\n',
  });
  update(dir, 'minor', { today: new Date(2026, 10, 3) });
  assert.equal(
    read(dir, 'CHANGELOG.md'),
    '# Changelog\n\n## [Unreleased]\n\n## [0.2.0] - 2026-11-03\n\n### Added\n\n- A new skill.\n\n## [0.1.0] - 2026-06-05\n\nFirst version.\n',
  );
  assert.equal(run(dir, '--check').code, 0);
});

test('an empty [Unreleased] stays on top, and the new entry below it holds the placeholder', () => {
  const dir = project({
    'CHANGELOG.md': '# Changelog\n\n## [Unreleased]\n\n## [0.1.0] - 2026-06-05\n\nFirst version.\n',
  });
  update(dir, 'minor', { today: new Date(2026, 10, 3) });
  assert.equal(
    read(dir, 'CHANGELOG.md'),
    `# Changelog\n\n## [Unreleased]\n\n## [0.2.0] - 2026-11-03\n\n### Changed\n\n- ${PLACEHOLDER}\n\n## [0.1.0] - 2026-06-05\n\nFirst version.\n`,
  );
});

test('before the first dated entry, the version of apm.yml is released as it is, and never a lower one', () => {
  const log = '# Changelog\r\n\r\n## [Unreleased]\r\n\r\nFirst version.\r\n';
  assert.equal(run(project({ 'CHANGELOG.md': log }), '--check').code, 0);
  assert.equal(run(project({ 'CHANGELOG.md': log }), '0.0.9').code, 1);
  const dir = project({ 'CHANGELOG.md': log });
  assert.equal(update(dir, '0.1.0', { today: new Date(2026, 10, 3) }).to, '0.1.0');
  assert.equal(
    read(dir, 'CHANGELOG.md'),
    '# Changelog\r\n\r\n## [Unreleased]\r\n\r\n## [0.1.0] - 2026-11-03\r\n\r\nFirst version.\r\n',
  );
  assert.equal(run(dir, '0.1.0').code, 1, 'once dated, the same version is no longer higher');
});

test('a changelog with neither [Unreleased] nor a dated entry stops the script', () => {
  const r = run(project({ 'CHANGELOG.md': '# Changelog\n' }), '--check');
  assert.equal(r.code, 2);
  assert.match(r.out, /no "## \[Unreleased\]" or "## \[X\.Y\.Z\] - YYYY-MM-DD" entry found/);
});

test('--root without a folder is refused instead of falling back to the current folder', () => {
  // Run from inside a valid project: falling back to the current folder would pass the check.
  for (const args of [
    ['--check', '--root'],
    ['--root', '--check'],
  ]) {
    let r = { code: 0, out: '' };
    try {
      execFileSync('node', [script, ...args], { cwd: project(), encoding: 'utf8', stdio: 'pipe' });
    } catch (e) {
      r = { code: e.status, out: e.stderr };
    }
    assert.equal(r.code, 2, args.join(' '));
    assert.match(r.out, /--root needs a folder/, args.join(' '));
  }
});

test('patch, minor and major are computed from the current version', () => {
  assert.equal(update(project(), 'patch').to, '0.1.1');
  assert.equal(update(project(), 'minor').to, '0.2.0');
  assert.equal(update(project(), 'major').to, '1.0.0');
  assert.equal(update(project(), 'v0.3.0').to, '0.3.0');
});

test('a version that is not higher, or not a version, is refused and nothing is written', () => {
  const dir = project();
  const before = read(dir, 'apm.yml');
  assert.equal(run(dir, '0.1.0').code, 1);
  assert.equal(run(dir, '0.0.9').code, 1);
  assert.equal(run(dir, 'banana').code, 2);
  assert.equal(run(dir).code, 2);
  assert.equal(run(dir, '--nope').code, 2);
  assert.equal(read(dir, 'apm.yml'), before);
});

test('--dry-run says what would change and writes nothing', () => {
  const dir = project();
  const r = run(dir, 'minor', '--dry-run');
  assert.equal(r.code, 0);
  assert.match(r.out, /Would set the version: 0\.1\.0 -> 0\.2\.0/);
  assert.match(read(dir, 'apm.yml'), /^version: 0\.1\.0$/m);
});

test('--check passes when the four places agree, and names each one that does not', () => {
  assert.equal(run(project(), '--check').code, 0);
  const drift = run(project({ 'SECURITY.md': 'pin a tag (`elie29/partition#v0.0.9`).\n' }), '--check');
  assert.equal(drift.code, 1);
  assert.match(drift.out, /SECURITY\.md: pinned tag example says 0\.0\.9, apm\.yml says 0\.1\.0/);
  const old = check(project({ 'CHANGELOG.md': '# Changelog\n\n## [0.0.9] - 2026-09-01\n' }));
  assert.deepEqual(old.problems, ['CHANGELOG.md: the top entry is 0.0.9, apm.yml says 0.1.0']);
});

test('--check fails while the new changelog entry still holds its placeholder', () => {
  const dir = project();
  assert.equal(run(dir, 'minor').code, 0);
  const r = run(dir, '--check');
  assert.equal(r.code, 1);
  assert.match(r.out, /TODO: say what changed/);
  fs.writeFileSync(path.join(dir, 'CHANGELOG.md'), read(dir, 'CHANGELOG.md').replace(PLACEHOLDER, 'A new skill.'));
  assert.equal(run(dir, '--check').code, 0);
});

test('a place that carries no version stops the script instead of being skipped', () => {
  const r = run(project({ 'README.md': 'no badge here\n' }), 'minor');
  assert.equal(r.code, 2);
  assert.match(r.out, /README\.md: no version badge found/);
});

test('Windows line endings are kept in the changelog', () => {
  const dir = project({ 'CHANGELOG.md': '# Changelog\r\n\r\n## [0.1.0] - 2026-06-05\r\n\r\nFirst version.\r\n' });
  update(dir, 'minor');
  assert.ok(!/[^\r]\n/.test(read(dir, 'CHANGELOG.md')), 'no bare line feed');
});

test('the script runs when reached through a link to its folder', () => {
  const dir = project();
  const link = path.join(tmp(), 'linked');
  fs.symlinkSync(path.dirname(script), link, 'junction');
  const out = execFileSync('node', [path.join(link, 'update-version.mjs'), '--root', dir, '--check'], {
    encoding: 'utf8',
    stdio: 'pipe',
  });
  assert.match(out, /the four places agree/);
});

test('npm run update-version minor --dry-run writes nothing: npm keeps the flag in npm_config_dry_run', () => {
  const dir = project();
  const before = read(dir, 'apm.yml');
  const out = execFileSync('node', [script, '--root', dir, 'minor'], {
    encoding: 'utf8',
    stdio: 'pipe',
    env: { ...process.env, npm_config_dry_run: 'true' },
  });
  assert.match(out, /Would set the version: 0\.1\.0 -> 0\.2\.0/);
  assert.equal(read(dir, 'apm.yml'), before);
});

test('in this repository the four places agree', () => {
  assert.deepEqual(check(repo).problems, []);
});
