// Checks on the guide "a project step by step": its links, its provided folders, and the catalog versions it hands over.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { repo, contractPath } from './helpers.mjs';

const { inventory } = await import(contractPath);
const guide = 'docs/guides/a-project-step-by-step';
const guideDir = path.join(repo, guide);
const pages = fs.readdirSync(guideDir).filter((n) => n.endsWith('.md'));
const provided = fs
  .readdirSync(guideDir, { withFileTypes: true })
  .filter((e) => e.isDirectory() && /^\d\d-provided$/.test(e.name))
  .map((e) => e.name);
const read = (name) => fs.readFileSync(path.join(guideDir, name), 'utf8');
const outsideFences = (text) => text.replace(/^```[\s\S]*?^```/gm, '');
const walk = (dir) =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));

test('every relative link of the guide resolves', () => {
  const broken = [];
  for (const page of pages)
    for (const [, target] of outsideFences(read(page)).matchAll(/\]\(([^)\s]+)\)/g)) {
      if (/^[a-z]+:/i.test(target) || target.startsWith('#')) continue;
      const file = decodeURIComponent(target.split('#')[0]);
      if (!fs.existsSync(path.resolve(guideDir, file))) broken.push(`${page} -> ${target}`);
    }
  assert.deepEqual(broken, []);
});

test('every provided folder is copied by its own step, and every folder a step copies exists', () => {
  // A step copies its folder by linking it whole, with no command: the reader may keep the guide anywhere.
  const copy = /\]\((\d\d-provided)\/\)/g;
  const named = new Set();
  for (const page of pages) {
    assert.ok(!/\bcp -r\b/.test(read(page)), `${page} carries a copy command`);
    for (const [, folder] of outsideFences(read(page)).matchAll(copy)) {
      assert.ok(provided.includes(folder), `${page} copies ${folder}, which does not exist`);
      assert.ok(page.startsWith(folder.slice(0, 2)), `${page} copies the folder of another step, ${folder}`);
      named.add(folder);
    }
  }
  for (const name of fs.readdirSync(guideDir).filter((n) => /provided/.test(n)))
    assert.ok(/^\d\d-provided$/.test(name), `${name} is not named NN-provided`);
  for (const folder of provided) {
    const ownPage = pages.find((p) => p.startsWith(folder.slice(0, 2)));
    assert.ok(ownPage, `${folder} has no step page`);
    const files = walk(path.join(guideDir, folder)).map((f) => path.relative(guideDir, f).split(path.sep).join('/'));
    // A folder holding only files at its root is pasted in the chat; any other mirrors the project and is copied.
    const pasted = files.every((f) => f.split('/').length === 2);
    assert.ok(pasted || named.has(folder), `${ownPage} does not copy ${folder}`);
    for (const f of files) assert.ok(read(ownPage).includes(`(${f})`), `${ownPage} does not link ${f}`);
  }
});

test('every provided JSON file parses', () => {
  for (const folder of provided)
    for (const file of walk(path.join(guideDir, folder)).filter((f) => f.endsWith('.json')))
      assert.doesNotThrow(() => JSON.parse(fs.readFileSync(file, 'utf8')), file);
});

test('nothing in the guides is loaded here as an instruction, and Prettier leaves the provided files as written', () => {
  const settings = JSON.parse(fs.readFileSync(path.join(repo, '.claude/settings.json'), 'utf8'));
  // The second pattern names the dot folder: a glob's ** may not cross a segment that starts with a dot.
  for (const pattern of ['**/docs/guides/**', '**/docs/guides/**/.claude/**'])
    assert.ok(settings.claudeMdExcludes?.includes(pattern), `claudeMdExcludes lacks ${pattern}`);
  assert.match(fs.readFileSync(path.join(repo, '.claude/CLAUDE.md'), 'utf8'), /NN-provided/);
  assert.match(fs.readFileSync(path.join(repo, '.prettierignore'), 'utf8'), /^docs\/guides\/\*\/\*-provided\/$/m);
});

const catalog = [
  { folder: '08-provided', version: '1.0.0', total: 9, tags: ['Product', 'PriceList', 'Discount'] },
  { folder: '11-provided', version: '1.1.0', total: 9, tags: ['Product', 'PriceList', 'Discount'] },
  { folder: '15-provided', version: '2.0.0', total: 7, tags: ['Product', 'PriceList'] },
];
for (const c of catalog) {
  const file = path.join(guideDir, c.folder, 'docs/contracts/catalog.openapi.json');
  test(`catalog ${c.version} holds what the steps say`, { skip: !fs.existsSync(file) && 'not provided yet' }, () => {
    const contract = JSON.parse(fs.readFileSync(file, 'utf8'));
    const r = inventory(contract, 'tag:Product; tag:PriceList');
    assert.equal(r.version, c.version);
    assert.equal(r.total, c.total);
    assert.equal(r.inScope, 7);
    assert.deepEqual(r.tags.map((t) => t.tag).sort(), [...c.tags].sort());
    assert.deepEqual(
      r.outOfScope.map((o) => o.operationId).sort(),
      c.total === 9 ? ['createDiscount', 'getDiscount'] : [],
    );
    // The rules of step 08 come from the business analyst: no response may state a uniqueness.
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /already|_TAKEN|unique/i);
  });
}

// Every step opens on The problem and closes Expected on The shape after.
const steps = pages.filter((n) => /^\d\d-/.test(n));
const reshaped = steps.map((n) => n.slice(0, 2));
const unchangedShape = ['09', '18'];

for (const page of steps.filter((n) => reshaped.includes(n.slice(0, 2)))) {
  test(`${page}: the problem opens the step, the shape after closes Expected`, () => {
    const text = read(page);
    const heads = [...outsideFences(text).matchAll(/^(#{2,3}) (.+)$/gm)].map((m) => `${m[1]} ${m[2]}`);
    assert.deepEqual(
      heads.filter((h) => h.startsWith('## ')),
      ['## The problem', '## Before', '## Provided', '## Prompt', '## Expected', '## Verdict'],
    );
    const at = heads.indexOf('### The shape after');
    assert.ok(at > -1, 'no ### The shape after');
    assert.equal(heads[at + 1], '## Verdict', '### The shape after is not the last part of Expected');
    const body = text.slice(text.indexOf('### The shape after'), text.indexOf('## Verdict'));
    if (unchangedShape.includes(page.slice(0, 2))) {
      assert.match(body, /\]\(\d\d-[a-z0-9-]+\.md#the-shape-after\)/, 'no link to the last figure');
      assert.doesNotMatch(body, /```mermaid/);
      return;
    }
    const figure = body.match(/```mermaid\n([\s\S]*?)```/)?.[1];
    assert.ok(figure, 'no mermaid figure');
    assert.match(figure, /^flowchart LR$/m);
    assert.equal(
      (figure.match(/^\s*subgraph\b/gm) ?? []).length,
      (figure.match(/^\s*end\s*$/gm) ?? []).length,
      'a subgraph without its end',
    );
    assert.doesNotMatch(figure, /\b[a-z0-9_]*-[a-z0-9_-]*(?=\s*[[(])/, 'a hyphen in an id');
    assert.doesNotMatch(figure, /\w(\[\/|\[\(|\(\[|\[(?![/(])|\((?!\[))(?!")/, 'a label without quotes');
    assert.doesNotMatch(figure, /fill:|color:|^\s*style /m, 'a colour: the figure must read in both themes');
    assert.match(body, /^\*\*New:\*\*/m);
    assert.match(body, /^\*\*Cost:\*\*/m);
  });
}

test('the story of the README tells every step once, in order, each linked to its shape', () => {
  const readme = read('README.md');
  const story = readme.slice(
    readme.indexOf('## The story'),
    readme.indexOf('\n## ', readme.indexOf('## The story') + 1),
  );
  const linked = [...story.matchAll(/\]\((\d\d-[a-z0-9-]+\.md)#the-shape-after\)/g)].map((m) => m[1]);
  assert.deepEqual(linked, steps);
});
