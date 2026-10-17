// Tests of c4-drawio.mjs: the model and its validation, the views, and the three guarantees of the
// generated file: (a) what a person placed stays in place, (b) an unknown id fails, (c) the XML is well formed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { tmp, c4Path, budgetPath } from './helpers.mjs';

const SAMPLE = `title: Shop platform
elements:
  - id: buyer
    kind: person
    name: Buyer
    description: Orders goods
  - id: shop
    kind: system
    name: Shop
    description: Sells goods online
  - id: web
    kind: container
    in: shop
    name: Web app
    technology: SPA
    description: What the buyer sees
    color: orange
    context: orders
  - id: api
    kind: container
    in: shop
    name: API
    technology: Node.js
    description: Takes and tracks orders
  - id: db
    kind: container
    in: shop
    name: Database
    technology: PostgreSQL
    description: Orders and stock
    color: blue
  - id: cart
    kind: component
    in: web
    name: Cart
    description: Holds the basket
  - id: orders-endpoint
    kind: component
    in: api
    name: Orders endpoint
    technology: HTTP
    description: Receives the orders
  - id: order-service
    kind: component
    in: api
    name: Order service
    description: Applies the rules of an order
  - id: order-store
    kind: component
    in: api
    name: Order store
    technology: SQL
    description: Reads and writes orders
  - id: psp
    kind: system
    external: true
    name: Payment provider
    description: Takes the money
relations:
  - buyer -> web: places orders [HTTPS]
  - web -> api: calls [JSON/HTTPS]
  - api -> db: reads and writes [SQL]
  - web -> psp: sends the buyer to pay [HTTPS]
  - psp -> api: confirms the payment [webhook]
  - cart -> orders-endpoint: posts the basket [JSON/HTTPS]
  - orders-endpoint -> order-service: hands over
  - order-service -> order-store
  - order-store -> db: [SQL]
  - order-service -> cart: pushes the status [SSE]
views:
  - id: context
    kind: context
    of: shop
    title: C4 1 - Context
  - id: containers
    kind: containers
    of: shop
    title: C4 2 - Containers
  - id: api-components
    kind: components
    of: api
    title: C4 3 - API
  - id: checkout
    kind: dynamic
    title: Dynamic - Checkout
    participants: [web, api, db]
    steps:
      - web -> api: POST /orders
      - api -> db: insert order
      - db --> api: order id
      - api --> web: 201 Created
  - id: save-order
    kind: dynamic
    title: Dynamic - Save an order
    steps:
      - orders-endpoint -> order-service: place(order)
      - order-service -> order-service: check the rules
      - order-service -> order-store: save(order)
      - order-store --> order-service: order id
`;

const c4 = await import(c4Path);
const load = (text) => c4.loadModel(text, 'model.yml');
const draw = (text, existing = null) => c4.generate(load(text), existing);
// Replaces one piece of the sample; fails when the piece is not there, so that a test cannot pass by accident.
const change = (text, from, to) => {
  assert.ok(text.includes(from), `the sample has no "${from}"`);
  return text.replace(from, () => to);
};

// ------------------------------------------------------------------ reading the XML back
const attrs = (s) => Object.fromEntries([...s.matchAll(/([\w:.-]+)\s*=\s*"([^"]*)"/g)].map((m) => [m[1], m[2]]));
// [{ id, name, raw, cells: [{ ...attributes, geo, points, inner, raw }] }], whatever the order of the attributes.
const pagesOf = (xml) =>
  [...xml.matchAll(/<diagram\b([^>]*)>([\s\S]*?)<\/diagram>/g)].map((d) => ({
    ...attrs(d[1]),
    raw: d[0],
    cells: [...d[2].matchAll(/<mxCell\b((?:[^>"]|"[^"]*")*?)(?:\/>|>([\s\S]*?)<\/mxCell>)/g)].map((c) => ({
      ...attrs(c[1]),
      raw: c[0],
      inner: (c[2] ?? '').trim(),
      geo: attrs(/<mxGeometry\b([^>]*)/.exec(c[2] ?? '')?.[1] ?? ''),
      points: Object.fromEntries(
        [...(c[2] ?? '').matchAll(/<mxPoint\b([^>]*?)\/?>/g)]
          .map((p) => attrs(p[1]))
          .map((p) => [p.as, { x: Number(p.x), y: Number(p.y) }]),
      ),
    })),
  }));
const page = (xml, id) => pagesOf(xml).find((p) => p.id === id);
const cell = (xml, pageId, id) => page(xml, pageId).cells.find((c) => c.id === id);
const ids = (xml, pageId) => page(xml, pageId).cells.map((c) => c.id);
const plain = (style) => style.replace(/(^|;)partition=[^;]*;/, '$1'); // a style without the generator's mark
const rect = (c) => ({ x: Number(c.geo.x), y: Number(c.geo.y), w: Number(c.geo.width), h: Number(c.geo.height) });
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

// Well-formed XML: the tags balance, there is no text between them, an attribute appears once
// in a tag and its value holds no raw < and no & that does not start an entity.
function checkXml(xml) {
  const open = [];
  let last = 0;
  for (const m of xml.matchAll(/<(\/?)([A-Za-z][\w.-]*)((?:[^<>"']|"[^"]*"|'[^']*')*?)(\/?)>/g)) {
    assert.equal(xml.slice(last, m.index).trim(), '', `stray text before ${m[0].slice(0, 60)}`);
    last = m.index + m[0].length;
    const [, closing, name, rest, empty] = m;
    if (closing) {
      assert.equal(open.pop(), name, `</${name}> closes nothing`);
      continue;
    }
    const pairs = [...rest.matchAll(/\s+([\w:.-]+)="([^"]*)"/g)];
    assert.equal(
      rest.replace(/\s+[\w:.-]+="[^"]*"/g, '').trim(),
      '',
      `malformed attributes in <${name}${rest.slice(0, 60)}`,
    );
    assert.equal(
      new Set(pairs.map((p) => p[1])).size,
      pairs.length,
      `an attribute is repeated in <${name}${rest.slice(0, 60)}`,
    );
    for (const [, key, value] of pairs) {
      assert.ok(!value.includes('<'), `raw < in ${key} of <${name}>`);
      assert.ok(
        !/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/.test(value),
        `raw & in ${key} of <${name}>: ${value.slice(0, 60)}`,
      );
    }
    if (!empty) open.push(name);
  }
  assert.equal(xml.slice(last).trim(), '', 'stray text at the end');
  assert.deepEqual(open, [], 'tags left open');
  for (const name of ['mxfile', 'diagram', 'mxGraphModel', 'root', 'mxCell', 'mxGeometry'])
    assert.ok(xml.includes(`<${name}`), `no <${name}>`);
  assert.ok(xml.startsWith('<mxfile host='), 'the file starts with <mxfile>');
}

// ------------------------------------------------------------------ model and validation
test('the sample model loads and validates with no error', () => {
  const m = load(SAMPLE);
  assert.deepEqual(c4.validate(m), []);
  assert.equal(m.title, 'Shop platform');
  assert.equal(m.elements.length, 10);
  assert.equal(m.views.length, 5);
  assert.deepEqual(m.elements[2], {
    id: 'web',
    kind: 'container',
    in: 'shop',
    name: 'Web app',
    technology: 'SPA',
    description: 'What the buyer sees',
    color: 'orange',
    context: 'orders',
    external: false,
  });
  assert.equal(m.elements.find((e) => e.id === 'psp').external, true);
});
test('a relation is read with or without a label and a protocol, a step as a call or a return', () => {
  const m = load(SAMPLE),
    rel = (n) => {
      const { from, to, label, protocol } = m.relations[n - 1];
      return [from, to, label, protocol];
    };
  assert.deepEqual(rel(1), ['buyer', 'web', 'places orders', 'HTTPS']);
  assert.deepEqual(rel(7), ['orders-endpoint', 'order-service', 'hands over', '']);
  assert.deepEqual(rel(8), ['order-service', 'order-store', '', ''], 'a plain string item');
  assert.deepEqual(rel(9), ['order-store', 'db', '', 'SQL'], 'a protocol alone');
  const steps = m.views.find((v) => v.id === 'checkout').steps;
  assert.deepEqual(
    steps.map((s) => [s.from, s.to, s.ret, s.label]),
    [
      ['web', 'api', false, 'POST /orders'],
      ['api', 'db', false, 'insert order'],
      ['db', 'api', true, 'order id'],
      ['api', 'web', true, '201 Created'],
    ],
  );
});
for (const [name, from, to, message] of [
  [
    'an "in" that is not an element',
    'in: shop\n    name: Web app',
    'in: shopx\n    name: Web app',
    'element "web": "in" refers to "shopx", which is not an element of the model',
  ],
  [
    'a container outside a system',
    'in: shop\n    name: Web app',
    'in: buyer\n    name: Web app',
    'element "web": a container lives in a system, but "buyer" is a person',
  ],
  [
    'a component outside a container',
    'in: web\n    name: Cart',
    'in: shop\n    name: Cart',
    'element "cart": a component lives in a container, but "shop" is a system',
  ],
  [
    'a container without "in"',
    '    in: shop\n    name: Web app',
    '    name: Web app',
    'element "web": a container needs "in", the id of its system',
  ],
  ['a person with "in"', 'kind: person', 'kind: person\n    in: shop', 'element "buyer": a person has no "in"'],
  [
    'an unknown kind of element',
    'kind: person',
    'kind: actor',
    'element "buyer": kind "actor" is unknown; use person, system, container or component',
  ],
  [
    'an unknown relation endpoint',
    'web -> api: calls',
    'web -> apix: calls',
    'relation 2 (web -> apix) uses "apix", which is not an element of the model',
  ],
  [
    'a relation that is not "from -> to"',
    'buyer -> web: places',
    'buyer => web: places',
    'relation 1: expected "from -> to: label [protocol]"',
  ],
  [
    'an unknown "of"',
    'of: shop\n    title: C4 1',
    'of: shopx\n    title: C4 1',
    'view "context": "of" refers to "shopx", which is not an element of the model',
  ],
  [
    'a containers view of a container',
    'of: shop\n    title: C4 2',
    'of: api\n    title: C4 2',
    'view "containers": a containers view needs a system, but "api" is a container',
  ],
  [
    'a components view of a system',
    'of: api\n    title: C4 3',
    'of: shop\n    title: C4 3',
    'view "api-components": a components view needs a container, but "shop" is a system',
  ],
  [
    'an unknown kind of view',
    'kind: containers',
    'kind: deployment',
    'view "containers": kind "deployment" is unknown; use context, containers, components or dynamic',
  ],
  [
    'an unknown step endpoint',
    'api -> db: insert order',
    'api -> dbx: insert order',
    'view "checkout": step 2 uses "dbx", which is not an element of the model',
  ],
  [
    'a step endpoint missing from participants',
    'participants: [web, api, db]',
    'participants: [web, api]',
    'view "checkout": step 2 uses "db", which is not listed in participants',
  ],
  [
    'an unknown participant',
    'participants: [web, api, db]',
    'participants: [web, api, db, ghost]',
    'view "checkout": participants lists "ghost", which is not an element of the model',
  ],
  [
    'a dynamic view without a step',
    '    steps:\n      - web -> api: POST /orders\n      - api -> db: insert order\n      - db --> api: order id\n      - api --> web: 201 Created\n',
    '',
    'view "checkout": a dynamic view needs at least one step',
  ],
  ['a duplicate element id', '  - id: db\n', '  - id: api\n', 'element "api" is declared twice; ids are unique'],
  [
    'a duplicate view id',
    '  - id: containers\n',
    '  - id: context\n',
    'view "context" is declared twice; ids are unique',
  ],
  [
    'an id that is not lowercase letters, digits and hyphens',
    '  - id: containers\n',
    '  - id: C4_Containers\n',
    'view "C4_Containers": an id is made of lowercase letters, digits and single hyphens',
  ],
  [
    'an unknown colour',
    'color: blue',
    'color: pink',
    'element "db": color "pink" is unknown; use red, green, orange, purple, blue, grey, yellow, amber, white',
  ],
  [
    'a model without a view',
    SAMPLE.slice(SAMPLE.indexOf('views:\n')),
    '',
    'the model has no view; a draw.io file needs at least one page',
  ],
  [
    'a step that is not "from -> to" or "from --> to"',
    'api -> db: insert order',
    'api => db: insert order',
    'view "checkout": step 2: expected "from -> to: label" or "from --> to: label"',
  ],
  [
    'a relation written as a return',
    'web -> api: calls',
    'web --> api: calls',
    'relation 2: expected "from -> to: label [protocol]"',
  ],
]) {
  test(`validation reports ${name}`, () => {
    const errors = c4.validate(load(change(SAMPLE, from, to)));
    assert.ok(errors.includes(message), `expected "${message}"\n got: ${errors.join(' | ') || '(no error)'}`);
  });
}
test('validation collects every error, and nothing is generated from a model that has one', () => {
  const bad = change(
    change(change(SAMPLE, 'color: blue', 'color: pink'), 'web -> api: calls', 'web -> apix: calls'),
    'api -> db: insert order',
    'api -> dbx: insert order',
  );
  assert.equal(c4.validate(load(bad)).length, 3);
  assert.throws(() => draw(bad), /view "checkout": step 2 uses "dbx"/);
  assert.throws(() => c4.mermaid(load(bad), 'checkout'), /relation 2 \(web -> apix\) uses "apix"/);
});

test('a color, a kind or a view kind named like a built-in of objects is unknown', () => {
  const bad = change(change(SAMPLE, 'color: orange', 'color: toString'), 'kind: person', 'kind: constructor');
  const errs = c4.validate(load(bad));
  assert.ok(
    errs.some((e) => /element "web": color "toString" is unknown/.test(e)),
    errs.join('\n'),
  );
  assert.ok(
    errs.some((e) => /element "buyer": kind "constructor" is unknown/.test(e)),
    errs.join('\n'),
  );
  const view = c4.validate(load(SAMPLE.replace(/kind: (context|containers|components)\b/, 'kind: toString')));
  assert.ok(
    view.some((e) => /view "[a-z-]+": kind "toString" is unknown/.test(e)),
    view.join('\n'),
  );
});

// ------------------------------------------------------------------ what a static view shows
test('the context view lifts a relation of a container to its system', () => {
  const xml = draw(SAMPLE);
  assert.deepEqual(ids(xml, 'context'), [
    '0',
    '1',
    'context--e--shop',
    'context--e--buyer',
    'context--e--psp',
    'context--r--buyer--shop--1',
    'context--r--shop--psp--1',
    'context--r--psp--shop--1',
  ]);
  const lifted = cell(xml, 'context', 'context--r--shop--psp--1'); // web -> psp in the model
  assert.equal(lifted.source, 'context--e--shop');
  assert.equal(lifted.target, 'context--e--psp');
  assert.match(lifted.value, /^sends the buyer to pay&lt;br&gt;.*\[HTTPS\]/);
  assert.equal(lifted.edge, '1');
  assert.ok(
    lifted.style.startsWith(
      'edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;endArrow=block;endFill=1;endSize=9;strokeColor=#333333;strokeWidth=2;fontFamily=IBM Plex Sans;fontSize=15;fontColor=#000000;labelBackgroundColor=#FFFFFF;spacing=3;',
    ),
  );
  assert.match(
    plain(lifted.style),
    /spacing=3;exitX=[\d.]+;exitY=[\d.]+;exitPerimeter=0;entryX=[\d.]+;entryY=[\d.]+;entryPerimeter=0;$/,
  );
  assert.match(
    cell(xml, 'context', 'context--r--buyer--shop--1').inner,
    /^<mxGeometry relative="1" as="geometry">\s*<Array as="points">/,
  );
  // two relations between the same boxes run on tracks of their own, the label at the middle of each
  const back = cell(xml, 'context', 'context--r--psp--shop--1');
  assert.notEqual(anchorsOf(lifted).join(), [...anchorsOf(back).slice(2), ...anchorsOf(back).slice(0, 2)].join());
  assert.doesNotMatch(lifted.inner + back.inner, /<mxGeometry x=/);
});
test('the containers view shows the children in a boundary and merges the relations that lift to the same one', () => {
  const xml = draw(
    change(
      SAMPLE,
      '  - order-store -> db: [SQL]\n',
      '  - order-store -> db: [SQL]\n  - cart -> order-service: calls [gRPC]\n',
    ),
  );
  assert.deepEqual(
    ids(xml, 'containers').filter((id) => !id.includes('--r--')),
    [
      '0',
      '1',
      'containers--b--shop',
      'containers--e--web',
      'containers--e--api',
      'containers--e--db',
      'containers--e--buyer',
      'containers--e--psp',
    ],
  );
  assert.deepEqual(
    ids(xml, 'containers').filter((id) => id.includes('--r--web--api--')),
    ['containers--r--web--api--1', 'containers--r--web--api--2'],
  );
  assert.match(
    cell(xml, 'containers', 'containers--r--web--api--1').value,
    /^calls&lt;br&gt;.*\[JSON\/HTTPS, gRPC\]/,
    'web -> api and cart -> order-service, both "calls"',
  );
  assert.match(
    cell(xml, 'containers', 'containers--r--web--api--2').value,
    /^posts the basket/,
    'cart -> orders-endpoint',
  );
  assert.match(
    cell(xml, 'containers', 'containers--r--api--web--1').value,
    /^pushes the status/,
    'order-service -> cart',
  );
  assert.match(cell(xml, 'containers', 'containers--b--shop').value, /^&lt;b&gt;Shop&lt;\/b&gt; \[System\]$/);
});
test('the components view lifts an outside end to its container and drops what does not touch a component', () => {
  const xml = draw(SAMPLE),
    all = ids(xml, 'api-components');
  assert.deepEqual(all, [
    '0',
    '1',
    'api-components--b--api',
    'api-components--e--orders-endpoint',
    'api-components--e--order-service',
    'api-components--e--order-store',
    'api-components--e--web',
    'api-components--e--db',
    'api-components--r--web--orders-endpoint--1',
    'api-components--r--orders-endpoint--order-service--1',
    'api-components--r--order-service--order-store--1',
    'api-components--r--order-store--db--1',
    'api-components--r--order-service--web--1',
  ]);
  const toDb = cell(xml, 'api-components', 'api-components--r--order-store--db--1'); // a component to a container of the same system
  assert.equal(toDb.source, 'api-components--e--order-store');
  assert.equal(toDb.target, 'api-components--e--db');
  const toWeb = cell(xml, 'api-components', 'api-components--r--order-service--web--1'); // to "cart", a component of another container
  assert.equal(toWeb.source, 'api-components--e--order-service');
  assert.equal(toWeb.target, 'api-components--e--web');
});
test('a box carries the name, the type line and the description, in the colours of the palette', () => {
  const xml = draw(SAMPLE),
    web = cell(xml, 'containers', 'containers--e--web'),
    psp = cell(xml, 'context', 'context--e--psp');
  assert.equal(
    web.value,
    '&lt;span style=&quot;font-size:21px;font-weight:600;color:#000000&quot;&gt;Web app&lt;/span&gt;&lt;br&gt;' +
      '&lt;span style=&quot;font-family:IBM Plex Mono;font-size:14px;color:#666666&quot;&gt;[Container: SPA · orders]&lt;/span&gt;&lt;br&gt;' +
      '&lt;span style=&quot;font-size:16px;color:#333333;line-height:1.3&quot;&gt;What the buyer sees&lt;/span&gt;',
  );
  assert.equal(
    plain(web.style),
    'rounded=1;absoluteArcSize=1;arcSize=14;html=1;whiteSpace=wrap;fillColor=#ffe6cc;strokeColor=#d79b00;strokeWidth=2;fontFamily=IBM Plex Sans;align=left;verticalAlign=top;spacingLeft=14;spacingRight=10;spacingTop=10;',
  );
  assert.match(psp.value, /\[External system\]/);
  assert.match(psp.style, /fillColor=#f5f5f5;strokeColor=#666666;/);
  assert.match(
    cell(xml, 'containers', 'containers--e--api').style,
    /fillColor=#e1d5e7;strokeColor=#9673a6;/,
    'a container is purple by default',
  );
  assert.match(
    cell(xml, 'api-components', 'api-components--e--order-service').value,
    /\[Component\]/,
    'no technology, no colon',
  );
  assert.match(
    cell(xml, 'api-components', 'api-components--b--api').style,
    /arcSize=20;.*fillColor=#e1d5e7;.*verticalAlign=bottom;/,
  );
});

// ------------------------------------------------------------------ guarantee (c): well-formed XML
test('the output is well-formed XML with one page per view', () => {
  const xml = draw(SAMPLE);
  checkXml(xml);
  assert.deepEqual(
    pagesOf(xml).map((p) => [p.id, p.name]),
    [
      ['context', 'C4 1 - Context'],
      ['containers', 'C4 2 - Containers'],
      ['api-components', 'C4 3 - API'],
      ['checkout', 'Dynamic - Checkout'],
      ['save-order', 'Dynamic - Save an order'],
    ],
  );
  assert.equal(xml.match(/<mxGraphModel\b[^>]*background="#FFFFFF"/g).length, 5);
  for (const p of pagesOf(xml)) {
    const all = p.cells.map((c) => c.id);
    assert.equal(new Set(all).size, all.length, `ids are unique on page ${p.id}`);
    assert.deepEqual(all.slice(0, 2), ['0', '1']);
    for (const c of p.cells.slice(2)) {
      assert.ok(c.id.startsWith(`${p.id}--`), `${c.id} starts with the id of its view`);
      assert.equal(c.parent, '1');
      assert.ok((c.vertex === '1') !== (c.edge === '1'), `${c.id} is a vertex or an edge`);
      assert.match(c.inner, /^<mxGeometry\b/);
    }
  }
});
test('text of the model with &, <, > and quotes stays well formed and readable', () => {
  const xml = draw(
    change(
      change(
        change(SAMPLE, 'name: Web app', 'name: "R&D <web> \\"app\\""'),
        'title: C4 2 - Containers',
        'title: "Containers & <more>"',
      ),
      'api -> db: insert order',
      'api -> db: "insert: it\'s <order> & more"',
    ),
  );
  checkXml(xml);
  assert.equal(page(xml, 'containers').name, 'Containers &amp; &lt;more&gt;');
  // The value is HTML: the text is escaped for HTML, then the whole value for the attribute.
  assert.ok(
    cell(xml, 'containers', 'containers--e--web').value.includes(
      '&gt;R&amp;amp;D &amp;lt;web&amp;gt; &amp;quot;app&amp;quot;&lt;/span&gt;',
    ),
  );
  assert.ok(
    cell(xml, 'checkout', 'checkout--s--2').value.endsWith('insert: it&amp;#39;s &amp;lt;order&amp;gt; &amp;amp; more'),
  );
  // a byte order mark at the start of the model is ignored, a character that XML forbids is dropped
  const odd = draw(`\uFEFF${change(SAMPLE, 'name: Buyer', 'name: Bu\x01y\x0Ber')}`);
  checkXml(odd);
  assert.ok(!/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(odd));
  assert.ok(cell(odd, 'context', 'context--e--buyer').value.includes('&gt;Buyer&lt;/span&gt;'));
});

// ------------------------------------------------------------------ automatic layout
// Seven containers on four ranks with a cycle, four persons that call in, three systems that are called.
const WIDE = [
  'elements:',
  '  - id: sys',
  '    kind: system',
  '    name: Sys',
  ...[1, 2, 3, 4, 5, 6, 7].flatMap((n) => [`  - id: c${n}`, '    kind: container', '    in: sys', `    name: C${n}`]),
  ...[1, 2, 3, 4].flatMap((n) => [`  - id: p${n}`, '    kind: person', `    name: P${n}`]),
  ...[1, 2, 3].flatMap((n) => [`  - id: x${n}`, '    kind: system', '    external: true', `    name: X${n}`]),
  'relations:',
  '  - c1 -> c3',
  '  - c2 -> c3',
  '  - c3 -> c4',
  '  - c3 -> c5',
  '  - c5 -> c1: loops back',
  '  - c4 -> c6',
  '  - c1 -> c6',
  '  - p1 -> c1',
  '  - p2 -> c1',
  '  - p3 -> c2',
  '  - p4 -> c7',
  '  - c4 -> x1',
  '  - c6 -> x2',
  '  - x3 -> c5',
  '  - c5 -> x3',
  'views:',
  '  - id: ctx',
  '    kind: context',
  '    of: sys',
  '  - id: all',
  '    kind: containers',
  '    of: sys',
  '',
].join('\n');
for (const [name, text] of [
  ['the sample model', SAMPLE],
  ['a wider model with a cycle', WIDE],
]) {
  test(`no two boxes of a static view overlap and the outside boxes stay off the boundary, for ${name}`, () => {
    const model = load(text),
      xml = c4.generate(model, null);
    for (const view of model.views.filter((v) => v.kind !== 'dynamic')) {
      const cells = page(xml, view.id).cells,
        boxes = cells.filter((c) => c.id.includes('--e--'));
      assert.ok(boxes.length >= 3, `${view.id} shows ${boxes.length} boxes`);
      for (const a of boxes) {
        assert.deepEqual([rect(a).w, rect(a).h], [270, 140]);
        for (const b of boxes) if (a !== b) assert.ok(!overlap(rect(a), rect(b)), `${a.id} overlaps ${b.id}`);
      }
      const boundary = cells.find((c) => c.id.includes('--b--'));
      assert.equal(Boolean(boundary), view.kind !== 'context', 'a context view has no boundary');
      if (!boundary) continue;
      assert.ok(cells.indexOf(boundary) < cells.indexOf(boxes[0]), 'the boundary is drawn first, behind its children');
      const b = rect(boundary),
        children = new Set(model.elements.filter((e) => e.in === view.of).map((e) => `${view.id}--e--${e.id}`));
      for (const box of boxes) {
        const r = rect(box);
        if (!children.has(box.id)) {
          assert.ok(!overlap(r, b), `${box.id} is outside and touches the boundary`);
          continue;
        }
        assert.ok(
          r.x >= b.x + 40 && r.y >= b.y + 40 && r.x + r.w <= b.x + b.w - 40 && r.y + r.h <= b.y + b.h - 70,
          `${box.id} is inside the boundary, with its padding`,
        );
      }
    }
  });
}
test('the children are ranked by the relations among them: one row per rank, callers above, the others below', () => {
  const xml = c4.generate(load(WIDE), null),
    y = (id) => rect(cell(xml, 'all', `all--e--${id}`)).y,
    x = (id) => rect(cell(xml, 'all', `all--e--${id}`)).x;
  assert.ok(y('c1') === y('c2') && y('c2') === y('c7'), 'c1, c2 and c7 have no caller inside: first row');
  assert.equal(y('c3'), y('c1') + 250);
  assert.equal(y('c4'), y('c3') + 250);
  assert.equal(y('c5'), y('c4'));
  assert.equal(y('c6'), y('c4') + 250);
  assert.equal(x('c2'), x('c1') + 360, '90px between two boxes of a row');
  assert.ok(y('p1') < y('c1') && y('p4') === y('p1'), 'the persons only call in: row above');
  assert.ok(y('x1') > y('c6') && y('x3') === y('x1'), 'the systems that are called: row below');
  const b = rect(cell(xml, 'all', 'all--b--sys'));
  assert.equal(b.y - (y('p1') + 140), 110);
  assert.equal(y('x1') - (b.y + b.h), 110);
  assert.equal(x('c3') + 135, b.x + b.w / 2, 'a row is centred');
});

// ------------------------------------------------------------------ guarantee (a): hand positions survive
// What a person does in draw.io: move and resize a box, route and anchor an edge, add a note, add a page.
const MOVED = '<mxGeometry x="999" y="777" width="300" height="150" as="geometry"/>';
const ROUTED =
  '<mxGeometry relative="1" as="geometry"><Array as="points"><mxPoint x="500" y="620"/></Array></mxGeometry>';
const ANCHORS = 'exitX=0.25;exitY=1;entryX=0.25;entryY=0;';
const NOTE =
  '<mxCell id="note-1" value="Ask &amp;amp; check" style="shape=note;whiteSpace=wrap;html=1;" parent="1" vertex="1"><mxGeometry x="10" y="20" width="120" height="60" as="geometry"/></mxCell>';
const SKETCH =
  '<diagram id="sketch" name="Sketch"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="containers--e--api" value="mine" vertex="1" parent="1"><mxGeometry x="1" y="2" width="3" height="4" as="geometry"/></mxCell></root></mxGraphModel></diagram>';
const byHand = (xml) => {
  const box = cell(xml, 'containers', 'containers--e--api').raw,
    edge = cell(xml, 'containers', 'containers--r--web--psp--1').raw;
  const anchored = edge
    .replace(/style="([^"]*)"/, (m, style) => `style="${style.replace(/exitX=.*$/, '')}${ANCHORS}"`)
    .replace(/<mxGeometry[^>]*(?:\/>|>[\s\S]*?<\/mxGeometry>)/, () => ROUTED);
  return xml
    .replace(box, () => box.replace(/<mxGeometry[^>]*\/>/, () => MOVED))
    .replace(edge, () => anchored)
    .replace(/(<diagram id="containers"[\s\S]*?)(\s*<\/root>)/, (m, head, tail) => `${head}\n        ${NOTE}${tail}`)
    .replace('</mxfile>', () => `  ${SKETCH}\n</mxfile>`);
};
// A file a person arranged and draw.io saved before the generator marked its cells: every cell is the person's.
const arranged = (xml) =>
  xml
    .replace('<mxfile host="partition" agent="c4-drawio.mjs"', '<mxfile host="Electron"')
    .replace(/partition=[^;"]*;/g, '');
const GROWN = change(
  change(SAMPLE, 'Takes and tracks orders', 'Takes orders & tracks them'),
  'relations:\n',
  '  - id: cache\n    kind: container\n    in: shop\n    name: Cache\n    technology: Redis\nrelations:\n  - api -> cache: remembers [RESP]\n',
);

// ------------------------------------------------------------------ the layout of what is placed (BR-20)
const children = (model, view) =>
  new Set(model.elements.filter((e) => e.in === view.of).map((e) => `${view.id}--e--${e.id}`));
const holds = (b, r) =>
  r.x >= b.x + 40 && r.y >= b.y + 40 && r.x + r.w <= b.x + b.w - 40 && r.y + r.h <= b.y + b.h - 70;
// No two boxes overlap, an outside box stays off the boundary, the boundary holds each child with its pad and foot.
function assertPlaced(model, xml) {
  for (const view of model.views.filter((v) => v.kind !== 'dynamic')) {
    const cells = page(xml, view.id).cells,
      boxes = cells.filter((c) => c.id.includes('--e--')),
      boundary = cells.find((c) => c.id.includes('--b--')),
      inside = children(model, view);
    for (const a of boxes)
      for (const b of boxes) if (a !== b) assert.ok(!overlap(rect(a), rect(b)), `${view.id}: ${a.id} overlaps ${b.id}`);
    if (!boundary) continue;
    for (const box of boxes)
      if (inside.has(box.id)) assert.ok(holds(rect(boundary), rect(box)), `${view.id}: the boundary holds ${box.id}`);
      else assert.ok(!overlap(rect(box), rect(boundary)), `${view.id}: ${box.id} is outside and touches the boundary`);
  }
}
test('a new box takes a free slot away from the kept ones, and a kept boundary grows to enclose its children', () => {
  const first = arranged(draw(SAMPLE)),
    second = draw(GROWN, first),
    model = load(GROWN);
  assertPlaced(model, second);
  for (const id of ['web', 'api', 'db'])
    assert.deepEqual(
      rect(cell(second, 'containers', `containers--e--${id}`)),
      rect(cell(first, 'containers', `containers--e--${id}`)),
      `${id} keeps its place`,
    );
  assert.equal(draw(GROWN, second), second, 'regenerating its own file writes the same bytes');
});
test('a kept boundary that grows by a new rank row never covers a kept outside box', () => {
  const deeper = change(
      SAMPLE,
      'relations:\n',
      '  - id: archive\n    kind: container\n    in: shop\n    name: Archive\nrelations:\n  - db -> archive: copies\n',
    ),
    first = arranged(draw(SAMPLE)),
    second = draw(deeper, first);
  assertPlaced(load(deeper), second);
  for (const id of ['web', 'api', 'db'])
    assert.deepEqual(
      rect(cell(second, 'containers', `containers--e--${id}`)),
      rect(cell(first, 'containers', `containers--e--${id}`)),
      `${id} keeps its place`,
    );
  assert.equal(draw(deeper, second), second, 'regenerating its own file writes the same bytes');
});
test('when every slot would grow the boundary over a kept outside box, a new child takes a free slot of its row', () => {
  const deeper = change(
      SAMPLE,
      'relations:\n',
      '  - id: archive\n    kind: container\n    in: shop\n    name: Archive\nrelations:\n  - db -> archive: copies\n',
    ),
    drawn = draw(SAMPLE),
    psp = cell(drawn, 'containers', 'containers--e--psp').raw,
    first = drawn.replace(psp, () =>
      psp.replace(/<mxGeometry[^>]*\/>/, '<mxGeometry x="700" y="990" width="270" height="140" as="geometry"/>'),
    ),
    second = draw(deeper, first),
    boxes = page(second, 'containers').cells.filter((c) => c.id.includes('--e--'));
  for (const a of boxes)
    for (const b of boxes) if (a !== b) assert.ok(!overlap(rect(a), rect(b)), `${a.id} overlaps ${b.id}`);
  assert.deepEqual(rect(cell(second, 'containers', 'containers--e--psp')), { x: 700, y: 990, w: 270, h: 140 });
  assert.ok(
    holds(
      rect(cell(second, 'containers', 'containers--b--shop')),
      rect(cell(second, 'containers', 'containers--e--archive')),
    ),
    'the boundary holds archive',
  );
});

// The anchors of an edge, as fractions of its source and target: exitX, exitY, entryX, entryY.
const anchorsOf = (c) =>
  ['exitX', 'exitY', 'entryX', 'entryY'].map((k) => new RegExp(`(?:^|;)${k}=([\\d.]+)`).exec(c.style)?.[1]);
const TWINS = [
  'elements:',
  '  - id: s',
  '    kind: system',
  '    name: S',
  '  - id: a',
  '    kind: container',
  '    in: s',
  '    name: A',
  '  - id: b',
  '    kind: container',
  '    in: s',
  '    name: B',
  'relations:',
  '  - a -> b: pays',
  '  - a -> b: issues, cancels',
  '  - b -> a: refunds a paid invoice',
  'views:',
  '  - id: all',
  '    kind: containers',
  '    of: s',
  '',
].join('\n');
test('relations between the same two boxes run on tracks of their own, through distinct anchors', () => {
  const edges = page(draw(TWINS), 'all').cells.filter((c) => c.edge === '1');
  assert.equal(edges.length, 3);
  for (const e of edges) {
    assert.match(e.style, /exitPerimeter=0;/, `${e.id} is anchored at its exit`);
    assert.match(e.style, /entryPerimeter=0;/, `${e.id} is anchored at its entry`);
    assert.ok(
      anchorsOf(e).every((v) => v !== undefined),
      `${e.id} names its four anchors`,
    );
  }
  const ends = edges.map((e) => {
    const [ex, ey, nx, ny] = anchorsOf(e);
    return { [e.source]: `${ex},${ey}`, [e.target]: `${nx},${ny}` };
  });
  for (const box of ['all--e--a', 'all--e--b']) {
    const used = ends.map((e) => e[box]);
    assert.equal(new Set(used).size, used.length, `each edge meets ${box} at its own anchor`);
  }
});

// The segments of a generated edge: from its exit anchor, through its points, to its entry anchor.
function segmentsOf(xml, pageId, e) {
  const box = (id) => rect(cell(xml, pageId, id)),
    [ex, ey, nx, ny] = anchorsOf(e).map(Number),
    s = box(e.source),
    t = box(e.target);
  const bends = [
    ...(/<Array as="points">([\s\S]*?)<\/Array>/.exec(e.inner)?.[1] ?? '').matchAll(/<mxPoint\b([^>]*?)\/?>/g),
  ]
    .map((m) => attrs(m[1]))
    .map((p) => ({ x: Number(p.x ?? 0), y: Number(p.y ?? 0) }));
  const route = [{ x: s.x + ex * s.w, y: s.y + ey * s.h }, ...bends, { x: t.x + nx * t.w, y: t.y + ny * t.h }];
  return route.slice(1).map((q, i) => [route[i], q]);
}
// Whether the segment p-q enters the inside of r (Liang-Barsky clipping on the rectangle shrunk by 1px).
function crosses([p, q], r) {
  let t0 = 0,
    t1 = 1;
  const dx = q.x - p.x,
    dy = q.y - p.y;
  for (const [d, n] of [
    [-dx, p.x - (r.x + 1)],
    [dx, r.x + r.w - 1 - p.x],
    [-dy, p.y - (r.y + 1)],
    [dy, r.y + r.h - 1 - p.y],
  ]) {
    if (d === 0) {
      if (n < 0) return false;
    } else if (d < 0) t0 = Math.max(t0, n / d);
    else t1 = Math.min(t1, n / d);
  }
  return t0 < t1;
}
for (const [name, text] of [
  ['the sample model', SAMPLE],
  ['a wider model with a cycle', WIDE],
  ['twin relations', TWINS],
]) {
  test(`no generated edge crosses a box other than its ends, for ${name}`, () => {
    const model = load(text),
      xml = c4.generate(model, null);
    for (const view of model.views.filter((v) => v.kind !== 'dynamic')) {
      const cells = page(xml, view.id).cells,
        boxes = cells.filter((c) => c.id.includes('--e--'));
      for (const e of cells.filter((c) => c.edge === '1')) {
        assert.ok(
          anchorsOf(e).every((v) => v !== undefined),
          `${e.id} is anchored`,
        );
        for (const seg of segmentsOf(xml, view.id, e))
          for (const b of boxes)
            if (b.id !== e.source && b.id !== e.target)
              assert.ok(!crosses(seg, rect(b)), `${view.id}: ${e.id} crosses ${b.id}`);
      }
    }
  });
}

// Where a label sits: at its relative place x along the route (-1 at the source, 1 at the target), as a box of
// 8 px a character and 18 px a line.
function labelOf(xml, pageId, e) {
  const segs = segmentsOf(xml, pageId, e),
    lengths = segs.map(([p, q]) => Math.abs(q.x - p.x) + Math.abs(q.y - p.y)),
    total = lengths.reduce((m, n) => m + n, 0);
  let left = ((Number(e.geo.x ?? 0) + 1) / 2) * total,
    at = segs[0][0];
  for (const [i, [p, q]] of segs.entries()) {
    if (left <= lengths[i]) {
      const f = lengths[i] ? left / lengths[i] : 0;
      at = { x: p.x + (q.x - p.x) * f, y: p.y + (q.y - p.y) * f };
      break;
    }
    left -= lengths[i];
  }
  const text = e.value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
  const lines = text.split('<br>').map((l) => l.replace(/<[^>]*>/g, ''));
  const w = Math.max(...lines.map((l) => l.length * 8)),
    h = 18 * lines.length;
  return { x: at.x - w / 2, y: at.y - h / 2, w, h };
}
const AROUND = [
  'elements:',
  '  - id: s',
  '    kind: system',
  '    name: S',
  '  - id: app',
  '    kind: container',
  '    in: s',
  '    name: App',
  '  - id: db',
  '    kind: container',
  '    in: s',
  '    name: DB',
  '  - id: pay',
  '    kind: system',
  '    external: true',
  '    name: Pay',
  'relations:',
  '  - app -> db: SQL',
  '  - app -> pay: charges, reverses',
  '  - app -> pay: sends a refund',
  'views:',
  '  - id: all',
  '    kind: containers',
  '    of: s',
  '',
].join('\n');
// Two parties call into two apps; one app calls the other twice, and two stores and a provider: the shape on which two
// relations with different ends once ran on the same line.
const CROSSING = [
  'elements:',
  '  - id: s',
  '    kind: system',
  '    name: S',
  '  - id: one',
  '    kind: person',
  '    name: One',
  '  - id: two',
  '    kind: person',
  '    name: Two',
  '  - id: app',
  '    kind: container',
  '    in: s',
  '    name: App',
  '  - id: pay',
  '    kind: container',
  '    in: s',
  '    name: Pay',
  '  - id: db',
  '    kind: container',
  '    in: s',
  '    name: DB',
  '  - id: pay-db',
  '    kind: container',
  '    in: s',
  '    name: Pay DB',
  '  - id: card',
  '    kind: system',
  '    external: true',
  '    name: Card',
  'relations:',
  '  - one -> pay: pays',
  '  - two -> app: issues',
  '  - two -> pay: refunds',
  '  - app -> db: SQL',
  '  - pay -> app: records payments',
  '  - pay -> pay-db: SQL',
  '  - pay -> card: charges',
  '  - pay -> app: asks the status',
  'views:',
  '  - id: all',
  '    kind: containers',
  '    of: s',
  '',
].join('\n');
// The stretch two segments share on one line, in pixels; 0 when they only cross or touch.
const sharedLength = ([p, q], [u, v]) => {
  if (p.y === q.y && u.y === v.y && p.y === u.y)
    return Math.min(Math.max(p.x, q.x), Math.max(u.x, v.x)) - Math.max(Math.min(p.x, q.x), Math.min(u.x, v.x));
  if (p.x === q.x && u.x === v.x && p.x === u.x)
    return Math.min(Math.max(p.y, q.y), Math.max(u.y, v.y)) - Math.max(Math.min(p.y, q.y), Math.min(u.y, v.y));
  return 0;
};
for (const [name, text] of [
  ['the sample model', SAMPLE],
  ['a wider model with a cycle', WIDE],
  ['twin relations', TWINS],
  ['twins around a box', AROUND],
  ['two apps that call each other twice', CROSSING],
]) {
  test(`no two generated edges share a stretch of line, for ${name}`, () => {
    const model = load(text),
      xml = c4.generate(model, null);
    for (const view of model.views.filter((v) => v.kind !== 'dynamic')) {
      const edges = page(xml, view.id)
        .cells.filter((c) => c.edge === '1')
        .map((e) => ({ id: e.id, segs: segmentsOf(xml, view.id, e) }));
      for (const [i, a] of edges.entries())
        for (const b of edges.slice(i + 1))
          for (const s of a.segs)
            for (const t of b.segs)
              assert.ok(sharedLength(s, t) <= 0, `${view.id}: ${a.id} and ${b.id} share ${sharedLength(s, t)}px`);
    }
  });
}

test('the labels of a page do not overlap, even when twin relations go around a box', () => {
  for (const text of [AROUND, TWINS, SAMPLE]) {
    const model = load(text),
      xml = c4.generate(model, null);
    for (const view of model.views.filter((v) => v.kind !== 'dynamic')) {
      const labels = page(xml, view.id)
        .cells.filter((c) => c.edge === '1' && c.value)
        .map((e) => ({ id: e.id, r: labelOf(xml, view.id, e) }));
      for (const a of labels)
        for (const b of labels) if (a !== b) assert.ok(!overlap(a.r, b.r), `${view.id}: ${a.id} covers ${b.id}`);
    }
  }
});

const LONG = 'reads the invoice through InvoicePayments, then records the payment';
test('the gap between two lifelines holds the widest label of a step between them, never below 432', () => {
  const text = change(SAMPLE, '      - web -> api: POST /orders', `      - web -> api: ${LONG}`),
    xml = draw(text),
    x = (p) => cell(xml, 'checkout', `checkout--l--${p}`).points.sourcePoint.x;
  // 9 px a character at fontSize 17 is a floor: the generator assumes at least that, plus the 31 px badge.
  assert.ok(x('api') - x('web') >= LONG.length * 9 + 31, `the gap ${x('api') - x('web')} holds the label`);
  assert.ok(x('db') - x('api') >= 432, 'a gap with short labels keeps 432');
});

test('regenerating keeps a moved box, a routed edge, a hand-made cell and a hand-made page', () => {
  const first = arranged(draw(SAMPLE)),
    edited = byHand(first),
    second = draw(GROWN, edited);
  checkXml(edited);
  checkXml(second);
  const api = cell(second, 'containers', 'containers--e--api');
  assert.equal(api.inner, MOVED, 'the moved box keeps its position and its size');
  assert.deepEqual(rect(api), { x: 999, y: 777, w: 300, h: 150 });
  assert.ok(api.value.includes('Takes orders &amp;amp; tracks them'), 'the label comes from the model');
  const edge = cell(second, 'containers', 'containers--r--web--psp--1');
  assert.equal(edge.inner, ROUTED, 'the edge keeps its waypoints');
  assert.ok(edge.style.endsWith(`spacing=3;${ANCHORS}partition=hand;`), 'the edge keeps its style');
  assert.equal(edge.source, 'containers--e--web');
  assert.equal(edge.target, 'containers--e--psp');
  assert.match(edge.value, /^sends the buyer to pay/);
  // the model grew: the new container and its relation are placed automatically, the others did not move
  assert.deepEqual(rect(cell(second, 'containers', 'containers--e--cache')).w, 270);
  assert.equal(cell(second, 'containers', 'containers--r--api--cache--1').source, 'containers--e--api');
  for (const id of ['containers--e--web', 'containers--e--db', 'containers--e--buyer', 'containers--r--web--api--1']) {
    assert.equal(cell(second, 'containers', id).inner, cell(first, 'containers', id).inner, `${id} did not move`);
  }
  // the kept boundary grows to hold its children again, the moved one and the new one included
  const shop = rect(cell(second, 'containers', 'containers--b--shop'));
  for (const id of ['web', 'api', 'db', 'cache'])
    assert.ok(holds(shop, rect(cell(second, 'containers', `containers--e--${id}`))), `the boundary holds ${id}`);
  // what a person added is kept as it is, after what is generated
  const containers = page(second, 'containers');
  assert.ok(containers.raw.includes(NOTE), 'note-1 is kept verbatim');
  assert.equal(containers.cells.at(-1).id, 'note-1');
  assert.equal(containers.cells.filter((c) => c.id === 'note-1').length, 1);
  assert.ok(second.includes(SKETCH), 'the page that is not a view is kept verbatim');
  assert.deepEqual(
    pagesOf(second).map((p) => p.id),
    ['context', 'containers', 'api-components', 'checkout', 'save-order', 'sketch'],
  );
  assert.equal(draw(GROWN, second), second, 'and a further run changes nothing');
});
test('of two kept boxes that overlap, the later in the model is placed again and its relations routed again', () => {
  const first = arranged(draw(SAMPLE)),
    web = cell(first, 'containers', 'containers--e--web'),
    api = cell(first, 'containers', 'containers--e--api');
  // a person leaves api on top of web: web is declared first, so web stays and api moves
  // and routes web -> api by hand: a route drawn against the hidden box is drawn again
  const link = cell(first, 'containers', 'containers--r--web--api--1');
  const stacked = first
    .replace(api.raw, () => api.raw.replace(/<mxGeometry[^>]*\/>/, () => web.raw.match(/<mxGeometry[^>]*\/>/)[0]))
    .replace(link.raw, () => link.raw.replace(/<mxGeometry[^>]*(?:\/>|>[\s\S]*?<\/mxGeometry>)/, () => ROUTED));
  assert.deepEqual(rect(cell(stacked, 'containers', 'containers--e--api')), rect(web));
  const second = draw(SAMPLE, stacked);
  checkXml(second);
  assert.equal(cell(second, 'containers', 'containers--e--web').inner, web.inner, 'the first box does not move');
  const boxes = page(second, 'containers').cells.filter((c) => c.vertex === '1' && c.id.includes('--e--'));
  for (const a of boxes)
    for (const b of boxes) if (a !== b) assert.ok(!overlap(rect(a), rect(b)), `${a.id} overlaps ${b.id}`);
  for (const id of ['containers--e--db', 'containers--e--buyer'])
    assert.equal(cell(second, 'containers', id).inner, cell(first, 'containers', id).inner, `${id} did not move`);
  assert.equal(cell(stacked, 'containers', 'containers--r--web--api--1').inner, ROUTED);
  assert.notEqual(
    cell(second, 'containers', 'containers--r--web--api--1').inner,
    ROUTED,
    'its relation is routed again',
  );
  assert.equal(cell(second, 'containers', 'containers--e--api').inner, api.inner, 'it takes the free slot it had');
  assert.equal(draw(SAMPLE, second), second, 'once apart, a further run changes nothing');
  const dir = tmp({ 'docs/architecture/model.yml': SAMPLE, 'docs/architecture/c4.drawio': stacked }),
    r = run(dir);
  assert.equal(r.status, 0, r.stderr);
  assert.match(
    r.stdout,
    /page "C4 2 - Containers" \(containers\): 5 elements kept their hand-set position, 1 placed automatically, 1 moved off a kept box they overlapped \(api\)/,
  );
});
test('an element that leaves the model takes its cells away, and nothing else', () => {
  const gone = SAMPLE.replace(/ {2}- id: psp\n( {4}.*\n)+/, '').replace(/ {2}- .*\bpsp\b.*\n/g, '');
  assert.ok(!gone.includes('psp'));
  const first = draw(SAMPLE),
    second = draw(gone, byHand(first));
  checkXml(second);
  assert.ok(first.includes('context--e--psp') && first.includes('containers--r--web--psp--1'));
  assert.ok(!/id="[^"]*--psp/.test(second), 'no box and no relation of psp is left');
  assert.equal(cell(second, 'containers', 'containers--e--api').inner, MOVED);
  assert.ok(second.includes(NOTE) && second.includes(SKETCH));
});
test('what the generator placed and no person changed is placed again: a smaller model draws as from scratch', () => {
  const big = draw(GROWN);
  assert.ok(big.includes('containers--e--cache'));
  assert.equal(draw(SAMPLE, big), draw(SAMPLE), 'no hole, no grown boundary, no old route is left');
  // a file written before the mark, never saved by draw.io, is the generator's too
  const unmarked = big.replace(/partition=[^;"]*;/g, '');
  assert.ok(unmarked.startsWith('<mxfile host="partition"'));
  assert.equal(draw(SAMPLE, unmarked), draw(SAMPLE));
});
test('a box a person moved stays a person’s through every later run, marked as such', () => {
  const first = draw(SAMPLE),
    api = cell(first, 'containers', 'containers--e--api').raw,
    edited = first.replace(api, () => api.replace(/<mxGeometry[^>]*\/>/, () => MOVED)),
    second = draw(GROWN, edited),
    third = draw(SAMPLE, second);
  for (const xml of [second, third]) {
    const box = cell(xml, 'containers', 'containers--e--api');
    assert.equal(box.inner, MOVED);
    assert.match(box.style, /(^|;)partition=hand;/);
  }
  assert.match(cell(third, 'containers', 'containers--e--web').style, /(^|;)partition=(?!hand)[^;]+;/);
});
test('a relation a person restyled without moving it keeps its style, on a static page and on a sequence page', () => {
  const first = draw(SAMPLE),
    edge = cell(first, 'containers', 'containers--r--web--api--1').raw,
    step = cell(first, 'checkout', 'checkout--s--1').raw,
    edited = first
      .replace(edge, () => edge.replace('strokeColor=#333333;', 'strokeColor=#FF0000;'))
      .replace(step, () => step.replace('strokeWidth=2;', 'strokeWidth=4;'));
  for (const xml of [draw(SAMPLE, edited), draw(GROWN, draw(SAMPLE, edited))]) {
    const e = cell(xml, 'containers', 'containers--r--web--api--1'),
      s = cell(xml, 'checkout', 'checkout--s--1');
    assert.match(e.style, /strokeColor=#FF0000;/);
    assert.match(e.style, /(^|;)partition=hand;/);
    assert.match(s.style, /strokeWidth=4;/);
  }
});
test('a boundary a person placed stays theirs after it grew to hold a new child', () => {
  const first = arranged(draw(SAMPLE)),
    grown = draw(GROWN, first),
    shop = cell(grown, 'containers', 'containers--b--shop');
  assert.notEqual(shop.inner, cell(first, 'containers', 'containers--b--shop').inner, 'it grew');
  assert.match(shop.style, /(^|;)partition=hand;/);
  assert.equal(cell(draw(SAMPLE, grown), 'containers', 'containers--b--shop').inner, shop.inner, 'and does not shrink');
});
test('a file draw.io saved before the mark is all a person’s: every cell keeps its place', () => {
  const first = arranged(draw(SAMPLE)),
    second = draw(GROWN, first);
  for (const id of ['web', 'api', 'db', 'buyer', 'psp'])
    assert.equal(
      cell(second, 'containers', `containers--e--${id}`).inner,
      cell(first, 'containers', `containers--e--${id}`).inner,
      `${id} keeps its place`,
    );
});
test('a file drawn by hand is not merged into the views; its pages are kept after them', () => {
  const drawn =
    `<mxfile host="Electron" pages="1">\n  <diagram id="e088f78f3b8a" name="C4 1 - Context">\n    <mxGraphModel dx="1" dy="2"><root><mxCell id="0" /><mxCell id="1" parent="0" />` +
    `<mxCell id="abc-1" value="Shop" style="rounded=1;" parent="1" vertex="1"><mxGeometry x="5" y="6" width="70" height="80" as="geometry" /></mxCell></root></mxGraphModel>\n  </diagram>\n</mxfile>\n`;
  const xml = draw(SAMPLE, drawn);
  checkXml(xml);
  assert.deepEqual(
    pagesOf(xml).map((p) => p.id),
    ['context', 'containers', 'api-components', 'checkout', 'save-order', 'e088f78f3b8a'],
  );
  assert.equal(
    xml.replace(pagesOf(xml).at(-1).raw, ''),
    draw(SAMPLE).replace('</mxfile>', '  \n</mxfile>'),
    'the views are the ones of a first run',
  );
  assert.ok(xml.includes(pagesOf(drawn)[0].raw), 'the hand-drawn page is there verbatim');
});

// What draw.io writes when it saves the file again: other attribute order, " />", an open and a closed mxGeometry.
const reversed = (list) =>
  [...list.matchAll(/[\w:.-]+="[^"]*"/g)]
    .map((m) => m[0])
    .reverse()
    .join(' ');
const resaved = (xml) =>
  xml
    .replace(/<mxCell\b([^>]*?)(\/?)>/g, (m, list, empty) => `<mxCell ${reversed(list)}${empty ? ' /' : ''}>`)
    .replace(/<mxGeometry\b([^>]*?)\/>/g, (m, list) => `<mxGeometry ${reversed(list)}></mxGeometry>`)
    .replace(/<mxPoint\b([^>]*?)\/>/g, (m, list) => `<mxPoint ${reversed(list)} />`)
    .replace('<mxfile host="partition"', '<mxfile host="Electron" modified="2026-01-01T00:00:00.000Z"')
    .replace(/dx="1434"/g, 'dx="2210"')
    .replace(/\n {8}/g, '\n\t\t');
test('the merge reads a file that draw.io saved again: attributes in another order, mxGeometry not self-closing', () => {
  const first = draw(SAMPLE),
    saved = resaved(first).replace('y="290" x="720"></mxGeometry>', 'y="777" x="999"></mxGeometry>');
  assert.ok(
    saved.includes('<mxCell vertex="1" parent="1" style="rounded=1;') && saved.includes('y="777" x="999"'),
    'the fixture looks like a file of draw.io',
  );
  checkXml(saved);
  assert.equal(draw(SAMPLE, resaved(first)), first, 'the marks are read through draw.io’s way of writing');
  const again = draw(SAMPLE, saved);
  checkXml(again);
  assert.deepEqual(
    { x: rect(cell(again, 'context', 'context--e--shop')).x, y: rect(cell(again, 'context', 'context--e--shop')).y },
    { x: 999, y: 777 },
  );
  for (const before of pagesOf(first))
    assert.deepEqual(
      page(again, before.id).cells.map((c) => c.id),
      before.cells.map((c) => c.id),
      `page ${before.id}: every cell is recognised, none is doubled`,
    );
  assert.equal(draw(SAMPLE, again), again);
});
test('the merge reads a page that draw.io compressed and a cell that draw.io wrapped in an object', () => {
  const edited = byHand(draw(SAMPLE)),
    body = /<diagram id="containers"[^>]*>([\s\S]*?)<\/diagram>/.exec(edited)[1];
  const packed = edited.replace(body, () => zlib.deflateRawSync(encodeURIComponent(body)).toString('base64'));
  assert.ok(!page(packed, 'containers').raw.includes('<mxCell'));
  const fromPacked = draw(SAMPLE, packed);
  checkXml(fromPacked);
  assert.equal(cell(fromPacked, 'containers', 'containers--e--api').inner, MOVED);
  assert.ok(fromPacked.includes(NOTE));
  assert.throws(
    () =>
      draw(
        SAMPLE,
        edited.replace(body, () => 'not a diagram'),
      ),
    /page "containers" of the existing file cannot be read/,
  );

  const wrapped =
    '<UserObject label="API" link="https://example.org" id="containers--e--api"><mxCell style="rounded=1;" vertex="1" parent="1"><mxGeometry x="999" y="777" width="300" height="150" as="geometry" /></mxCell></UserObject>';
  const legend =
    '<object label="Legend" owner="me" id="legend-1"><mxCell style="text;html=1;" vertex="1" parent="1"><mxGeometry x="1" y="2" width="30" height="40" as="geometry" /></mxCell></object>';
  const first = arranged(draw(SAMPLE)),
    fromWrapped = draw(
      SAMPLE,
      first.replace(cell(first, 'containers', 'containers--e--api').raw, () => `${wrapped}\n        ${legend}`),
    );
  checkXml(fromWrapped);
  assert.deepEqual(rect(cell(fromWrapped, 'containers', 'containers--e--api')), { x: 999, y: 777, w: 300, h: 150 });
  assert.equal(fromWrapped.split('id="containers--e--api"').length - 1, 1, 'the box is there once');
  assert.ok(fromWrapped.includes(legend), 'a hand-made object is kept verbatim');
});

// ------------------------------------------------------------------ dynamic views
test('a dynamic page has its participants in the declared order, numbered steps and dashed returns', () => {
  const xml = draw(SAMPLE),
    at = (id) => cell(xml, 'checkout', id);
  assert.deepEqual(ids(xml, 'checkout'), [
    '0',
    '1',
    'checkout--p--web',
    'checkout--p--api',
    'checkout--p--db',
    'checkout--l--web',
    'checkout--l--api',
    'checkout--l--db',
    'checkout--s--1',
    'checkout--s--2',
    'checkout--s--3',
    'checkout--s--4',
  ]);
  ['web', 'api', 'db'].forEach((p, i) => {
    assert.deepEqual(rect(at(`checkout--p--${p}`)), { x: 129 + 432 * i, y: 0, w: 260, h: 42 });
    const line = at(`checkout--l--${p}`);
    assert.deepEqual(
      line.points.sourcePoint,
      { x: 129 + 432 * i + 130, y: 42 },
      'a lifeline leaves the bottom centre of its box',
    );
    assert.equal(line.points.targetPoint.x, line.points.sourcePoint.x);
    assert.ok(line.points.targetPoint.y > 100 + 70 * 3, 'and runs past the last step');
    assert.equal(plain(line.style), 'endArrow=none;strokeColor=#999999;strokeWidth=1;html=1;dashed=1;dashPattern=4 4;');
    assert.ok(line.source === undefined && line.target === undefined && line.edge === '1');
  });
  assert.equal(at('checkout--p--api').value, '&lt;b&gt;API&lt;/b&gt;');
  assert.match(
    plain(at('checkout--p--db').style),
    /arcSize=10;.*fillColor=#dae8fc;strokeColor=#6c8ebf;.*fontSize=19;$/,
  );
  const x = { web: 259, api: 691, db: 1123 };
  [
    ['web', 'api', 'POST /orders'],
    ['api', 'db', 'insert order'],
    ['db', 'api', 'order id'],
    ['api', 'web', '201 Created'],
  ].forEach(([from, to, label], i) => {
    const step = at(`checkout--s--${i + 1}`);
    assert.deepEqual(step.points, {
      sourcePoint: { x: x[from], y: 100 + 70 * i },
      targetPoint: { x: x[to], y: 100 + 70 * i },
    });
    assert.ok(
      step.value.startsWith('&lt;span style=&quot;display:inline-block;width:24px;height:24px;') &&
        step.value.endsWith(`vertical-align:middle&quot;&gt;${i + 1}&lt;/span&gt;${label}`),
    );
    assert.ok(step.source === undefined && step.target === undefined);
  });
  assert.equal(
    plain(at('checkout--s--1').style),
    'endArrow=block;endFill=1;endSize=9;strokeColor=#333333;strokeWidth=2;dashed=0;html=1;fontFamily=IBM Plex Sans;fontSize=17;fontColor=#000000;verticalAlign=bottom;align=center;labelBackgroundColor=none;spacingBottom=4;',
  );
  assert.equal(
    plain(at('checkout--s--3').style),
    'endArrow=open;endFill=1;endSize=9;strokeColor=#666666;strokeWidth=2;dashed=1;html=1;fontFamily=IBM Plex Sans;fontSize=17;fontColor=#000000;verticalAlign=bottom;align=center;labelBackgroundColor=none;spacingBottom=4;',
  );
  assert.match(at('checkout--s--2').style, /dashed=0;/);
  assert.match(at('checkout--s--4').style, /dashed=1;/);
});
test('without "participants" they come in the order of the steps, and a step to oneself is a short edge to the right', () => {
  const xml = draw(SAMPLE);
  assert.deepEqual(
    ids(xml, 'save-order').filter((id) => id.includes('--p--')),
    ['save-order--p--orders-endpoint', 'save-order--p--order-service', 'save-order--p--order-store'],
  );
  assert.deepEqual(cell(xml, 'save-order', 'save-order--s--2').points, {
    sourcePoint: { x: 691, y: 170 },
    targetPoint: { x: 811, y: 170 },
  });
});
test('on a dynamic page an arrow keeps its hand-set place only while it still joins the lifelines the model names', () => {
  const first = arranged(draw(SAMPLE)),
    one = cell(first, 'checkout', 'checkout--s--1').raw,
    web = cell(first, 'checkout', 'checkout--p--web').raw;
  const edited = first
    .replace(one, () => one.replace(/y="100"/g, 'y="88"').replace('strokeWidth=2;', 'strokeWidth=3;'))
    .replace(web, () => web.replace('y="0"', 'y="-20"'));
  // the label of step 1 changes, step 2 leaves from another lifeline, a fifth step and a participant arrive
  const text = change(
    change(
      change(
        change(SAMPLE, 'web -> api: POST /orders', 'web -> api: POST /v2/orders'),
        'api -> db: insert order',
        'web -> db: insert order',
      ),
      '      - api --> web: 201 Created\n',
      '      - api --> web: 201 Created\n      - web -> psp: pay\n',
    ),
    'participants: [web, api, db]',
    'participants: [web, psp, api, db]',
  );
  const xml = draw(text, edited),
    at = (id) => cell(xml, 'checkout', id);
  checkXml(xml);
  assert.deepEqual(
    at('checkout--s--1').points,
    { sourcePoint: { x: 259, y: 88 }, targetPoint: { x: 691, y: 88 } },
    'step 1 stays where the person put it',
  );
  assert.match(at('checkout--s--1').style, /strokeWidth=3;/);
  assert.ok(at('checkout--s--1').value.endsWith('POST /v2/orders'));
  assert.deepEqual(
    at('checkout--s--2').points,
    { sourcePoint: { x: 259, y: 150 }, targetPoint: { x: 1123, y: 150 } },
    'step 2 is drawn again, from web',
  );
  assert.deepEqual(rect(at('checkout--p--web')), { x: 129, y: -20, w: 260, h: 42 }, 'a moved participant stays');
  assert.deepEqual(
    ['web', 'psp', 'api', 'db'].map((p) => rect(at(`checkout--p--${p}`)).x),
    [129, 1425, 561, 993],
    'a new participant takes a free slot',
  );
  assert.deepEqual(at('checkout--s--5').points, { sourcePoint: { x: 259, y: 360 }, targetPoint: { x: 1555, y: 360 } });
  for (const p of ['web', 'psp', 'api', 'db'])
    assert.equal(
      at(`checkout--l--${p}`).points.targetPoint.y,
      400,
      `the lifeline of ${p} reaches past the new last step`,
    );
  assert.equal(draw(text, xml), xml);
});

// ------------------------------------------------------------------ Mermaid
test('a dynamic view becomes a Mermaid sequence diagram, with _ for - in the ids', () => {
  const m = load(SAMPLE);
  assert.equal(
    c4.mermaid(m, 'checkout'),
    [
      'sequenceDiagram',
      '    autonumber',
      '    participant web as Web app',
      '    participant api as API',
      '    participant db as Database',
      '    web->>api: POST /orders',
      '    api->>db: insert order',
      '    db-->>api: order id',
      '    api-->>web: 201 Created',
    ].join('\n'),
  );
  assert.equal(
    c4.mermaid(m, 'save-order'),
    [
      'sequenceDiagram',
      '    autonumber',
      '    participant orders_endpoint as Orders endpoint',
      '    participant order_service as Order service',
      '    participant order_store as Order store',
      '    orders_endpoint->>order_service: place(order)',
      '    order_service->>order_service: check the rules',
      '    order_service->>order_store: save(order)',
      '    order_store-->>order_service: order id',
    ].join('\n'),
  );
  const escaped = load(
    change(change(SAMPLE, 'name: API\n', 'name: API (C#; v2)\n'), 'insert order\n', 'insert order; commit\n'),
  );
  const lines = c4.mermaid(escaped, 'checkout').split('\n');
  assert.ok(lines.includes('    participant api as API (C#35;#59; v2)'), lines.join('\n'));
  assert.ok(lines.includes('    api->>db: insert order#59; commit'), lines.join('\n'));
  assert.throws(
    () => c4.mermaid(m, 'containers'),
    /view "containers" is a containers view; only a dynamic view becomes a sequence diagram/,
  );
  assert.throws(
    () => c4.mermaid(m, 'nope'),
    /view "nope" does not exist; the views are context, containers, api-components, checkout, save-order/,
  );
});

// ------------------------------------------------------------------ command line and package
const run = (cwd, ...args) => spawnSync(process.execPath, [fileURLToPath(c4Path), ...args], { cwd, encoding: 'utf8' });
test('--check exits 0 on a valid model, 1 with every message on an invalid one, and writes nothing', () => {
  const good = tmp({ 'docs/architecture/model.yml': SAMPLE }),
    ok = run(good, '--check');
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /10 elements, 10 relations, 5 views, no error/);
  assert.ok(!fs.existsSync(path.join(good, 'docs/architecture/c4.drawio')));
  const bad = tmp({
    'm.yml': change(
      change(SAMPLE, 'api -> db: insert order', 'api -> dbx: insert order'),
      'web -> api: calls',
      'web -> apix: calls',
    ),
  });
  for (const args of [
    ['--check', '--model', 'm.yml'],
    ['--model', 'm.yml', '--out', 'out.drawio'],
  ]) {
    const r = run(bad, ...args);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /view "checkout": step 2 uses "dbx", which is not an element of the model/);
    assert.match(r.stderr, /relation 2 \(web -> apix\) uses "apix", which is not an element of the model/);
    assert.ok(!fs.existsSync(path.join(bad, 'out.drawio')), 'nothing is written');
  }
  assert.equal(
    run(tmp({ 'm.yml': 'elements:\n\t- id: a\n' }), '--check', '--model', 'm.yml').status,
    1,
    'YAML that cannot be read is an invalid model',
  );
});
test('a run writes the file, says what it kept and placed, and a second run writes the same bytes', () => {
  const dir = tmp({ 'docs/architecture/model.yml': SAMPLE }),
    out = path.join(dir, 'docs/architecture/c4.drawio');
  const first = run(dir);
  assert.equal(first.status, 0, first.stderr);
  assert.equal(first.stdout.trim().split('\n').length, 5, 'one line per page');
  assert.match(
    first.stdout,
    /page "C4 2 - Containers" \(containers\): 0 elements kept their hand-set position, 6 placed automatically/,
  );
  const bytes = fs.readFileSync(out, 'utf8');
  assert.equal(bytes, draw(SAMPLE));
  checkXml(bytes);
  const second = run(dir);
  assert.equal(second.status, 0, second.stderr);
  assert.match(second.stdout, /\(containers\): 0 elements kept their hand-set position, 6 placed automatically/);
  assert.equal(fs.readFileSync(out, 'utf8'), bytes, 'idempotent');
  fs.writeFileSync(out, byHand(bytes));
  const third = run(dir, '--model', 'docs/architecture/model.yml', '--out', 'docs/architecture/c4.drawio');
  assert.match(
    third.stdout,
    // the moved box is the person's; the boundary and the other boxes are the generator's
    /\(containers\): 1 elements kept their hand-set position, 5 placed automatically, 1 hand-made cells kept/,
  );
  assert.match(third.stdout, /page "sketch": not a view of the model, kept as it was/);
  assert.equal(cell(fs.readFileSync(out, 'utf8'), 'containers', 'containers--e--api').inner, MOVED);
});
test('--mermaid prints the sequence diagram; a wrong view, option or file exits 2', () => {
  const dir = tmp({ 'docs/architecture/model.yml': SAMPLE }),
    ok = run(dir, '--mermaid', 'checkout');
  assert.equal(ok.status, 0, ok.stderr);
  assert.equal(ok.stdout, `${c4.mermaid(load(SAMPLE), 'checkout')}\n`);
  const wrong = run(dir, '--mermaid', 'context');
  assert.equal(wrong.status, 2);
  assert.match(wrong.stderr, /only a dynamic view becomes a sequence diagram/);
  assert.equal(run(dir, '--nope').status, 2);
  assert.equal(run(dir, '--model').status, 2);
  const missing = run(dir, '--model', 'nowhere.yml');
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /cannot read nowhere\.yml/);
});
test('the script exports its functions and holds the same YAML subset as budget.mjs', () => {
  assert.deepEqual(Object.keys(c4).sort(), ['generate', 'loadModel', 'mermaid', 'parseYaml', 'validate']);
  const block = (url) =>
    /\/\/ <yaml-subset>[\s\S]*\/\/ <\/yaml-subset>/.exec(fs.readFileSync(fileURLToPath(url), 'utf8'))[0];
  assert.equal(block(c4Path), block(budgetPath));
  assert.deepEqual(c4.parseYaml('a:\n  - b -> c: d [e]\n  - f --> g\n'), { a: [{ 'b -> c': 'd [e]' }, 'f --> g'] });
});
