// Checks on the package itself: its own budget, what it must not contain, and that every file a skill cites exists.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { repo, budgetPath, c4Path, tmp } from './helpers.mjs';

const { measurePackage, parseYaml, validate, SCHEMA_KEYWORDS } = await import(budgetPath);
const read = (rel) => fs.readFileSync(path.join(repo, rel), 'utf8');
const walk = (dir) =>
  fs
    .readdirSync(path.join(repo, dir), { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]));
const skillsDir = '.apm/skills';
const skills = fs.readdirSync(path.join(repo, skillsDir)).sort();
const frontmatter = (text) => {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  const meta = {};
  for (const line of (m?.[1] ?? '').split('\n')) {
    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    if (kv) meta[kv[1]] = kv[2].replace(/^"|"$/g, '');
  }
  return meta;
};

test('the always-loaded surface stays under 2 000 tokens and every SKILL.md under 3 000', () => {
  const r = measurePackage(repo, 2000, 3000);
  assert.ok(!r.alwaysOver, `always loaded: ${r.alwaysTokens} tokens`);
  assert.deepEqual(
    r.skills.filter((s) => s.over).map((s) => `${s.folder} ${s.tokens}`),
    [],
  );
});

test('there are twelve skills, each named after its folder, each with a description APM accepts', () => {
  assert.equal(skills.length, 12, skills.join(', '));
  for (const s of skills) {
    const meta = frontmatter(read(`${skillsDir}/${s}/SKILL.md`));
    assert.equal(meta.name, s);
    assert.ok(/^partition-[a-z0-9-]+$/.test(s), s);
    assert.ok(
      meta.description && meta.description.length <= 1024,
      `${s}: description of ${meta.description?.length} characters`,
    );
  }
});

test('every skill carries the license, since APM deploys the skill folder without the root LICENSE', () => {
  const license = read('LICENSE');
  for (const s of skills) {
    assert.equal(frontmatter(read(`${skillsDir}/${s}/SKILL.md`)).license, 'MIT', s);
    assert.ok(fs.existsSync(path.join(repo, skillsDir, s, 'LICENSE')), `${s}: no LICENSE`);
    assert.equal(read(`${skillsDir}/${s}/LICENSE`), license, `${s}: LICENSE differs from the root one`);
  }
});

test('every asset, reference and script a skill cites exists in that skill', () => {
  const missing = [];
  for (const s of skills) {
    const files = walk(`${skillsDir}/${s}`).filter((f) => f.endsWith('.md'));
    for (const f of files) {
      // A path may belong to another skill when the same line names that skill.
      for (const line of read(f).split('\n')) {
        const owners = [s, ...[...line.matchAll(/`(partition-[a-z0-9-]+)`/g)].map((m) => m[1])];
        for (const m of line.matchAll(/`((?:assets|references|scripts)\/[A-Za-z0-9_./-]+)`/g)) {
          const cited = m[1].replace(/\/$/, '');
          if (!owners.some((o) => fs.existsSync(path.join(repo, skillsDir, o, cited))))
            missing.push(`${f} cites ${m[1]}`);
        }
      }
    }
  }
  assert.deepEqual(missing, []);
});

test('no SKILL.md names a language, a framework or a vendor of the project under work', () => {
  const words =
    /\b(java|kotlin|php|typescript|spring|quarkus|angular|react|vue|laravel|symfony|django|rails|hibernate|jpa|mongodb|postgresql|mysql|dotnet|\.net|jacoco|cobertura|npm|maven|gradle|composer|docker|dockerfile|package\.json|pom\.xml)\b/i;
  const hits = [];
  for (const s of skills)
    read(`${skillsDir}/${s}/SKILL.md`)
      .split('\n')
      .forEach((line, i) => {
        if (words.test(line)) hits.push(`${s}:${i + 1}: ${line.trim().slice(0, 80)}`);
      });
  assert.deepEqual(hits, []);
});

test('nothing runs unasked: no hook primitive, no MCP server, no dependency in what ships', () => {
  assert.ok(!fs.existsSync(path.join(repo, '.apm/hooks')), '.apm/hooks');
  assert.ok(!fs.existsSync(path.join(repo, 'hooks')), 'hooks');
  const manifest = parseYaml(read('apm.yml'), 'apm.yml');
  assert.deepEqual(manifest.dependencies, { apm: [], mcp: [] });
  const pkg = fs.existsSync(path.join(repo, 'package.json')) ? JSON.parse(read('package.json')) : {};
  assert.equal(pkg.dependencies, undefined, 'package.json: dependencies');
  const scripts = walk('.apm')
    .filter((f) => /\/scripts\//.test(f) || /\/hook\//.test(f))
    .filter((f) => !f.endsWith('.json'));
  assert.deepEqual(
    scripts.filter((f) => !/\.(mjs|py|sh)$/.test(f)),
    [],
  );
  for (const f of scripts.filter((x) => x.endsWith('.mjs'))) {
    // Static imports on one line or several, bare imports and dynamic imports alike.
    const imports = [...read(f).matchAll(/\bfrom\s+['"]([^'"]+)['"]|\bimport\s*\(?\s*['"]([^'"]+)['"]/g)].map(
      (m) => m[1] ?? m[2],
    );
    assert.deepEqual(
      imports.filter((i) => !i.startsWith('node:')),
      [],
      f,
    );
  }
});

test('a devDependency of the repository is locked', () => {
  const dev = Object.keys(JSON.parse(read('package.json')).devDependencies ?? {});
  assert.equal(
    fs.existsSync(path.join(repo, 'package-lock.json')),
    dev.length > 0,
    'package-lock.json exists if and only if there is a devDependency',
  );
});

test('the pre-commit hook formats the staged files, then runs the tests', () => {
  const mode = execFileSync('git', ['ls-files', '-s', '.githooks/pre-commit'], { cwd: repo, encoding: 'utf8' });
  assert.match(mode, /^100755 /, 'git skips a hook that is not executable on Linux and macOS: git add --chmod=+x');
  const hook = read('.githooks/pre-commit');
  assert.match(hook, /^#!\/usr\/bin\/env bash\n/);
  const format = hook.indexOf('prettier --write'),
    check = hook.indexOf('npm test');
  assert.ok(format >= 0 && check >= 0, 'the hook formats and tests');
  assert.ok(format < check, 'format before test');
  assert.match(
    hook.slice(0, check),
    /unset GIT_DIR GIT_INDEX_FILE GIT_WORK_TREE/,
    'in a worktree git hands the hook absolute paths: tests that make their own repositories must not inherit them',
  );
  assert.match(hook, /unstaged changes/, 'a partly staged file is refused, not staged whole');
  assert.doesNotMatch(hook, /\b(mapfile|readarray)\b/, 'Bash 3.2, stock on macOS, has no mapfile');
  assert.doesNotMatch(read('.prettierignore'), /\.md$/m, 'Prettier formats every Markdown file');
  assert.match(read('.prettierignore'), /^docs\/budget\/$/m, 'a budget record stays as the script printed it');
});

test('Prettier formats Markdown without wrapping prose, so a wide table is not padded', () => {
  assert.deepEqual(JSON.parse(read('package.json')).prettier, {
    singleQuote: true,
    printWidth: 120,
    proseWrap: 'never',
  });
});

// proseWrap "never" joins the lines of one paragraph: two header lines that touch become one, and budget.mjs, the
// reminder hook and partition-shape read Status, Resume at and the sha of Provenance line by line.
test('each header line is its own paragraph: an empty ">" line separates it from the next', () => {
  const labelled = /^\s*>\s*\*\*[^*\n]+:\*\*/;
  const files = [
    ...walk('.apm'),
    ...(fs.existsSync(path.join(repo, 'docs/plans')) ? fs.readdirSync(path.join(repo, 'docs/plans')) : []).map(
      (f) => `docs/plans/${f}`,
    ),
    ...fs.readdirSync(path.join(repo, 'docs/guides')).map((g) => `docs/guides/${g}/README.md`),
  ].filter((f) => f.endsWith('.md') && fs.existsSync(path.join(repo, f)));
  const joined = files.flatMap((f) =>
    read(f)
      .split('\n')
      .flatMap((line, i, lines) => (labelled.test(line) && labelled.test(lines[i + 1] ?? '') ? [`${f}:${i + 2}`] : [])),
  );
  assert.deepEqual(joined, []);
});

test('the fields of a plan task and of a reshape proof are list items, one per line under any wrap', () => {
  const field = /^(Scope|Verification|Expected|Decisions that bind it|Real output):/m;
  for (const f of [
    '.apm/skills/partition-plan/assets/plan.md',
    '.apm/skills/partition-reshape/assets/reshape-record.md',
  ]) {
    assert.doesNotMatch(read(f), field, f);
    assert.match(read(f), /^- Verification: /m, f);
  }
});

// Each repository names itself; the sync rewrites the name, so this list holds in both.
test('the files that name the repository are these, and no other', () => {
  const pattern = 'elie29/partition(?![\\w-])';
  const base = [
    'docs/plans',
    'docs/prompts',
    'docs/designs',
    'docs/base',
    '.github/sync',
    '.github/workflows/sync.yml',
    '.github/workflows/base-ci.yml',
  ].map((d) => `:!${d}`);
  let listed = '';
  try {
    listed = execFileSync('git', ['grep', '-lzIP', pattern, '--', '.', ...base], { cwd: repo, encoding: 'utf8' });
  } catch (e) {
    if (e.status !== 1) throw e;
  }
  assert.deepEqual(listed.split('\0').filter(Boolean).sort(), [
    '.github/ISSUE_TEMPLATE/config.yml',
    'README.md',
    'RELEASING.md',
    'SECURITY.md',
    'assets/flow-1-initialize.svg',
    'docs/guides/a-project-step-by-step/00-empty-folder.md',
    'scripts/update-version.mjs',
    'tests/package.test.mjs',
    'tests/release.test.mjs',
  ]);
});

test('every text file is checked out with LF, whatever core.autocrlf says', () => {
  assert.match(read('.gitattributes'), /^\* text=auto eol=lf$/m);
});

test('the archive of a release holds the package, its front page, its content page and its images, and nothing else', () => {
  const kept = /^(\.apm\/|assets\/|apm\.yml$|LICENSE$|README\.md$|CONTENT\.md$|CHANGELOG\.md$|SECURITY\.md$)/;
  const git = (args, input) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', input });
  const files = git(['ls-files']).split('\n').filter(Boolean);
  // git archive leaves out a folder marked export-ignore with everything in it, so a file goes when it or a
  // folder above it is marked.
  const withFolders = (f) => f.split('/').map((_, i, parts) => parts.slice(0, i + 1).join('/'));
  const ignored = new Set(
    git(['check-attr', '--stdin', 'export-ignore'], [...new Set(files.flatMap(withFolders))].join('\n'))
      .split('\n')
      .filter((line) => line.endsWith(': export-ignore: set'))
      .map((line) => line.slice(0, -': export-ignore: set'.length)),
  );
  const leftOut = (f) => withFolders(f).some((p) => ignored.has(p));
  assert.deepEqual(
    files.filter((f) => kept.test(f) === leftOut(f)),
    [],
    'kept and export-ignore: decide where the file goes, in .gitattributes',
  );
});

test('package.json is private, carries no version, and holds only the repository commands', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.private, true);
  assert.equal(pkg.version, undefined, 'a fifth copy of the version');
  assert.deepEqual(pkg.scripts, {
    test: 'node --test "tests/*.test.mjs"',
    budget: 'node .apm/skills/partition-budget/scripts/budget.mjs --package .',
    'update-version': 'node scripts/update-version.mjs',
    format: 'prettier --write .',
    'format:check': 'prettier --check .',
    prepare: 'git config core.hooksPath .githooks || exit 0',
  });
  assert.deepEqual(
    fs.readdirSync(path.join(repo, 'scripts')).filter((f) => !f.endsWith('.mjs')),
    [],
    'Node files outside .apm are .mjs',
  );
  const release = read('RELEASING.md');
  assert.doesNotMatch(release, /update-version[^\n`]*--/, 'npm eats a flag after the script name');
  assert.doesNotMatch(release, /git commit -am|^\s*git push\s*$/m, 'the release commit never goes straight to main');
  assert.match(release, /pull request/, 'the release commit is merged through a pull request');
  assert.doesNotMatch(read('README.md'), /^#+ Releasing/m, 'releasing has a file of its own');
  assert.match(read('README.md'), /\[RELEASING\.md\]\(RELEASING\.md\)/);
  assert.match(read('README.md'), /\[CONTENT\.md\]\(CONTENT\.md\)/, 'CONTENT.md alone describes each skill');
});

test('a rule skeleton is not a rule: no file under the skills would be deployed as an instruction', () => {
  assert.deepEqual(
    walk(skillsDir).filter((f) => f.endsWith('.instructions.md')),
    [],
  );
  for (const f of walk(`${skillsDir}/partition-rules/assets`)) {
    const head = read(f).split('\n');
    assert.match(head[1], /^description: (["']).*\1$/, f);
    assert.match(head[2], /^applyTo: (["'])<.*>\1$/, f);
  }
});

test('the always-on instruction carries no file scope', () => {
  assert.equal(frontmatter(read('.apm/instructions/partition.instructions.md')).applyTo, undefined);
});

test('the spec template points to its source and copies only rules, invariants and decisions', () => {
  const t = read(`${skillsDir}/partition-spec/assets/spec.md`);
  for (const h of ['Source parts owned', 'Business rules', 'Decisions', 'Applicable area rules and invariants'])
    assert.match(t, new RegExp(`^## ${h}$`, 'm'), h);
  for (const h of ['Operations exposed', 'Exchange model', 'Error codes'])
    assert.doesNotMatch(t, new RegExp(`^## ${h}$`, 'm'), h);
  assert.match(t, /TO FILL BEFORE THIS BOUNDED CONTEXT IS USED/);
  assert.match(t, /TO VALIDATE BEFORE THIS BOUNDED CONTEXT IS USED/);
  assert.doesNotMatch(t, /\b(this|the) context\b|<context>/i, 'the template writes bounded context in full');
  assert.ok(!fs.existsSync(path.join(repo, skillsDir, 'partition-shape/assets/spec.md')), 'one template only');
});

test('the area file has its template, and the register writes nothing the owner did not validate', () => {
  const area = read(`${skillsDir}/partition-spec/assets/area.md`);
  for (const h of ['Bounded contexts', 'Language', 'Area rules']) assert.match(area, new RegExp(`^## ${h}$`, 'm'), h);
  assert.match(area, /TO FILL BEFORE THIS AREA IS USED/);
  assert.match(area, /TO VALIDATE BEFORE THIS AREA IS USED/);
  assert.match(area, /^\| # +\| Rule +\| Trigger +\| Expected effect +\| Binds +\| Source +\|$/m);
  assert.match(area, /^\| AR-1 +\|/m);
  const spec = read(`${skillsDir}/partition-spec/SKILL.md`);
  assert.match(spec, /`assets\/area\.md` when its first entry is validated/);
  assert.match(spec, /show the owner each rule and each word you would write, and write it only\s+once validated/);
  assert.match(spec, /A rule a person states is the source of its entry, not its\s+validation/);
  const procedure = read(`${skillsDir}/partition-spec/references/invariants.md`);
  assert.match(procedure, /spans at least two areas or layers/);
  assert.match(procedure, /Write it only once the owner validates it/);
  assert.match(procedure, /Code alone never establishes one/);
  assert.match(read(`${skillsDir}/partition-spec/assets/invariants.md`), /\(from source: <anchor>\)/);
});

test('the glossary explains each term once, and the spec points to it instead of a table of its own', () => {
  const g = read(`${skillsDir}/partition-spec/references/glossary.md`);
  const terms = [...g.matchAll(/^\*\*(.+?)\*\*(?: \([^)]*\))? —/gm)].map((m) => m[1]);
  assert.deepEqual(
    terms.filter((t, i) => terms.indexOf(t) !== i),
    [],
    'a term explained twice',
  );
  for (const t of [
    'Area',
    'Bounded context',
    'Layer',
    'Durable spec',
    'Invariant register',
    'Area file',
    'Business rule',
    'Area rule',
    'Invariant',
    'Rule file',
    '_Always_ gauge',
  ])
    assert.ok(terms.includes(t), t);
  assert.match(g, /## The hierarchy of rules/);
  const language = read('docs/specs/partition/spec.md').split('## Language')[1].split('\n## ')[0];
  assert.doesNotMatch(language, /^\|/m, 'the spec keeps no glossary table');
  assert.match(language, /partition-spec\/references\/glossary\.md/);
});

test('partition-shape has one reader per kind of source and saves a chat source first', () => {
  const skill = read(`${skillsDir}/partition-shape/SKILL.md`);
  for (const r of ['references/sources/openapi.md', 'references/sources/document.md'])
    assert.ok(skill.includes(`\`${r}\``), r);
  assert.match(skill, /not a file of the repository/);
  assert.match(read(`${skillsDir}/partition-shape/references/sources/document.md`), /no stable anchor/);
});

test('the hard stop shows what is copied from the source, in the decomposition and in the delta', () => {
  const ref = (f) => read(`${skillsDir}/partition-shape/references/${f}`);
  const stop = (text, from) => text.split(from)[1].split('\n## ')[0];
  assert.match(stop(ref('decompose.md'), '## Step 5'), /Copied from the source/);
  assert.match(stop(ref('delta.md'), '## Step 6'), /Copied from the source/);
});

test('a pasted API contract is saved as a contract, any other pasted source as a document', () => {
  const skill = read(`${skillsDir}/partition-shape/SKILL.md`);
  assert.ok(skill.includes('`<contracts>/<name>.json`'), 'contract');
  assert.ok(skill.includes('`<sources>/<name>.md`'), 'document');
});

test('the delta adds a rule the source newly states under the TO VALIDATE banner, and says so at closing', () => {
  const delta = read(`${skillsDir}/partition-shape/references/delta.md`);
  assert.match(delta.split('## Absolute rules')[1].split('\n## ')[0], /replaces the "TO FILL" banner/);
  assert.doesNotMatch(delta, /\| Fill [^|]*`Business rules` section \| Leave it intact \|/);
  assert.match(delta.split('## Step 8')[1].split('\n## ')[0], /TO VALIDATE/);
});

test('a sentence of the source that replaces a copied rule is a change of it, never a rule added beside it', () => {
  const replaces = /a sentence of the source that replaces a copied one is a change of that rule/i;
  assert.match(read('docs/specs/partition/spec.md').replace(/\s+/g, ' '), replaces);
  const delta = read(`${skillsDir}/partition-shape/references/delta.md`).replace(/\s+/g, ' ');
  assert.match(delta, replaces);
  assert.match(delta, /two copied rules that contradict each other never stand in one spec/i);
  assert.match(delta, /A source change that does not move the decomposition is the \*\*normal\*\* case/);
  assert.match(delta, /Unchanged +: <yes — the normal case \/ no>/, 'the report says it, not only the prose');
});

test('the shared procedures know where a document source lives and how a modified unit is classified', () => {
  for (const f of ['decompose.md', 'delta.md'])
    assert.match(read(`${skillsDir}/partition-shape/references/${f}`), /\| `<sources>\/`[^\n]*`paths\.sources`/, f);
  assert.match(read(`${skillsDir}/partition-shape/references/sources/document.md`), /modified unit/i);
});

test('at closing, a HOLD reason the assistant can fix becomes a task; a blocker only when a person must act', () => {
  const close = read(`${skillsDir}/partition-plan/SKILL.md`).split('## Close')[1].split('\n## ')[0];
  const hold = close.split('- HOLD')[1].split('- SHIP WITH CONDITIONS')[0];
  assert.match(hold, /becomes a task/);
  assert.match(hold, /only a person/);
  const br27 = read('docs/specs/partition/spec.md').split('| BR-27 |')[1].split('\n')[0];
  assert.match(br27, /becomes a task/);
});

test('the hook is enabled in order: Python found first, then the file copied; the team is warned', () => {
  const hook = read(`${skillsDir}/partition-plan/SKILL.md`).split('## Reminder hook')[1];
  assert.ok(
    hook.indexOf('Find Python 3') < hook.indexOf('Copy `assets/hook/partition-reminder.py`'),
    'find before copy',
  );
  const readme = read('README.md').split('## The reminder hook')[1].split('\n## ')[0];
  assert.match(readme, /another machine/);
});

test('a rule stated for several bounded contexts is copied once, and every new bounded context is declared', () => {
  const ref = (f) => read(`${skillsDir}/partition-shape/references/${f}`);
  assert.match(
    ref('criteria.md'),
    /R4 — C6 never creates a bounded context\.\*\* A strong sharing of data, or of business rules/,
  );
  const decompose = ref('decompose.md');
  assert.match(decompose, /^### 6\.c — `<specs>\/<area>\/area\.md`/m);
  assert.match(decompose, /^### 6\.d — `docs\/partition\.yml`/m);
  assert.match(decompose, /never copied into each spec/);
  assert.match(ref('delta.md'), /The rules the pair shares count as well as its data \(R4\)/);
  for (const f of ['SKILL.md', 'references/decompose.md', 'references/delta.md'])
    assert.doesNotMatch(read(`${skillsDir}/partition-shape/${f}`), /`contract` (and|is supplied|\|)/, f);
  assert.doesNotMatch(read(`${skillsDir}/partition-shape/assets/bounded-contexts.md`), /\boperations?\b/);
});

test('a document source and a contract at a URL have their preconditions', () => {
  const doc = read(`${skillsDir}/partition-shape/references/sources/document.md`);
  assert.match(doc, /^## Preconditions$/m);
  assert.match(read(`${skillsDir}/partition-shape/references/sources/openapi.md`), /at a URL/);
  assert.doesNotMatch(read(`${skillsDir}/partition-shape/SKILL.md`), /never the source\./);
});

test('a persistence mapping is not a copy of the source, in the spec and in the procedure', () => {
  const br26 = read('docs/specs/partition/spec.md')
    .split(/\| BR-26 +\|/)[1]
    .split('\n')[0];
  assert.match(br26, /persistence mapping is not a copy/);
  const row = read(`${skillsDir}/partition-shape/references/decompose.md`)
    .split('\n')
    .find((l) => /^\| `Persistence` +\|/.test(l));
  assert.match(row, /not a copy/);
});

test('the documents quote the always-loaded budget within 5 %', () => {
  const { alwaysTokens } = measurePackage(repo, 2000, 3000);
  const quoted = (text, re) => Number(text.match(re)?.[1].replace(/\s/g, ''));
  for (const [file, re] of [
    ['CONTENT.md', /Loaded by every session \(about ([\d ]+) tokens\)/],
    ['README.md', /about \*\*([\d ]+) tokens\*\*/],
  ]) {
    const n = quoted(read(file), re);
    assert.ok(Math.abs(n - alwaysTokens) <= alwaysTokens / 20, `${file}: ${n} quoted, ${alwaysTokens} measured`);
  }
});

test('the instruction names the skill of each step the method requires (BR-28)', () => {
  const inst = read('.apm/instructions/partition.instructions.md');
  for (const s of ['partition-spec', 'partition-plan', 'partition-shape', 'partition-gate', 'partition-readme']) {
    assert.ok(inst.includes(`\`${s}\``), s);
    assert.ok(fs.existsSync(path.join(repo, skillsDir, s, 'SKILL.md')), `${s} is a shipped skill`);
  }
});

test('the instruction and partition-plan close a plan through the gate and the README', () => {
  const inst = read('.apm/instructions/partition.instructions.md');
  for (const s of ['partition-shape', 'partition-gate', 'partition-readme']) assert.ok(inst.includes(`\`${s}\``), s);
  assert.match(inst, /Ticking the last task starts the closing in the same turn/);
  const close = read(`${skillsDir}/partition-plan/SKILL.md`).split('## Close')[1].split('\n## ')[0];
  assert.match(close, /When the last task is ticked, in the same turn, without waiting to be asked/);
  assert.match(close, /HOLD/);
  assert.match(close, /stays `in progress`/);
  assert.ok(close.includes('`partition-readme`'));
  const level = /already\s+written\s+into\s+a\s+spec\s+during\s+the\s+work[^.]*level/;
  assert.match(close, level, 'a statement written early still has its level checked at closing');
  assert.match(read('docs/specs/partition/spec.md'), level, 'BR-27 says it');
});

test('the instruction stops on an area rule as on an invariant, and closing writes no entry unvalidated', () => {
  const inst = read('.apm/instructions/partition.instructions.md');
  assert.match(inst, /an invariant of the register, a rule of the area file or a business rule of the\s+spec/);
  assert.doesNotMatch(inst, /docs\/specs\/invariants\.md/);
  const close = read(`${skillsDir}/partition-plan/SKILL.md`).split('## Close')[1].split('\n## ')[0];
  assert.match(close, /Nothing is written to the area file or to the register before the owner validates it/);
});

test('the material of a reshape lists the Persistence lines both sides need, not only the business rules', () => {
  const both = /business rules and the `Persistence` lines that both sides would need/;
  assert.match(read(`${skillsDir}/partition-reshape/SKILL.md`).replace(/\s+/g, ' '), both);
  assert.match(
    read('docs/specs/partition/spec.md').replace(/\s+/g, ' '),
    /each rule or `Persistence` line both sides need one home/,
  );
});

test('the challenge checks each bounded context of a workshop result against R1, from the source alone', () => {
  const r1 = /each bounded context the result names is checked against R1 from the source alone/i;
  assert.match(read('docs/specs/partition/spec.md').replace(/\s+/g, ' '), r1);
  const challenge = read(`${skillsDir}/partition-shape/references/boundary-decision.md`)
    .split('## The challenge')[1]
    .split('\n## ')[0]
    .replace(/\s+/g, ' ');
  assert.match(challenge, r1);
  assert.match(challenge, /a decision of the result does not make a criterion hold/i);
});

test('a fission moves to History the decision not to split that it overturns', () => {
  const fission = read(`${skillsDir}/partition-reshape/references/specs.md`)
    .split('## Fission')[1]
    .split('\n## ')[0]
    .replace(/\s+/g, ' ');
  assert.match(
    fission,
    /a line of `Decisions not to split` or `Alternatives rejected` the fission overturns moves to `History`/i,
  );
});

test('a change of a source that tightens what was asked is breaking, in the spec and for a document', () => {
  const tightens = /breaking when it withdraws or tightens what was asked/i;
  assert.match(read('docs/specs/partition/spec.md').replace(/\s+/g, ' '), tightens);
  assert.match(
    read(`${skillsDir}/partition-shape/references/sources/document.md`).replace(/\s+/g, ' ').replace(/\*\*/g, ''),
    tightens,
  );
});

test('a new bounded context in an area with area rules is proposed each of them, never bound silently', () => {
  const proposed = /each area rule already in the area file is proposed to bind it or not/i;
  assert.match(read('docs/specs/partition/spec.md').replace(/\s+/g, ' '), proposed);
  const delta = read(`${skillsDir}/partition-shape/references/delta.md`).replace(/\s+/g, ' ');
  assert.match(delta, proposed);
  const closing = delta.split('## Step 8 — Close')[1].split('## Anti-patterns')[0];
  assert.match(closing, /each area rule already there, proposed to bind it or not, with the reason/i);
});

test('partition-reshape: four moves, each rule one home, area rules down at a merge', () => {
  assert.ok(skills.includes('partition-reshape'));
  const reshape = read(`${skillsDir}/partition-reshape/SKILL.md`);
  for (const move of ['Fission', 'Merge', 'Removal', 'Move', 'Promotion'])
    assert.match(reshape, new RegExp(`^\\| ${move} +\\|`, 'm'), move);
  assert.match(reshape, /Where a statement belongs/);
  assert.match(reshape, /A\s+rule is never copied into both specs/);
  assert.match(reshape, /The\s+area rules only the two halves shared come down to the merged spec/);
  assert.match(reshape, /`partition-shape`/, 'a bounded context that does not exist yet is shaped');
  const specs = read(`${skillsDir}/partition-reshape/references/specs.md`);
  for (const h of ['Fission', 'Merge', 'Removal', 'Move', 'History'])
    assert.match(specs, new RegExp(`^## ${h}$`, 'm'), h);
  assert.match(
    read(`${skillsDir}/partition-reshape/assets/reshape-record.md`),
    /one home: the owner's spec, the area file or the register/,
  );
  const delta = read(`${skillsDir}/partition-shape/references/delta.md`);
  assert.doesNotMatch(
    delta,
    /\*\*Merge validated\*\*|\*\*Removal validated\*\*/,
    'the delta proposes; reshape carries out',
  );
  assert.match(delta, /carried out by the `partition-reshape` skill/);
});

test('a boundary is reached by a workshop or a proposal, and a workshop result is challenged (BR-33)', () => {
  assert.match(read('docs/specs/partition/spec.md'), /^\| BR-33 +\| Before a boundary moves/m);

  const ref = read(`${skillsDir}/partition-shape/references/boundary-decision.md`);
  for (const h of [
    'When',
    'The choice',
    'The material for a workshop',
    'A proposal',
    'The result of a workshop',
    'The challenge',
    'The record',
  ])
    assert.match(ref, new RegExp(`^## ${h}$`, 'm'), h);
  const prose = ref.replace(/\s+/g, ' ');
  assert.match(prose, /Not an attachment/);
  assert.match(prose, /Not a promotion/);
  assert.match(prose, /do not ask it again/);
  assert.match(prose, /Two or three options/);
  assert.match(prose, /numbered 1, 2, 3/);
  assert.match(prose, /the `Decided` line names the one chosen by its number/);
  assert.match(prose, /which option is recommended, and why/);
  assert.match(prose, /The recommended option is one the criteria C1–C6 and the rules R1–R6 leave/);
  assert.match(prose, /it is never the one recommended: keeping it is the architect's decision/);
  assert.match(prose, /Never invent an option/);
  assert.match(prose, /`paths\.sources`/);
  assert.match(prose, /before it is challenged/);
  assert.match(prose, /"No finding" is a normal outcome/);
  assert.match(prose, /`Kept against the criteria`/);
  const proposal = ref.split('## A proposal')[1].split('\n## ')[0];
  assert.match(
    proposal,
    /^\| Option +\|.*\| Criterion broken +\|/m,
    'the table names the criterion each option breaks',
  );
  assert.match(proposal.replace(/\s+/g, ' '), /Above the table, one line: how many splits the criteria leave/);
  assert.match(proposal.replace(/\s+/g, ' '), /Before the options are shown, check:/);

  const shape = (f) => read(`${skillsDir}/partition-shape/${f}`);
  for (const f of ['SKILL.md', 'references/decompose.md', 'references/delta.md'])
    assert.match(shape(f), /`references\/boundary-decision\.md`/, f);
  assert.match(
    shape('references/delta.md'),
    /listed under `Kept against the criteria`[\s\S]{0,80}unless the\s+delta changes, for its units, the criterion/,
  );

  const reshape = read(`${skillsDir}/partition-reshape/SKILL.md`);
  assert.match(reshape, /^## Before the decision: prepare the material$/m);
  assert.match(reshape, /`partition-shape`[^\n]*\n?[^\n]*`references\/boundary-decision\.md`/);
  assert.doesNotMatch(reshape, /Do not\s+propose a\s+boundary/);
  assert.doesNotMatch(reshape, /never draw\s+the line yourself/);
  assert.match(reshape.replace(/\s+/g, ' '), /never start a move on your own reading of a budget report/);

  const bc = read(`${skillsDir}/partition-shape/assets/bounded-contexts.md`);
  assert.match(bc, /^> \*\*Decided:\*\* YYYY-MM-DD · <names> · </m);
  assert.match(bc, /^## Kept against the criteria$/m);
  const record = read(`${skillsDir}/partition-reshape/assets/reshape-record.md`);
  assert.match(record, /^> \*\*Decided on:\*\* YYYY-MM-DD, by <names>, from </m);
  assert.match(record, /^## Challenge$/m);

  assert.match(read(`${skillsDir}/partition-spec/references/glossary.md`), /^\*\*Kept against the criteria\*\* —/m);

  // The spec says when a kept point comes back exactly as the delta applies it.
  const br33 = read('docs/specs/partition/spec.md')
    .split(/\| BR-33 +\|/)[1]
    .split('\n')[0];
  assert.match(br33, /unless a later delta changes, for its units, the criterion it was kept against/);
  assert.match(br33, /two or three options, numbered/);
  assert.doesNotMatch(br33, /until the source changes on it/);

  // The delta's writing step records what the architect decided, and tells a kept point from an unanswered one.
  const writing = shape('references/delta.md')
    .split(/^## Step 7 /m)[1]
    .split(/^## Step 8 /m)[0]
    .replace(/\s+/g, ' ');
  assert.match(writing, /`Kept against the criteria`/);
  assert.match(writing, /the `Decided` line/);
  assert.match(writing, /kept by the architect/);

  // A shared-data or shared-rule merge prevails under R4: it is not kept against the criteria (step 13).
  // A merge with nothing shared to argue is a finding on R1, kept against the criteria (step 14).
  const guide = (f) => read(`docs/guides/a-project-step-by-step/${f}`).replace(/\s+/g, ' ');
  assert.doesNotMatch(guide('13-merge-with-area-file.md'), /kept against R1/i);
  assert.match(guide('13-merge-with-area-file.md'), /No finding/);
  assert.match(guide('13-merge-with-area-file.md'), /R4 lets prevail over the split/);
  assert.match(guide('14-merge-without-area-file.md'), /a finding on R1/);
  assert.match(guide('14-merge-without-area-file.md'), /It goes to `Kept against the criteria`/);
  assert.doesNotMatch(guide('14-merge-without-area-file.md'), /R4 lets the sharing prevail/);
  // A move raised by a delta asks the way, like any boundary.
  assert.match(guide('11-move.md'), /> A proposal\./);

  // The minors of the final review.
  assert.match(br17(), /proposes or challenges when the architect asks/);
  assert.match(shape('references/delta.md'), /Kept, not proposed +: <point> \(<criterion>\)/);
  assert.doesNotMatch(guide('07-new-bounded-context.md'), /the pair `invoice` \/ `payment`: it fails R1/);
  assert.match(prose, /sends back to the decision step of the procedure/);
  const reshapeProse = reshape.replace(/\s+/g, ' ');
  assert.match(reshapeProse, /names a workshop, hand the material over and stop; when it names a proposal/);
  assert.match(reshapeProse, /already validated by name through `partition-shape`/);
  assert.doesNotMatch(bc, /A later delta does not propose a point of this table again/);
  assert.match(bc, /`references\/boundary-decision\.md`/);
  const glossary = read(`${skillsDir}/partition-spec/references/glossary.md`);
  assert.match(glossary, /^\*\*Architect\*\* —/m);
  assert.match(glossary.replace(/\s+/g, ' '), /draws the boundaries, or names the architect who does/);
  assert.doesNotMatch(guide('06-fission.md'), /or keep the fission against C2/);
});

test('a unit is what asks for a behaviour: a decision or a glossary is not one', () => {
  const flat = (rel) => read(rel).replace(/\s+/g, ' ');
  const notAUnit = /a part that only records decisions, defines terms or gives context is not a unit/i;
  assert.match(flat('docs/specs/partition/spec.md'), notAUnit);
  assert.match(flat(`${skillsDir}/partition-shape/references/criteria.md`), notAUnit);
  assert.match(flat(`${skillsDir}/partition-shape/references/sources/document.md`), notAUnit);
  assert.match(flat(`${skillsDir}/partition-spec/references/glossary.md`), notAUnit);
  assert.doesNotMatch(flat(`${skillsDir}/partition-shape/SKILL.md`), /requirement, story or section under its anchor/);
});

test('a source that marks its rules gives the bounds of each: a sentence it does not mark is not copied', () => {
  const flat = (rel) => read(rel).replace(/\s+/g, ' ');
  const bounds = /when the source marks its rules, a marked sentence is the whole rule/i;
  assert.match(flat('docs/specs/partition/spec.md'), bounds);
  assert.match(flat(`${skillsDir}/partition-shape/references/sources/document.md`), bounds);
});

test('the copied reminder hook is copied again after a package update', () => {
  const plan = read(`${skillsDir}/partition-plan/SKILL.md`).replace(/\s+/g, ' ');
  assert.match(plan, /a package update does not refresh the copy: copy `assets\/hook\/partition-reminder\.py` again/);
});

test('a decomposition declares a bounded context without its spec folder when it is the default', () => {
  const d = read(`${skillsDir}/partition-shape/references/decompose.md`).replace(/\s+/g, ' ');
  assert.doesNotMatch(d, /its `spec` folder and its `area`/);
  assert.match(d, /`spec` only when it is not the default/);
});

test('a word given two meanings in one bounded context is asked as a boundary, not written', () => {
  const twoMeanings = /a word given two meanings in one bounded context is not written/i;
  assert.match(read('docs/specs/partition/spec.md').replace(/\s+/g, ' '), twoMeanings);
  const spec = read(`${skillsDir}/partition-spec/SKILL.md`).replace(/\s+/g, ' ');
  assert.match(spec, twoMeanings);
  assert.match(spec, /whether the other belongs to another bounded context/);
});

test('a rule copied from a source changes only through its source', () => {
  const throughSource = /a rule copied from a source changes only through its source/i;
  assert.match(read('docs/specs/partition/spec.md').replace(/\s+/g, ' '), throughSource);
  const spec = read(`${skillsDir}/partition-spec/SKILL.md`).replace(/\s+/g, ' ');
  assert.match(spec, throughSource);
  assert.match(spec, /the source contradicts itself/);
  assert.match(spec, /propose no wording for the copied rule/);
  const instruction = read('.apm/instructions/partition.instructions.md').replace(/\s+/g, ' ');
  assert.match(
    instruction,
    throughSource,
    'the instruction is loaded when the question is asked; the skill may not be',
  );
  assert.match(instruction, /the source contradicts itself/);
});

function br17() {
  return read('docs/specs/partition/spec.md')
    .split(/\| BR-17 +\|/)[1]
    .split('\n')[0];
}

test('every reader of a spec reads the area file, and the auditor no decision log', () => {
  const auditor = read('.apm/agents/spec-auditor.agent.md');
  assert.doesNotMatch(auditor, /decisions\.md|decision log/);
  assert.doesNotMatch(auditor, /`rules`/, 'docs/partition.yml declares no rules per bounded context');
  assert.match(auditor, /area rule `AR-n`/);
  assert.match(
    auditor,
    /`Language` of the spec or of the area file/,
    'a word shared in an area lives in its area file',
  );
  assert.match(read(`${skillsDir}/partition-attack/SKILL.md`), /the area file of its area, the invariant register/);
  assert.match(
    read(`${skillsDir}/partition-gate/SKILL.md`),
    /the area\s+files of their areas, and the invariant register/,
  );
});

test('partition-attack writes its findings into a durable spec, under Open questions', () => {
  const skill = read(`${skillsDir}/partition-attack/SKILL.md`);
  assert.match(skill, /Attack a durable spec or a design/);
  assert.match(skill, /under `Open questions`/);
});

test('the schema of partition.yml uses only what budget.mjs reads, and the templates follow it', () => {
  const schema = JSON.parse(read(`${skillsDir}/partition-budget/assets/partition.schema.json`));
  const unknown = [];
  const visit = (s, at) => {
    for (const k of Object.keys(s)) if (!SCHEMA_KEYWORDS.includes(k)) unknown.push(`${at}: ${k}`);
    for (const [k, sub] of Object.entries(s.properties ?? {})) visit(sub, `${at}.${k}`);
    if (typeof s.additionalProperties === 'object') visit(s.additionalProperties, `${at}.*`);
    if (s.items) visit(s.items, `${at}[]`);
  };
  visit(schema, '(root)');
  assert.deepEqual(unknown, []);
  for (const file of [`${skillsDir}/partition-budget/assets/partition.yml`, 'docs/partition.yml'])
    assert.deepEqual(validate(parseYaml(read(file), file), schema), [], file);
});

test('a file deployed as an instruction starts its headings at ### (BR-32)', () => {
  const files = [
    ...walk('.apm/instructions').filter((f) => f.endsWith('.instructions.md')),
    ...walk(`${skillsDir}/partition-rules/assets`).filter((f) => f.endsWith('.md')),
  ];
  const hits = [];
  for (const f of files) {
    let fence = false;
    read(f)
      .split('\n')
      .forEach((line, i) => {
        if (/^\s*```/.test(line)) fence = !fence;
        else if (!fence && /^#{1,2}\s/.test(line)) hits.push(`${f}:${i + 1}: ${line}`);
      });
  }
  assert.deepEqual(hits, []);
  assert.match(read(`${skillsDir}/partition-rules/SKILL.md`), /headings[^.]*`###`/);
});

test('the first line of partition.yml points the editor at the schema', () => {
  const link = (file) =>
    read(file)
      .split('\n')[0]
      .match(/^# yaml-language-server: \$schema=(\S+)$/)?.[1];
  const template = `${skillsDir}/partition-budget/assets/partition.yml`;
  assert.equal(link(template), './partition.schema.json', 'the template: the schema beside it');
  assert.ok(fs.existsSync(path.join(repo, path.dirname(template), link(template))));
  assert.match(
    read(template).split('\n')[1],
    /\$schema=\.\.\/\.claude\/skills\/partition-budget\/assets\/partition\.schema\.json\b.*\.agents/,
    'the second line: the link once copied to docs/, for claude and for copilot',
  );
  const own = link('docs/partition.yml');
  assert.ok(own && fs.existsSync(path.join(repo, 'docs', own)), `docs/partition.yml: ${own}`);
  assert.match(read(`${skillsDir}/partition-budget/SKILL.md`), /first line[\s\S]*second line/);
  assert.match(read(`${skillsDir}/partition-plan/SKILL.md`), /first line[^.]*target[^.]*second line/);
});

test('docs/partition.yml keeps every template key the answers leave alone, at its value and with its comment', () => {
  const rule = /keeps? every key[^.]*answers?[^.]*leave[^.]*value[^.]*comment[^.]*example bounded context/i;
  assert.match(read('docs/specs/partition/spec.md'), rule, 'BR-31 says it');
  assert.match(read(`${skillsDir}/partition-budget/SKILL.md`), rule, 'partition-budget says it');
});

test('the layer map partition-hexagon shows is a valid docs/partition.yml', () => {
  const schema = JSON.parse(read(`${skillsDir}/partition-budget/assets/partition.schema.json`));
  const yaml = read(`${skillsDir}/partition-hexagon/SKILL.md`).match(/```yaml\n([\s\S]*?)```/)[1];
  assert.deepEqual(validate(parseYaml(yaml, 'partition-hexagon'), schema), []);
});

test('no form is read from rules that still carry their banner (BR-21)', () => {
  const br21 = read('docs/specs/partition/spec.md')
    .split(/\| BR-21 +\|/)[1]
    .split('\n')[0];
  assert.match(br21, /no reading of the rules against the forms/);
  const skill = read(`${skillsDir}/partition-hexagon/SKILL.md`).replace(/\s+/g, ' ');
  assert.match(skill, /the form cannot be chosen: say so, and give no reading of the rules against the table/);
});

test('a form changed from thin to rich is moved and proven by the first tasks of its plan (BR-21)', () => {
  const br21 = read('docs/specs/partition/spec.md')
    .split(/\| BR-21 +\|/)[1]
    .split('\n')[0];
  assert.match(
    br21,
    /carried out by the first tasks of the plan of the behaviour that needs it, not by a plan of its own/,
  );
  const skill = read(`${skillsDir}/partition-hexagon/SKILL.md`).replace(/\s+/g, ' ');
  assert.match(skill, /A change of form, not a promotion/);
  assert.match(
    skill,
    /carried out by the first tasks of the plan of the behaviour that needs it, not by a plan of its own/,
  );
  assert.match(skill, /prove the move before any behaviour is built on the domain layer/);
  assert.doesNotMatch(skill, /a piece of work of its own|Promote thin/);
});

test('partition-hexagon is found whenever a form is chosen or changed (BR-21, BR-28)', () => {
  const description = read(`${skillsDir}/partition-hexagon/SKILL.md`).match(/^description: (.*)$/m)[1];
  assert.match(description, /a business rule enters the spec of a hexagon whose form is declared/);
  assert.match(description, /writing or changing a form, its reason or a layer map/);
});

test('the shipped templates are valid: partition.yml parses and model.yml validates', () => {
  const cfg = parseYaml(read(`${skillsDir}/partition-budget/assets/partition.yml`), 'partition.yml');
  assert.equal(cfg.budget.always, 32000);
  assert.equal(cfg.contexts[0].contracts, undefined);
  assert.equal(cfg.contexts[0].hexagons[0].form, 'thin');
  assert.equal(cfg.paths.sources, 'docs/sources');
  execFileSync(
    'node',
    [fileURLToPath(c4Path), '--check', '--model', path.join(repo, skillsDir, 'partition-c4/assets/model.yml')],
    { stdio: 'pipe' },
  );
});

test('the model example of the C4 reference validates', () => {
  const yaml = read(`${skillsDir}/partition-c4/references/model.md`).match(/```yaml\n([\s\S]*?)```/)[1];
  const dir = tmp({ 'model.yml': yaml });
  execFileSync('node', [fileURLToPath(c4Path), '--check', '--model', path.join(dir, 'model.yml')], { stdio: 'pipe' });
});

test('the hook settings name no interpreter: the one found on the machine replaces <python>', () => {
  const settings = JSON.parse(read(`${skillsDir}/partition-plan/assets/hook/settings.json`));
  const commands = Object.values(settings.hooks)
    .flat()
    .flatMap((m) => m.hooks)
    .map((h) => h.command);
  assert.equal(commands.length, 2);
  for (const h of Object.values(settings.hooks)
    .flat()
    .flatMap((m) => m.hooks))
    assert.equal(h.statusMessage, 'Checking the plan closing...');
  for (const c of commands)
    assert.match(
      c,
      /^<python> "\$\{CLAUDE_PROJECT_DIR\}\/\.claude\/hooks\/partition-reminder\.py" (Pre|Post)ToolUse \|\| true$/,
    );
  const skill = read(`${skillsDir}/partition-plan/SKILL.md`);
  for (const p of ['`python3 --version`', '`python --version`', '`py -3 --version`']) assert.ok(skill.includes(p), p);
});

test('the reminder hook stays silent unless a plan is marked done or a commit is about to be created', () => {
  const hook = path.join(repo, skillsDir, 'partition-plan/assets/hook/partition-reminder.py');
  let python = null;
  for (const p of [['python3'], ['python'], ['py', '-3']]) {
    try {
      if (/^Python 3\./.test(execFileSync(p[0], [...p.slice(1), '--version'], { encoding: 'utf8', stdio: 'pipe' }))) {
        python = p;
        break;
      }
    } catch {
      /* next */
    }
  }
  if (!python) return; // no interpreter here: nothing to run
  const run = (payload) =>
    execFileSync(python[0], [...python.slice(1), hook, 'PostToolUse'], { input: payload, encoding: 'utf8' });
  const edit = (file, text) => JSON.stringify({ tool_name: 'Write', tool_input: { file_path: file, content: text } });
  assert.match(run(edit('C:\\repo\\docs\\plans\\p.md', '# P\n\n> **Status:** done\n')), /invariant register/);
  assert.match(run(edit('docs/plans/p.md', '> **Status:** done')), /area file/);
  assert.match(run(edit('docs/plans/p.md', '> **Status:** done')), /write it only once validated/);
  assert.match(run(edit('docs/plans/p.md', '> **Status:** done')), /partition-gate/);
  assert.match(run(edit('docs/plans/p.md', '> **Status:** done')), /back to in progress/);
  assert.match(run(edit('docs/plans/p.md', '> **Status:** done')), /even when none was admitted/);
  assert.doesNotMatch(run(edit('docs/plans/p.md', '> **Status:** done')), /say nothing about the register/);
  assert.equal(run(edit('docs/plans/p.md', '> **Status:** in progress')), '');
  assert.equal(run(edit('src/a.js', 'status: done')), '');
  assert.equal(run('not json'), '');
  assert.match(
    run(JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'git commit -m x' } })),
    /commit is about to be created/,
  );
  assert.match(
    run(JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'npm test && git commit -am "x"' } })),
    /commit is about to be created/,
  );
  assert.equal(run(JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'npx prettier --write a.md' } })), '');
  assert.equal(run(JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'git status --short' } })), '');
});

const issueDir = '.github/ISSUE_TEMPLATE';
const forms = ['bug_report.yml', 'skill_proposal.yml'].map((f) => `${issueDir}/${f}`);
// The options of a form's dropdown, read from the raw text: the YAML subset parser does not read issue forms.
// Each field writes `id:` on the line after `- type:`, and its `options:` before the next field.
const dropdown = (text, id) => {
  const lines = text.split('\n');
  const at = lines.findIndex((l) => l.trim() === `id: ${id}`);
  assert.ok(at >= 0, `no field ${id}`);
  const start = lines.findIndex((l, i) => i > at && l.trim() === 'options:');
  assert.ok(start > at && !lines.slice(at + 1, start).some((l) => /^\s*- type:/.test(l)), `${id}: no options`);
  const indent = lines[start + 1].search(/\S/);
  const options = [];
  for (const l of lines.slice(start + 1)) {
    if (l.search(/\S/) !== indent || !l.trim().startsWith('- ')) break;
    options.push(l.trim().slice(2).trim());
  }
  return options;
};

test('issues open from two forms, blank issues are off, and a vulnerability goes to the security policy', () => {
  const files = fs.readdirSync(path.join(repo, issueDir)).sort();
  assert.deepEqual(files, ['bug_report.yml', 'config.yml', 'skill_proposal.yml']);
  const config = read(`${issueDir}/config.yml`);
  assert.match(config, /^blank_issues_enabled: false$/m);
  assert.match(config, /\/security\/advisories\/new/);
  const intro = read(forms[0]).split('- type: checkboxes')[0];
  assert.match(intro, /client or an employer/, 'the bug report warns before the first pasted field');
});

test('the bug report lists every skill, the agent and every script, and nothing that is gone', () => {
  const scripts = skills.flatMap((s) =>
    fs.existsSync(path.join(repo, skillsDir, s, 'scripts'))
      ? fs.readdirSync(path.join(repo, skillsDir, s, 'scripts'))
      : [],
  );
  const agents = fs.readdirSync(path.join(repo, '.apm/agents')).map((f) => f.replace(/\.agent\.md$/, ''));
  const hooks = walk(skillsDir)
    .filter((f) => /\/assets\/hook\/[^/]+\.py$/.test(f))
    .map((f) => path.basename(f));
  assert.ok(hooks.length > 0, 'no reminder hook found');
  const shipped = [...skills, ...agents, ...scripts, ...hooks];
  const options = dropdown(read(forms[0]), 'component');
  assert.deepEqual(
    shipped.filter((s) => !options.includes(s)),
    [],
    'missing from the dropdown',
  );
  const named = options.filter((o) => /^(partition-|spec-)|\.(mjs|sh|py)$/.test(o));
  assert.deepEqual(
    named.filter((o) => !shipped.includes(o)),
    [],
    'in the dropdown, not in the package',
  );
});

test('the proposal offers every skill as the closest one, and nothing that is gone', () => {
  const options = dropdown(read(forms[1]), 'closest').filter((o) => o.startsWith('partition-'));
  assert.deepEqual(options.sort(), skills);
});

test('every form is one GitHub loads: required keys, unique ids and options, no None, no unquoted ": "', () => {
  const problems = [];
  for (const f of forms) {
    const text = read(f);
    for (const key of ['name', 'description', 'labels', 'body'])
      if (!new RegExp(`^${key}:`, 'm').test(text)) problems.push(`${f}: no ${key}`);
    if (text.includes('\t')) problems.push(`${f}: a tab`);
    const ids = [...text.matchAll(/^\s+id: (\S+)$/gm)].map((m) => m[1]);
    for (const id of ids.filter((id, i) => ids.indexOf(id) !== i)) problems.push(`${f}: id ${id} twice`);
    for (const [, id] of text.matchAll(/^\s+- type: dropdown\n\s+id: (\S+)$/gm)) {
      const options = dropdown(text, id);
      if (!options.length) problems.push(`${f}: ${id} has no option`);
      for (const o of options.filter((o, i) => options.indexOf(o) !== i)) problems.push(`${f}: ${id} lists ${o} twice`);
      if (options.some((o) => /^none$/i.test(o))) problems.push(`${f}: ${id} offers None`);
    }
    // Outside a block scalar, a plain value may hold neither ": " nor " #".
    let block = -1;
    text.split('\n').forEach((line, i) => {
      const indent = line.search(/\S/);
      if (block >= 0 && (indent < 0 || indent > block)) return;
      block = -1;
      const m = line.match(/^(\s*)(?:- )?[\w-]+: +(.+)$/);
      if (!m) return;
      if (/^[|>]/.test(m[2])) {
        block = m[1].length;
        return;
      }
      // A plain value may not hold ": " or " #", end with ":", or start with an indicator YAML reserves.
      if (!/^["'[]/.test(m[2]) && (/: | #|:$/.test(m[2]) || /^[`@*&!%{#]/.test(m[2])))
        problems.push(`${f}:${i + 1}: quote "${m[2].slice(0, 40)}"`);
    });
  }
  assert.deepEqual(problems, []);
});

test('every repository path the forms and the pull request template cite exists', () => {
  const cited = [...forms, `${issueDir}/config.yml`, '.github/PULL_REQUEST_TEMPLATE.md'].flatMap((f) =>
    // A root document is cited with or without backticks; `SKILL.md` names a kind of file, not a file at the root.
    [
      ...read(f).matchAll(/`((?:\.apm|\.github|docs|scripts|tests)\/[A-Za-z0-9_./-]+)`|\b((?!SKILL\.md)[A-Z]+\.md)\b/g),
    ].map((m) => [f, m[1] ?? m[2]]),
  );
  assert.ok(cited.length > 0, 'nothing cited');
  assert.deepEqual(
    cited.filter(([, p]) => !fs.existsSync(path.join(repo, p))).map(([f, p]) => `${f} cites ${p}`),
    [],
  );
  assert.match(
    read('CONTRIBUTING.md'),
    /^### A new skill$/m,
    'the proposal form cites "A new skill" in CONTRIBUTING.md',
  );
});

test('the pull request template proves a change with the repository commands', () => {
  const pr = read('.github/PULL_REQUEST_TEMPLATE.md');
  assert.match(pr, /\$ npm test\n/);
  assert.match(pr, /\$ npm run budget\n/);
  assert.doesNotMatch(pr, /node (--test|tests\/run\.mjs)/, 'names the runner instead of npm test');
  // markdownlint MD036: a section is a heading, not a line of bold text.
  assert.deepEqual(
    pr.split('\n').filter((l) => /^\*\*[^*]+\*\*\s*$/.test(l)),
    [],
    'bold used as a heading',
  );
});
