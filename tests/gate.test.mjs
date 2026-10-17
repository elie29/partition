// Tests of the partition-gate scripts, in a throwaway git repository. Skipped where Bash or Python 3 is missing.
// Bash, git and Python start slowly on Windows: the tests run concurrently, each in its own directory.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import { repo, spawnAsync, tmp } from './helpers.mjs';

const scripts = path.join(repo, '.apm/skills/partition-gate/scripts');
const git = async (dir, ...args) => {
  const r = await spawnAsync('git', ['-C', dir, ...args]);
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
};
const commit = async (dir, files, message) => {
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), content);
  }
  await git(dir, 'add', '-A');
  await git(dir, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', message);
};
const gitRepo = async (files) => {
  const dir = tmp();
  await git(dir, 'init', '-q');
  await commit(dir, files, 'base');
  return dir;
};
// The tests whose script stops before reading the repository share one, made once.
let oneFile;
const oneFileRepo = () => (oneFile ??= gitRepo({ 'a.txt': 'a\n' }));

// A Bash that cannot reach a native path of this machine (WSL from Windows) cannot run the scripts.
const probe = tmp();
const hasBash =
  spawnSync('git', ['--version']).status === 0 &&
  spawnSync('bash', ['-c', 'cd "$1"', '_', probe], { timeout: 10000 }).status === 0;
const bashTest = (name, fn) => test(name, { skip: !hasBash && 'Bash or git not available' }, fn);
// A hang shows as a timeout. Bash forks slowly on Windows, the more so beside the concurrent tests: a full run
// takes up to a minute alone, so it gets three.
const bash = (script, dir, ...args) => bashWithin(180000, script, dir, ...args);
const bashWithin = (timeout, script, dir, ...args) =>
  spawnAsync('bash', [path.join(scripts, script), ...args], { cwd: dir, timeout });

let python = null;
for (const p of [['python3'], ['python'], ['py', '-3']]) {
  const r = spawnSync(p[0], [...p.slice(1), '--version'], { encoding: 'utf8' });
  if (r.status === 0 && /^Python 3\./.test(r.stdout + r.stderr)) {
    python = p;
    break;
  }
}
const pyTest = (name, fn) =>
  test(
    name,
    { skip: !(python && spawnSync('git', ['--version']).status === 0) && 'Python 3 or git not available' },
    fn,
  );
const coverage = (dir, report, ...args) => {
  fs.writeFileSync(path.join(dir, 'lcov.info'), report);
  return spawnAsync(
    python[0],
    [...python.slice(1), path.join(scripts, 'diff_coverage.py'), '--coverage', 'lcov.info', ...args],
    { cwd: dir, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } },
  );
};

describe('partition-gate scripts', { concurrency: true }, () => {
  for (const [script, options] of [
    ['collect_change_context.sh', ['--rev', '--range', '--out', '--repo']],
    ['detect_test_tampering.sh', ['--rev', '--range', '--repo']],
  ]) {
    for (const option of options)
      bashTest(`${script} stops with exit 2 when ${option} is the last argument, without its value`, async () => {
        const r = await bashWithin(15000, script, await oneFileRepo(), option);
        assert.equal(r.error, undefined, 'the script hangs');
        assert.equal(r.status, 2, r.stdout + r.stderr);
        assert.match(r.stderr, new RegExp(`${option} requires a value`));
      });
    bashTest(`${script} prints its whole usage comment as help, and nothing of the code`, async () => {
      const r = await bash(script, await oneFileRepo(), '--help');
      assert.equal(r.status, 0, r.stderr);
      assert.match(r.stdout, /^# \S+\.sh — /);
      assert.doesNotMatch(r.stdout.trimEnd(), /set -uo pipefail|^[ \t]*$/m);
    });
  }

  bashTest(
    'detect_test_tampering.sh refuses an empty --range instead of comparing the tree with the index',
    async () => {
      const r = await bash('detect_test_tampering.sh', await oneFileRepo(), '--range', '');
      assert.equal(r.status, 2, r.stdout);
      assert.match(r.stderr, /--range requires/);
    },
  );

  bashTest('the triage keeps whole names with spaces, and the new name of a copy or a rename', async () => {
    const core = 'export const line = 1;\n'.repeat(20);
    const dir = await gitRepo({ 'lib/core.js': core });
    // git -C reports a copy only when its source changes in the same commit
    await commit(dir, { 'auth area/login form.js': core, 'lib/core.js': `${core}export const more = 2;\n` }, 'copy');
    const out = tmp();
    const r = await bash('collect_change_context.sh', dir, '--rev', 'HEAD', '--out', out);
    assert.equal(r.status, 0, r.stderr);
    assert.match(fs.readFileSync(path.join(out, 'files.txt'), 'utf8'), /^C/m, 'git reports a copy');
    assert.match(r.stdout, /\[sensitive\] {2}auth area\/login form\.js$/m);
    assert.doesNotMatch(r.stdout, /\[sensitive\] {2}lib\/core\.js/);
  });

  bashTest('the scripts audit from a base commit to the working tree when --range names one commit', async () => {
    const dir = await gitRepo({ 'a.txt': 'a\n' });
    const base = await git(dir, 'rev-parse', 'HEAD');
    await commit(dir, { 'b.txt': 'b\n' }, 'task 1');
    fs.writeFileSync(path.join(dir, 'c.txt'), 'c\n');
    await git(dir, 'add', 'c.txt');
    const out = tmp();
    const [r, tampering] = await Promise.all([
      bash('collect_change_context.sh', dir, '--range', base, '--out', out),
      bash('detect_test_tampering.sh', dir, '--range', base),
    ]);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(fs.readFileSync(path.join(out, 'files.txt'), 'utf8'), 'A\tb.txt\nA\tc.txt\n');
    assert.equal(tampering.status, 0);
  });

  pyTest('diff coverage reads a non-ASCII path and non-ASCII content as UTF-8', async () => {
    const dir = await gitRepo({ 'README.md': 'x\n' });
    await commit(dir, { 'src/café.py': 'name = "é"\n' }, 'add');
    const r = await coverage(dir, 'SF:src/café.py\nDA:1,1\nend_of_record\n', '--rev', 'HEAD');
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /DIFF COVERAGE: 1\/1 changed lines executed = 100\.0%/);
    assert.doesNotMatch(r.stdout, /NOT MEASURED/);
  });

  pyTest('diff coverage never matches a changed file to another file of the same name in another folder', async () => {
    const dir = await gitRepo({ 'README.md': 'x\n' });
    await commit(dir, { 'src/billing/util.py': 'a = 1\n' }, 'add');
    const r = await coverage(dir, 'SF:/app/src/shipping/util.py\nDA:1,1\nend_of_record\n', '--rev', 'HEAD');
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /NOT MEASURED[^\n]*\n {2}src\/billing\/util\.py/);
    assert.match(r.stdout, /DIFF COVERAGE: 0\/0/);
  });

  pyTest('diff coverage still matches a report written with an absolute path prefix', async () => {
    const dir = await gitRepo({ 'README.md': 'x\n' });
    await commit(dir, { 'src/billing/util.py': 'a = 1\n' }, 'add');
    const r = await coverage(dir, 'SF:/app/src/billing/util.py\nDA:1,0\nend_of_record\n', '--rev', 'HEAD');
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /DIFF COVERAGE: 0\/1 changed lines executed/);
  });

  pyTest('diff coverage reads a report whose paths use backslashes, as JaCoCo writes them on Windows', async () => {
    const dir = await gitRepo({ 'README.md': 'x\n' });
    await commit(dir, { 'src/billing/util.py': 'a = 1\n' }, 'add');
    const r = await coverage(dir, 'SF:src\\billing\\util.py\nDA:1,1\nend_of_record\n', '--rev', 'HEAD');
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /DIFF COVERAGE: 1\/1 changed lines executed = 100\.0%/);
  });
});
