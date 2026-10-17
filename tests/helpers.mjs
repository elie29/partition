// Partition - what every test file shares. The tests run on node:test: npm test, or node --test tests/<file>.test.mjs.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = (skill, name) => pathToFileURL(path.join(repo, '.apm/skills', skill, 'scripts', name)).href;

export const budgetPath = script('partition-budget', 'budget.mjs');
export const c4Path = script('partition-c4', 'c4-drawio.mjs');
export const contractPath = script('partition-shape', 'contract.mjs');

// Creates a throwaway directory holding the given { 'relative/path': 'content' } files.
export function tmp(files = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'partition-'));
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), content);
  }
  return dir;
}

export const x = (count) => 'x'.repeat(count);

// spawnSync's { status, stdout, stderr, error } without blocking, so the tests that launch processes run
// concurrently. stdin is closed as spawnSync closes it; past `timeout` ms the process is killed and `error` set.
// On Windows, Git's bash.exe is a launcher: killing it alone leaves the real Bash running and holding the
// pipes, so the whole tree is killed and the result returned without waiting for the pipes to close.
export function spawnAsync(command, args, { timeout, ...options } = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '',
      stderr = '',
      error,
      settled = false;
    child.stdout.setEncoding('utf8').on('data', (chunk) => (stdout += chunk));
    child.stderr.setEncoding('utf8').on('data', (chunk) => (stderr += chunk));
    const timer =
      timeout &&
      setTimeout(() => {
        error = new Error(`${command} timed out after ${timeout} ms`);
        if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f']);
        else child.kill();
        child.stdout.destroy();
        child.stderr.destroy();
        settle(null);
      }, timeout);
    const settle = (status) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ status, stdout, stderr, error });
    };
    child.on('error', (e) => {
      error ??= e;
      if (child.pid === undefined) settle(null);
    });
    child.on('close', settle);
  });
}

// A copy of a directory holding a git repository: the repository is made once, each test copies it.
export const copyOf = (dir) => {
  const copy = tmp();
  fs.cpSync(dir, copy, { recursive: true });
  return copy;
};
