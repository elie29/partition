// Tests of the YAML subset and of budget.mjs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { tmp, x, budgetPath, repo } from './helpers.mjs';

const { parseYaml, globToRegex, measureProject, measurePackage, validate } = await import(budgetPath);

// ------------------------------------------------------------------ YAML subset
test('yaml: maps, lists, flow lists, scalars, comments', () => {
  const y = parseYaml(
    [
      '# comment',
      'version: 1',
      'name: "a: b"   # trailing',
      "quote: 'it''s'",
      'on: true',
      'none: ~',
      'budget:',
      '  always: 32000',
      'list: [a, "b c", 3]',
      'contexts:',
      '  - id: orders',
      '    code:',
      '      - src/orders/**',
      '      - "**/*.sql"',
      '  - id: billing',
      'relations:',
      '- buyer -> shop: asks [HTTPS]',
      '- shop --> buyer: answers',
    ].join('\n'),
  );
  assert.deepEqual(y, {
    version: 1,
    name: 'a: b',
    quote: "it's",
    on: true,
    none: null,
    budget: { always: 32000 },
    list: ['a', 'b c', 3],
    contexts: [{ id: 'orders', code: ['src/orders/**', '**/*.sql'] }, { id: 'billing' }],
    relations: [{ 'buyer -> shop': 'asks [HTTPS]' }, { 'shop --> buyer': 'answers' }],
  });
});
for (const [name, src, line] of [
  ['a tab', 'a:\n\tb: 1', 2],
  ['a block scalar', 'a: 1\nb: |\n  text', 2],
  ['a flow map', 'a: {b: 1}', 1],
  ['": " in a plain value', 'a: 1\nb: 2\nc: see: this', 3],
  ['a duplicate key', 'a: 1\na: 2', 2],
  ['an unquoted leading *', 'a:\n  - **/x', 2],
  ['a stray indentation', 'a: 1\n   b: 2', 2],
]) {
  test(`yaml: ${name} fails with its line number`, () => {
    assert.throws(
      () => parseYaml(src, 'f.yml'),
      (e) => e.message.startsWith(`f.yml:${line}:`),
      `expected f.yml:${line}`,
    );
  });
}

// ------------------------------------------------------------------ globs
test('glob: **, *, ?, braces, directories', () => {
  const m = (g, p) => globToRegex(g).test(p);
  assert.ok(m('src/**', 'src/a/b.js'));
  assert.ok(m('src/**/*.java', 'src/A.java'));
  assert.ok(m('src/**/*.java', 'src/a/b/A.java'));
  assert.ok(!m('src/*.js', 'src/a/b.js'));
  assert.ok(m('**/*.{ts,tsx}', 'a/b.tsx'));
  assert.ok(m('docs/', 'docs/a/b.md'));
  assert.ok(!m('src/**', 'srcx/a.js'));
  assert.ok(m('a?.md', 'ab.md'));
  assert.ok(!m('a?.md', 'a/b.md'));
});

// ------------------------------------------------------------------ project gauges
const project = () =>
  tmp({
    'CLAUDE.md': x(400), // 100 tokens
    '.claude/rules/entry.md': x(200), // 50, no scope
    '.claude/rules/orders.md': `---\npaths:\n  - "src/orders/**"\n---\n${x(363)}`, // 400 chars = 100, scoped to orders
    '.claude/rules/billing.md': `---\npaths:\n  - "src/billing/**"\n---\n${x(362)}`, // scoped elsewhere
    '.claude/skills/s/SKILL.md': `---\nname: s\ndescription: ${x(38)}\n---\nbody`, // "s " + 38 = 40 chars = 10
    'docs/partition.yml':
      'budget:\n  always: 300\ncontexts:\n  - id: orders\n    code:\n      - src/orders/**\n  - id: billing\n    code:\n      - src/billing/**\n',
    'docs/specs/orders/spec.md': x(800), // 200
    'docs/specs/invariants.md': x(80), // 20, read with every context
    'src/orders/a.js': x(1200),
    'src/orders/b.js': x(800), // 500
    'src/billing/c.js': x(40),
    'node_modules/big/index.js': x(100000), // skipped
    'docs/plans/p1.md': `# P\n\n> **Status:** in progress\n> **Resume at:** Task 2 — go\n> **Last updated:** 2026-01-01 · uncommitted\n\n## Tasks\n\n- [x] Task 1 — a\n- [ ] Task 2 — b\n\n## Task 1 — a\n\n${x(4000)}\n\n## Task 2 — b\n\n${x(400)}\n\n## Decisions\n\n${x(400)}\n`,
    'docs/plans/p0.md': `# Old\n\n> **Status:** done\n\n${x(9000)}\n`,
  });
test('budget: every-session total, one gauge per bounded context, its threshold', () => {
  const r = measureProject(project());
  assert.equal(r.shared.tokens, 180, 'CLAUDE.md 100 + unscoped rule 50 + descriptions 10 + invariant register 20');
  assert.deepEqual(
    r.shared.unscopedRules.map((u) => u.file),
    ['.claude/rules/entry.md'],
  );
  const o = r.contexts.find((c) => c.id === 'orders');
  assert.equal(o.spec, 200);
  assert.equal(r.shared.register.tokens, 20);
  assert.deepEqual(
    o.scopedRules.map((s) => s.file),
    ['.claude/rules/orders.md'],
  );
  assert.equal(o.always, 480, '180 + spec 200 + scoped rule 100');
  assert.equal(o.alwaysOver, true);
  for (const gone of ['full', 'fullOver', 'code', 'codeFiles', 'contracts', 'largest'])
    assert.equal(o[gone], undefined, `${gone}: no task reads the whole code`);
  assert.equal(r.limits.full, undefined);
  const b = r.contexts.find((c) => c.id === 'billing');
  assert.equal(b.specFound, false);
  assert.equal(b.always, 280, 'no spec: every session 180 + the rule scoped to its code 100');
});
test('budget: the area file counts only for the bounded contexts of its area, and a missing one is said', () => {
  const root = tmp({
    'CLAUDE.md': x(400), // 100
    'docs/partition.yml': [
      'contexts:',
      '  - id: payment',
      '    area: billing',
      '  - id: refund',
      '    area: billing',
      '  - id: product',
      '    area: catalog',
      '  - id: audit',
    ].join('\n'),
    'docs/specs/invariants.md': x(80), // 20, every bounded context
    'docs/specs/billing/area.md': x(160), // 40, billing only
    'docs/specs/billing/payment/spec.md': x(400), // 100
    'docs/specs/billing/refund/spec.md': x(200), // 50
    'docs/specs/catalog/product/spec.md': x(40), // 10, no area file in catalog
    'docs/specs/audit/spec.md': x(40), // 10, in no area
  });
  const r = measureProject(root);
  const c = Object.fromEntries(r.contexts.map((k) => [k.id, k]));
  assert.equal(r.shared.tokens, 120, 'CLAUDE.md 100 + invariant register 20: the area file is not shared');
  assert.deepEqual(c.payment.areaFile, {
    area: 'billing',
    file: 'docs/specs/billing/area.md',
    found: true,
    tokens: 40,
  });
  assert.equal(c.payment.always, 260, '120 + area file 40 + spec 100');
  assert.equal(c.refund.always, 210, '120 + area file 40 + spec 50');
  assert.equal(c.product.specFound, true, 'the spec of a bounded context in an area is under its area');
  assert.deepEqual(c.product.areaFile, {
    area: 'catalog',
    file: 'docs/specs/catalog/area.md',
    found: false,
    tokens: 0,
  });
  assert.equal(c.product.always, 130);
  assert.equal(c.audit.areaFile, null);
  assert.equal(c.audit.always, 130);
  const out = execFileSync(process.execPath, [fileURLToPath(budgetPath), '--root', root], { encoding: 'utf8' });
  assert.match(out, /Area file of billing: docs\/specs\/billing\/area\.md \(40\), read by payment, refund\./);
  assert.match(out, /Area catalog: no area file at docs\/specs\/catalog\/area\.md \(bounded contexts: product\)\./);
});
test('budget: the package report names its folder relative to where it runs, never a local path', () => {
  const out = execFileSync(process.execPath, [fileURLToPath(budgetPath), '--package', '.'], {
    cwd: repo,
    encoding: 'utf8',
  });
  assert.match(out, /^## Package budget — partition$/m, 'named after its apm.yml');
  assert.doesNotMatch(out, /[A-Za-z]:\\|\/Users\/|\/home\//);
  assert.doesNotMatch(out, /^# /m, 'a record pastes it under its own title');
});
test('budget: the report shows the gauge against its threshold, then what makes it up, and no code', () => {
  const out = execFileSync(process.execPath, [fileURLToPath(budgetPath), '--root', project()], { encoding: 'utf8' });
  assert.doesNotMatch(out, /^# /m, 'a record pastes it under its own title');
  assert.match(out, /^\| Bounded context \| Always \| of 300 \|$/m);
  assert.match(out, /^\| orders \| 480 \| 160 % OVER \|$/m);
  assert.match(out, /^\| Bounded context \| Every session \| Spec \| Area file \| Scoped rules \|$/m);
  assert.match(out, /^\| orders \| 180 \| 200 \| — \| 100 \|$/m);
  assert.doesNotMatch(out, /Full|Code|Contracts|Largest files/);
  assert.doesNotMatch(out, /\| \|$/m, 'every column has a title');
});
test('budget: a package without apm.yml is named after its folder', () => {
  const dir = tmp({ '.apm/instructions/p.instructions.md': x(40) });
  assert.equal(measurePackage(dir).name, path.basename(dir));
});
test('budget: a plan in progress is measured whole and as read on resume; a done plan is ignored', () => {
  const r = measureProject(project());
  assert.equal(r.plans.length, 1);
  const p = r.plans[0];
  assert.ok(p.whole > 1200, `whole ${p.whole}`);
  assert.ok(p.resume < 200, `resume ${p.resume}`);
  assert.ok(p.resume > 100, `resume ${p.resume}`);
  assert.equal(p.wholeOver, true);
});
test('budget: bridge only names the tool that writes the plans; the folder is paths.plans, docs/plans by default', () => {
  const plan = '# P\n\n> **Status:** in progress\n> **Resume at:** Task 1 — go\n\n## Tasks\n\n- [ ] Task 1 — a\n';
  const declared = tmp({
    'docs/partition.yml': 'bridge: superpowers\npaths:\n  plans: docs/work\n',
    'docs/work/p.md': plan,
  });
  assert.equal(measureProject(declared).plans.length, 1);
  const byDefault = tmp({ 'docs/partition.yml': 'bridge: superpowers\n', 'docs/plans/p.md': plan });
  assert.equal(measureProject(byDefault).plans.length, 1);
});
test('schema: bridge takes any tool name, and designs is not a key', () => {
  assert.equal(findings('bridge: bmad\n'), '');
  assert.ok(findings('paths:\n  designs: docs/designs\n').includes('\n  - paths.designs: unknown key'));
});
test('budget: the copilot target reads its own files', () => {
  const dir = tmp({
    '.github/copilot-instructions.md': x(400),
    '.github/instructions/a.instructions.md': `---\napplyTo: "**"\n---\n${x(376)}`,
    '.github/instructions/b.instructions.md': `---\napplyTo: "src/**/*.ts, src/**/*.html"\n---\n${x(100)}`,
    'docs/partition.yml': 'target: copilot\ncontexts:\n  - id: web\n    code:\n      - src/**\n',
    'src/app/a.ts': x(40),
  });
  const r = measureProject(dir);
  assert.equal(r.shared.tokens, 200);
  assert.equal(r.contexts[0].scopedRules.length, 1);
});
test('budget: the deployed instruction counts in every session as the instruction, not as a rule without a scope', () => {
  for (const [target, file, rest] of [
    ['claude', '.claude/rules/partition.md', { 'CLAUDE.md': x(400) }],
    ['copilot', '.github/instructions/partition.instructions.md', { '.github/copilot-instructions.md': x(400) }],
  ]) {
    const dir = tmp({
      ...rest,
      [file]: `---\ndescription: d\n---\n${x(177)}`, // 200 chars = 50, no scope (BR-6)
      'docs/partition.yml': `target: ${target}\ncontexts:\n  - id: shelf\n    code:\n      - src/**\n`,
    });
    const r = measureProject(dir);
    assert.deepEqual(r.shared.unscopedRules, [], target);
    assert.deepEqual(r.shared.instruction, [{ file, tokens: 50 }], target);
    assert.equal(r.shared.tokens, 150, `${target}: entry 100 + instruction 50`);
    const out = execFileSync(process.execPath, [fileURLToPath(budgetPath), '--root', dir], { encoding: 'utf8' });
    assert.ok(out.includes(`| ${file} (instruction) | 50 |`), target);
    assert.doesNotMatch(out, /without a scope/, target);
  }
});
test('budget: without docs/partition.yml the script says how to create it and exits 2', () => {
  try {
    execFileSync('node', [fileURLToPath(budgetPath), '--root', tmp({ 'a.txt': 'a' })], { stdio: 'pipe' });
    assert.fail('should exit 2');
  } catch (e) {
    assert.equal(e.status, 2);
    assert.match(String(e.stderr), /partition-budget/);
  }
});
test('budget: --check exits 1 when a gauge is over', () => {
  try {
    execFileSync('node', [fileURLToPath(budgetPath), '--root', project(), '--check'], { stdio: 'pipe' });
    assert.fail('should exit 1');
  } catch (e) {
    assert.equal(e.status, 1);
    assert.match(String(e.stdout), /OVER/);
  }
});

test('budget: --config is not an option; the configuration is docs/partition.yml', () => {
  const root = project();
  try {
    execFileSync(
      process.execPath,
      [fileURLToPath(budgetPath), '--root', root, '--config', `${root}/docs/partition.yml`],
      { stdio: 'pipe' },
    );
    assert.fail('should exit 2');
  } catch (e) {
    assert.equal(e.status, 2);
    assert.match(String(e.stderr), /unknown option --config/);
  }
  const help = execFileSync(process.execPath, [fileURLToPath(budgetPath), '--help'], { encoding: 'utf8' });
  assert.doesNotMatch(help, /--config/);
});

// ------------------------------------------------------------------ the schema of docs/partition.yml
const findings = (yml) => {
  try {
    measureProject(tmp({ 'docs/partition.yml': yml }));
  } catch (e) {
    assert.equal(e.exitCode, 2, e.message);
    return e.message;
  }
  return '';
};
test('schema: every finding is listed at once, each with its path', () => {
  const msg = findings(
    [
      'version: 2',
      'target: cursor',
      'budjet:',
      '  always: 1000',
      'budget:',
      '  always: "many"',
      'contexts:',
      '  - id: orders',
      '    hexagon: x',
      '    code: src/orders/**',
      '    hexagons:',
      '      - id: orders',
      '        form: fat',
      '        layers:',
      '          inbound:',
      '            - src/in/**',
      '  - area: sales',
    ].join('\n'),
  );
  assert.match(msg, /^docs\/partition\.yml does not follow partition\.schema\.json:$/m);
  for (const line of [
    'version: 2 is not one of 1',
    'target: "cursor" is not one of "claude", "copilot"',
    'budjet: unknown key',
    'budget.always: expected integer, found string',
    'contexts[0].hexagon: unknown key',
    'contexts[0].code: expected array, found string',
    'contexts[0].hexagons[0].form: "fat" is not one of "thin", "rich"',
    'contexts[0].hexagons[0].layers.inbound: expected string, found array',
    'contexts[1].id: missing',
  ])
    assert.ok(msg.includes(`\n  - ${line}`), `${line}\n--- got:\n${msg}`);
});
test('schema: exclude is not a key; the code is not counted, so nothing needs excluding', () => {
  assert.ok(findings('exclude:\n  - "**/*.snap"\n').includes('\n  - exclude: unknown key'));
});
test('schema: a key without a value counts as absent; the file partition-plan creates passes', () => {
  assert.equal(findings('bridge:\ncontexts:\n'), '');
  assert.equal(findings('paths:\n  plans: docs/plans\n'), '');
});
test('schema: chars_per_token must be above 0', () => {
  for (const v of ['0', '-1'])
    assert.ok(
      findings(`budget:\n  chars_per_token: ${v}\n`).includes(`\n  - budget.chars_per_token: ${v} is not above 0`),
      v,
    );
  assert.equal(findings('budget:\n  chars_per_token: 3.5\n'), '');
});
test('schema: a key named like a built-in of objects is still unknown', () => {
  const msg = findings('toString: x\nbudget:\n  constructor: 1\n');
  assert.ok(msg.includes('\n  - toString: unknown key'), msg);
  assert.ok(msg.includes('\n  - budget.constructor: unknown key'), msg);
});
test("schema: the layer names are the project's", () => {
  const yml =
    'contexts:\n  - id: a\n    hexagons:\n      - id: a\n        layers:\n          driving: src/a/**\n          ports: src/p/**\n';
  assert.equal(findings(yml), '');
});
test('schema: an integer passes where a number is expected; the root is named', () => {
  const schema = { type: 'object', properties: { n: { type: 'number' } } };
  assert.deepEqual(validate({ n: 4 }, schema), []);
  assert.deepEqual(validate([], schema), ['(root): expected object, found array']);
});
test('schema: without the schema beside it the script says so and exits 2', () => {
  const dir = tmp({ 'docs/partition.yml': 'version: 1\n' });
  const copy = path.join(dir, 'skill/scripts/budget.mjs');
  fs.mkdirSync(path.dirname(copy), { recursive: true });
  fs.copyFileSync(fileURLToPath(budgetPath), copy);
  try {
    execFileSync(process.execPath, [copy, '--root', dir], { stdio: 'pipe' });
    assert.fail('should exit 2');
  } catch (e) {
    assert.equal(e.status, 2);
    assert.match(String(e.stderr), /partition\.schema\.json/);
    assert.doesNotMatch(String(e.stderr), /\n\s+at /, 'no stack trace');
  }
});
