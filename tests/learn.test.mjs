// Checks on the getting-started series under docs/learn/: its links, its Liquid safety, its images and its landing page.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { repo } from './helpers.mjs';

const learn = 'docs/learn';
const learnDir = path.join(repo, learn);
const pages = fs.readdirSync(learnDir).filter((n) => n.endsWith('.md'));
const articles = pages.filter((n) => /^\d\d-.+\.md$/.test(n));
const read = (name) => fs.readFileSync(path.join(learnDir, name), 'utf8');
const outsideFences = (text) => text.replace(/^```[\s\S]*?^```/gm, '');
const targets = (text) => [...outsideFences(text).matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1]);
const isExternal = (target) => /^[a-z][a-z0-9+.-]*:/i.test(target);
const onMain = /^https:\/\/github\.com\/elie29\/partition\/(blob|tree)\/main\//;

test('every relative link of the series resolves', () => {
  const broken = [];
  for (const page of pages)
    for (const target of targets(read(page))) {
      if (isExternal(target) || target.startsWith('#')) continue;
      const file = decodeURIComponent(target.split('#')[0]);
      if (!fs.existsSync(path.resolve(learnDir, file))) broken.push(`${page} -> ${target}`);
    }
  assert.deepEqual(broken, []);
});

test('every relative link of the series stays inside it or reaches assets/', () => {
  const outside = [];
  for (const page of pages)
    for (const target of targets(read(page))) {
      if (isExternal(target) || target.startsWith('#')) continue;
      const file = decodeURIComponent(target.split('#')[0]);
      const resolved = path.relative(repo, path.resolve(learnDir, file)).split(path.sep).join('/');
      if (!resolved.startsWith(`${learn}/`) && !resolved.startsWith('assets/')) outside.push(`${page} -> ${target}`);
    }
  assert.deepEqual(outside, []);
});

const slug = (heading) =>
  heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
const anchors = (name) => {
  const seen = new Map();
  return [...outsideFences(read(name)).matchAll(/^#{1,6}\s+(.+?)\s*#*\s*$/gm)].map((m) => {
    const base = slug(m[1]);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count ? `${base}-${count}` : base;
  });
};

test('every #anchor link between the articles of the series names a heading', () => {
  const broken = [];
  for (const page of pages)
    for (const target of targets(read(page))) {
      if (isExternal(target) || !target.includes('#')) continue;
      const [file, anchor] = target.split('#');
      const name = file ? path.relative(learnDir, path.resolve(learnDir, decodeURIComponent(file))) : page;
      if (!pages.includes(name)) continue;
      if (!anchors(name).includes(decodeURIComponent(anchor))) broken.push(`${page} -> ${target}`);
    }
  assert.deepEqual(broken, []);
});

test('every absolute link into the repository names elie29/partition on main', () => {
  const wrong = [];
  for (const page of pages)
    for (const target of targets(read(page))) {
      if (!/^https?:\/\/(www\.)?github\.com\/elie29\//i.test(target)) continue;
      if (!onMain.test(target)) {
        wrong.push(`${page} -> ${target}`);
        continue;
      }
      const file = decodeURIComponent(target.replace(onMain, '').split('#')[0]);
      if (!fs.existsSync(path.join(repo, file))) wrong.push(`${page} -> ${target} (no such path)`);
    }
  assert.deepEqual(wrong, []);
});

test('no Liquid tag in the series', () => {
  for (const page of pages) assert.doesNotMatch(read(page), /\{\{|\{%/, `${page} holds a Liquid tag`);
});

test('every image of the series has alt text', () => {
  const bare = [];
  for (const page of pages)
    for (const m of outsideFences(read(page)).matchAll(/!\[([^\]]*)\]\(([^)\s]+)\)/g))
      if (!m[1].trim()) bare.push(`${page} -> ${m[2]}`);
  assert.deepEqual(bare, []);
});

test('the landing page links every article, and every article links back to it', () => {
  assert.ok(pages.includes('README.md'), 'no landing page');
  const landing = targets(read('README.md')).map((t) => t.split('#')[0]);
  for (const article of articles) {
    assert.ok(landing.includes(article), `README.md does not link ${article}`);
    assert.ok(
      targets(read(article)).some((t) => t.split('#')[0] === 'README.md'),
      `${article} does not link README.md`,
    );
  }
});

test('neither the README nor the series frames Partition by green field', () => {
  const framed = [];
  if (/green.?field/i.test(fs.readFileSync(path.join(repo, 'README.md'), 'utf8'))) framed.push('README.md');
  for (const page of pages) if (/green.?field/i.test(read(page))) framed.push(`${learn}/${page}`);
  assert.deepEqual(framed, []);
});

const pagesWorkflow = fs.readFileSync(path.join(repo, '.github/workflows/pages.yml'), 'utf8');
const pagesJob = (name) => {
  const start = pagesWorkflow.search(new RegExp(`^  ${name}:`, 'm'));
  assert.ok(start >= 0, `no job ${name}`);
  const next = pagesWorkflow.slice(start + 1).search(/^ {2}[\w-]+:/m);
  return next < 0 ? pagesWorkflow.slice(start) : pagesWorkflow.slice(start, start + 1 + next);
};

test('the Pages workflow runs only in elie29/partition', () => {
  const jobs = [...pagesWorkflow.split(/^jobs:$/m)[1].matchAll(/^ {2}([\w-]+):\s*$/gm)].map((m) => m[1]);
  assert.deepEqual(jobs.sort(), ['build', 'deploy']);
  for (const name of jobs)
    assert.match(pagesJob(name), /^ {4}if: github\.repository == 'elie29\/partition'[ \n]/m, name);
});

test('the Pages workflow waits for the repository to be public', () => {
  for (const name of ['build', 'deploy'])
    assert.match(
      pagesJob(name),
      /^ {4}if: github\.repository == 'elie29\/partition' && github\.event\.repository\.visibility == 'public'$/m,
      name,
    );
});

test('the Pages workflow writes only in its deploy job', () => {
  assert.match(pagesWorkflow, /^permissions:\n {2}contents: read\n\n/m);
  assert.deepEqual(pagesWorkflow.match(/^\s*(?:pages|id-token|contents): write/gm) ?? [], [
    '      pages: write',
    '      id-token: write',
  ]);
  assert.match(pagesJob('deploy'), /^ {4}permissions:\n {6}pages: write\n {6}id-token: write\n/m);
  const build = pagesJob('build').match(/^ {4}permissions:\n((?: {6}.+\n)+)/m);
  assert.ok(build, 'the build job needs pages: read for configure-pages');
  assert.deepEqual(
    build[1]
      .trim()
      .split('\n')
      .map((l) => l.trim()),
    ['contents: read', 'pages: read'],
  );
  assert.doesNotMatch(build[1], /write/);
  const checkouts = pagesWorkflow.split(/^\s*- /m).filter((st) => /uses:\s*actions\/checkout@/.test(st));
  assert.ok(checkouts.length >= 1);
  for (const st of checkouts) assert.match(st, /persist-credentials: false/);
});

test('every uses: of the Pages workflow is pinned by a sha', () => {
  const uses = [...pagesWorkflow.matchAll(/^\s*(?:- )?uses:\s*(.+)$/gm)].map((m) => m[1]);
  assert.ok(uses.length >= 5);
  for (const u of uses) assert.match(u, /^[\w.-]+\/[\w.-]+@[0-9a-f]{40} # v\d+\.\d+\.\d+$/, u);
});

const layoutFile = path.join(learnDir, '_layouts/default.html');

test("the site's layout draws the series sidebar", () => {
  assert.ok(fs.existsSync(layoutFile), 'no docs/learn/_layouts/default.html');
  const layout = fs.readFileSync(layoutFile, 'utf8');
  for (const part of [
    '{% seo %}',
    '/assets/css/style.css',
    '{{ content }}',
    `p.dir == '/docs/learn/'`,
    'sort: "name"',
    'aria-current="page"',
  ])
    assert.ok(layout.includes(part), `the layout lacks ${part}`);
  assert.match(layout, /<nav [^>]*aria-label="[^"]+"/);
  const hrefs = [...layout.matchAll(/href="(\{\{.*?\}\})"/g)].map((m) => m[1]);
  assert.ok(hrefs.length >= 3);
  for (const href of hrefs) assert.match(href, /\| relative_url \}\}$|site\.github|site\.author\.url/, href);
});

test("the site's footer names the author on every page", () => {
  const config = fs.readFileSync(path.join(learnDir, '_config.yml'), 'utf8');
  assert.match(config, /^author:\n {2}name: Elie Nehme\n {2}url: https:\/\/elienehme\.fr$/m);
  const layout = fs.readFileSync(layoutFile, 'utf8');
  const footer = layout.match(/<footer[^>]*>([\s\S]*?)<\/footer>/);
  assert.ok(footer, 'the layout has no <footer>');
  const author = footer[1].split('{% if')[0];
  for (const part of ['{{ site.author.name }}', 'href="{{ site.author.url }}"', '{{ site.time | date: "%Y" }}'])
    assert.ok(author.includes(part), `the footer lacks ${part} outside any condition`);
});

test('the Pages workflow puts the series layout at the site root', () => {
  assert.match(pagesWorkflow, /^ +mv _site_src\/docs\/learn\/_layouts _site_src\/_layouts$/m);
});
