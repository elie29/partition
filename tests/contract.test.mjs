// Tests of contract.mjs: scope, inventory, coupling, orphans, semantic diff, and the CLI in a throwaway git repository.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';
import { contractPath, copyOf, spawnAsync, tmp } from './helpers.mjs';

// ------------------------------------------------------------------ a fictional shop
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema) => ({ 'application/json': { schema } });
const text = () => ({ type: 'string' });
const amount = () => ({ type: 'object', properties: { amount: { type: 'number' }, currency: text() } });
const failure = (code) => ({ type: 'object', properties: { code, message: text() } });
const error = (description, code) => ({ description, content: json(failure({ type: 'string', example: code })) });
const longText = `Lists what a country sells. ${'Stock is read from the warehouse system. '.repeat(11)}`.trim();

const shop = () => ({
  openapi: '3.0.3',
  info: { title: 'Shop API', version: '1.4.0' },
  tags: [{ name: 'Orders' }, { name: 'Catalogue' }, { name: 'Billing' }, { name: 'Returns' }],
  paths: {
    '/orders': {
      get: {
        operationId: 'listOrders',
        tags: ['Orders'],
        summary: 'List the orders of the buyer\nsecond line, never printed',
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['OPEN', 'SHIPPED', 'CANCELLED'] } },
        ],
        responses: {
          200: { description: 'The orders', content: json({ type: 'array', items: ref('Order') }) },
          400: error('Invalid filter', 'BAD001'),
        },
      },
      post: {
        operationId: 'createOrder',
        tags: ['Orders'],
        summary: 'Place an order',
        description: 'Places an order and reserves the stock.',
        requestBody: {
          required: true,
          content: json({
            type: 'object',
            required: ['lines'],
            properties: {
              lines: { type: 'array', items: ref('OrderLine') },
              discount: amount(),
              note: text(),
              customer: { type: 'object', properties: { id: text() } },
            },
          }),
        },
        responses: {
          201: { description: 'Order placed', content: json(ref('Order')) },
          400: error('Invalid order', 'BAD001'),
          409: {
            description: 'Duplicate order',
            content: json(failure({ type: 'string', enum: ['DUP002', 'DUP001'] })),
          },
        },
      },
    },
    '/orders/{orderId}': {
      parameters: [
        { name: 'orderId', in: 'path', required: true, schema: text() },
        { name: 'verbose', in: 'query', schema: { type: 'boolean' } },
      ],
      get: {
        operationId: 'getOrder',
        tags: ['Orders'],
        summary: 'Read one order',
        parameters: [{ name: 'verbose', in: 'query', schema: { type: 'integer' } }],
        responses: {
          200: { description: 'The order', content: json(ref('Order')) },
          404: error('Unknown order', 'NF001'),
        },
      },
    },
    '/orders/{orderId}/status-history': {
      parameters: [{ $ref: '#/components/parameters/OrderId' }],
      get: {
        operationId: 'getStatusHistory',
        tags: ['Orders'],
        summary: 'Read the statuses of one order',
        responses: {
          200: {
            description: 'The statuses, oldest first',
            content: json({ type: 'array', items: { type: 'object', properties: { status: text(), at: text() } } }),
          },
          404: error('Unknown order', 'NF001'),
        },
      },
    },
    '/countries/{countryCode}/products': {
      get: {
        operationId: 'listProducts',
        tags: ['Catalogue'],
        summary: 'List the products sold in a country',
        description: longText,
        parameters: [{ name: 'countryCode', in: 'path', required: true, schema: text() }],
        responses: { 200: { description: 'The products', content: json({ type: 'array', items: ref('Product') }) } },
      },
    },
    '/invoices': {
      post: {
        operationId: 'createInvoice',
        tags: ['Billing'],
        summary: 'Invoice an order',
        requestBody: {
          content: json({
            type: 'object',
            required: ['orderId', 'revenue'],
            properties: { orderId: text(), revenue: amount(), vat: ref('Money') },
          }),
        },
        responses: {
          201: { description: 'Invoice issued', content: json({ type: 'object', properties: { id: text() } }) },
          422: {
            description: 'The order cannot be invoiced',
            content: {
              'application/json': {
                schema: failure(text()),
                example: { code: 'INV001', message: 'not shipped' },
                examples: { paid: { value: { errorCode: 'INV002' } } },
              },
            },
          },
        },
      },
    },
  },
  components: {
    parameters: { OrderId: { name: 'orderId', in: 'path', required: true, schema: text() } },
    schemas: {
      Order: {
        type: 'object',
        required: ['id', 'total'],
        properties: {
          id: text(),
          status: { type: 'string', enum: ['OPEN', 'SHIPPED', 'CANCELLED'] },
          total: ref('Money'),
          lines: { type: 'array', items: ref('OrderLine') },
        },
      },
      OrderLine: {
        type: 'object',
        properties: { sku: text(), quantity: { type: 'integer' }, bundle: { type: 'array', items: ref('OrderLine') } },
      },
      Product: { type: 'object', properties: { sku: text(), name: text() } },
      Money: { type: 'object', properties: { amount: { type: 'number' }, currency: text() } },
      Unused: { type: 'object', properties: { detail: ref('OnlyUsedByUnused') } },
      OnlyUsedByUnused: { type: 'object', properties: { text: text() } },
    },
  },
});
const body = (doc, route, method = 'post') => doc.paths[route][method].requestBody.content['application/json'].schema;
const reversed = (v) =>
  Array.isArray(v)
    ? v.map(reversed)
    : v && typeof v === 'object'
      ? Object.fromEntries(
          Object.entries(v)
            .reverse()
            .map(([k, x]) => [k, reversed(x)]),
        )
      : v;

const c = await import(contractPath);
const ids = (ops) => ops.map((o) => o.operationId);
const blocked = (fn, ...patterns) =>
  assert.throws(fn, (e) => {
    assert.equal(e.exitCode, 1, e.message);
    for (const p of patterns) assert.match(e.message, p);
    return true;
  });
const changed = (fn) => {
  const next = shop();
  fn(next);
  return next;
};
const diff = (fn, scope) => c.diffContracts(shop(), changed(fn), scope);
const modified = (r, id) => r.operations.modified.find((o) => o.operationId === id);
const facts = (r, id) => modified(r, id).facts.map((f) => f.fact);

// ------------------------------------------------------------------ scope
test('a scope is the union of its entries, trimmed around each entry and each value', () => {
  assert.deepEqual(c.parseScope('  tag: Orders ;operationId:  createInvoice ; '), [
    { kind: 'tag', value: 'Orders' },
    { kind: 'operationId', value: 'createInvoice' },
  ]);
  assert.deepEqual(ids(c.selectOperations(shop(), 'tag:Orders; operationId:createInvoice')), [
    'createInvoice',
    'listOrders',
    'createOrder',
    'getOrder',
    'getStatusHistory',
  ]);
  assert.deepEqual(
    ids(c.selectOperations(shop(), 'tag:Orders;operationId:getOrder')),
    ['listOrders', 'createOrder', 'getOrder', 'getStatusHistory'],
    'no operation twice',
  );
});
test('a scope entry without one of the two prefixes is refused and the syntax is recalled', () => {
  blocked(
    () => c.parseScope('tag:Orders;Billing'),
    /invalid scope entry "Billing"/,
    /tag:<tag name>;operationId:<operationId>/,
  );
  blocked(() => c.parseScope('tags:Orders'), /"tags:Orders"/);
  blocked(() => c.parseScope('tag:'), /invalid scope entry "tag:"/);
});
test('a tag matches exactly, never by proximity; the error lists every tag and operationId', () => {
  blocked(
    () => c.selectOperations(shop(), 'tag:orders'),
    /unknown tag "orders"/,
    /Tags of the contract: Billing, Catalogue, Orders, Returns\./,
    /operationIds of the contract: createInvoice, createOrder, getOrder, getStatusHistory, listOrders, listProducts\./,
  );
  blocked(() => c.selectOperations(shop(), 'tag:Order'), /unknown tag "Order"/);
});
test('an unknown operationId is named, even beside a valid entry', () => {
  blocked(
    () => c.selectOperations(shop(), 'tag:Orders;operationId:getorder'),
    /unknown operationId "getorder"/,
    /Tags of the contract/,
  );
});
test('a scope that selects no operation is refused instead of falling back to the whole contract', () => {
  blocked(() => c.selectOperations(shop(), 'tag:Returns'), /"tag:Returns" selects no operation/);
  blocked(() => c.inventory(shop(), 'tag:Returns'), /selects no operation/);
});
test('an empty or absent scope is the whole contract', () => {
  for (const scope of [undefined, null, '', '  ', ' ; ']) assert.equal(c.selectOperations(shop(), scope).length, 6);
  assert.deepEqual(c.parseScope(undefined), []);
});

// ------------------------------------------------------------------ inventory
test('operations are listed by path then method, with the operationId or its absence', () => {
  const doc = changed((d) => {
    delete d.paths['/invoices'].post.operationId;
  });
  assert.deepEqual(
    c.listOperations(doc).map((o) => `${o.key} ${o.operationId}`),
    [
      'GET /countries/{countryCode}/products listProducts',
      'POST /invoices null',
      'GET /orders listOrders',
      'POST /orders createOrder',
      'GET /orders/{orderId} getOrder',
      'GET /orders/{orderId}/status-history getStatusHistory',
    ],
  );
  assert.equal(c.inventory(doc, '').operations[1].operationId, null);
});

test('a TRACE operation is listed like the other methods, after them on its path', () => {
  const doc = changed((d) => {
    d.paths['/orders'].trace = { operationId: 'traceOrders', responses: { 200: { description: 'ok' } } };
  });
  assert.deepEqual(
    c
      .listOperations(doc)
      .filter((o) => o.path === '/orders')
      .map((o) => o.key),
    ['GET /orders', 'POST /orders', 'TRACE /orders'],
  );
});
test('the inventory counts the operations in scope and all the tags', () => {
  const r = c.inventory(shop(), 'tag:Orders');
  assert.deepEqual([r.title, r.version, r.inScope, r.total, r.scope], ['Shop API', '1.4.0', 4, 6, 'tag:Orders']);
  assert.deepEqual(r.tags, [
    { tag: 'Billing', operations: 1 },
    { tag: 'Catalogue', operations: 1 },
    { tag: 'Orders', operations: 4 },
    { tag: 'Returns', operations: 0 },
  ]);
  assert.deepEqual(ids(r.operations), ['listOrders', 'createOrder', 'getOrder', 'getStatusHistory']);
  assert.equal(c.inventory(shop()).inScope, 6);
});
test('operations out of scope are listed without detail', () => {
  assert.deepEqual(c.inventory(shop(), 'tag:Orders').outOfScope, [
    { method: 'GET', path: '/countries/{countryCode}/products', operationId: 'listProducts', tags: ['Catalogue'] },
    { method: 'POST', path: '/invoices', operationId: 'createInvoice', tags: ['Billing'] },
  ]);
});
test('the terminal resource is the last segment that is not a parameter', () => {
  const r = c.inventory(shop());
  const resource = (id) => {
    const o = r.operations.find((x) => x.operationId === id);
    return [o.terminalResource, o.subResourceOf];
  };
  assert.deepEqual(resource('getOrder'), ['orders', null]);
  assert.deepEqual(resource('getStatusHistory'), ['status-history', 'orders']);
  assert.deepEqual(resource('listProducts'), ['products', null], 'countries is the terminal resource of no operation');
});
test('a sub-resource needs its parent among the operations of the scope', () => {
  assert.equal(c.inventory(shop(), 'operationId:getStatusHistory').operations[0].subResourceOf, null);
  assert.equal(
    c.inventory(shop(), 'operationId:getStatusHistory;operationId:listOrders').operations[1].subResourceOf,
    'orders',
  );
});
test('path-level parameters apply to each operation and the operation overrides them by name and place', () => {
  const r = c.inventory(shop(), 'tag:Orders');
  assert.deepEqual(r.operations[2].parameters, [
    { name: 'orderId', in: 'path', type: 'string', required: true },
    { name: 'verbose', in: 'query', type: 'integer', required: false },
  ]);
  assert.deepEqual(
    r.operations[3].parameters,
    [{ name: 'orderId', in: 'path', type: 'string', required: true }],
    'a component parameter is resolved',
  );
});
test('bodies and responses name their component schema or the top-level properties of the inline object', () => {
  const [, create] = c.inventory(shop(), 'tag:Orders').operations;
  assert.deepEqual(create.requestBody, [
    {
      contentType: 'application/json',
      schema: 'inline object {customer: object, discount: object, lines*: array<OrderLine>, note: string}',
    },
  ]);
  assert.deepEqual(create.responses[0], {
    status: '201',
    description: 'Order placed',
    content: [{ contentType: 'application/json', schema: 'Order' }],
  });
  assert.equal(create.responses[1].content[0].schema, 'inline object {code: string, message: string}');
  assert.equal(c.inventory(shop()).operations[0].responses[0].content[0].schema, 'array<Product>');
});
test('business error codes come from examples and enums of code and errorCode, per 4xx or 5xx status, and are never inferred', () => {
  const r = c.inventory(shop());
  const codes = (id) => r.operations.find((o) => o.operationId === id).errorCodes;
  assert.deepEqual(codes('createOrder'), { 400: ['BAD001'], 409: ['DUP001', 'DUP002'] });
  assert.deepEqual(codes('createInvoice'), { 422: ['INV001', 'INV002'] });
  assert.deepEqual(codes('listProducts'), {});
  const unavailable = changed((d) => {
    d.paths['/invoices'].post.responses[503] = error('Billing is down', 'SRV001');
  });
  assert.deepEqual(c.inventory(unavailable).operations.find((o) => o.operationId === 'createInvoice').errorCodes, {
    422: ['INV001', 'INV002'],
    503: ['SRV001'],
  });
});
test('summaries keep their first line; a description over 400 characters is cut with its length', () => {
  const r = c.inventory(shop());
  assert.equal(r.operations[0].description, `${longText.slice(0, 400)}… (truncated, ${longText.length} chars)`);
  assert.equal(
    r.operations.find((o) => o.operationId === 'createOrder').description,
    'Places an order and reserves the stock.',
  );
  assert.equal(r.operations.find((o) => o.operationId === 'listOrders').summary, 'List the orders of the buyer');
  assert.equal(r.operations.find((o) => o.operationId === 'listOrders').description, null);
});
test('an external reference is reported and not followed', () => {
  const doc = changed((d) => {
    d.paths['/invoices'].post.requestBody = { $ref: 'common.json#/bodies/Invoice' };
    d.paths['/orders'].get.responses[200].content['application/json'].schema = { $ref: 'common.json#/Order' };
  });
  const r = c.inventory(doc);
  assert.deepEqual(r.operations.find((o) => o.operationId === 'createInvoice').requestBody, [
    { contentType: null, schema: 'external ref common.json#/bodies/Invoice' },
  ]);
  assert.equal(
    r.operations.find((o) => o.operationId === 'listOrders').responses[0].content[0].schema,
    'external ref common.json#/Order',
  );
});

// ------------------------------------------------------------------ coupling and orphans
test('the coupling matrix follows schemas through other schemas and tolerates cycles', () => {
  const uses = Object.fromEntries(c.couplingMatrix(shop()).schemas.map((s) => [s.schema, s.operations]));
  assert.deepEqual(uses.Order, ['createOrder', 'getOrder', 'listOrders']);
  assert.deepEqual(uses.OrderLine, uses.Order, 'OrderLine is used by every operation using Order');
  assert.deepEqual(uses.Money, ['createInvoice', 'createOrder', 'getOrder', 'listOrders']);
  assert.deepEqual(uses.Product, ['listProducts']);
  assert.deepEqual(uses.Unused, []);
});
test('an operation without operationId appears in the matrix as METHOD path', () => {
  const doc = changed((d) => {
    delete d.paths['/invoices'].post.operationId;
  });
  assert.deepEqual(c.couplingMatrix(doc).schemas.find((s) => s.schema === 'Money').operations, [
    'POST /invoices',
    'createOrder',
    'getOrder',
    'listOrders',
  ]);
});
test('a schema used on both sides of the scope is marked as coupling outside the scope', () => {
  const marks = (scope) =>
    Object.fromEntries(c.couplingMatrix(shop(), scope).schemas.map((s) => [s.schema, s.outsideScope]));
  assert.deepEqual(marks('tag:Orders'), {
    Money: true,
    OnlyUsedByUnused: false,
    Order: false,
    OrderLine: false,
    Product: false,
    Unused: false,
  });
  assert.equal(marks('').Money, false);
  assert.equal(marks('operationId:getOrder').Order, true);
});
test('an inline structure duplicated in two operations is found with its pointers', () => {
  const { inline } = c.couplingMatrix(shop(), 'tag:Orders');
  const money = inline.find((s) => s.shape === 'amount: number, currency: string');
  assert.deepEqual(money.properties, ['amount', 'currency']);
  assert.deepEqual(money.operations, ['createInvoice', 'createOrder']);
  assert.deepEqual(money.occurrences, [
    { operation: 'createInvoice', pointers: ['requestBody.revenue'] },
    { operation: 'createOrder', pointers: ['requestBody.discount'] },
  ]);
  assert.equal(money.outsideScope, true);
  const envelope = inline.find((s) => s.shape === 'code: string, message: string');
  assert.deepEqual(envelope.operations, ['createInvoice', 'createOrder', 'getOrder', 'getStatusHistory', 'listOrders']);
  assert.deepEqual(envelope.occurrences.slice(1, 3), [
    { operation: 'createOrder', pointers: ['responses.400', 'responses.409'] },
    { operation: 'getOrder', pointers: ['responses.404'] },
  ]);
});
test('a shape with one property, or seen in one operation only, is not a duplicated structure', () => {
  const shapes = c.couplingMatrix(shop()).inline.map((s) => s.shape);
  assert.deepEqual(shapes, ['amount: number, currency: string', 'code: string, message: string']);
  const nested = changed((d) => {
    d.paths['/invoices'].post.responses[201].content['application/json'].schema = {
      type: 'array',
      items: { type: 'object', properties: { status: text(), at: text() } },
    };
  });
  assert.deepEqual(c.couplingMatrix(nested).inline.find((s) => s.shape === 'at: string, status: string').occurrences, [
    { operation: 'createInvoice', pointers: ['responses.201[]'] },
    { operation: 'getStatusHistory', pointers: ['responses.200[]'] },
  ]);
});
test('a schema no operation reaches is an orphan, and so is a schema only orphans reference', () => {
  assert.deepEqual(c.orphanSchemas(shop()), ['OnlyUsedByUnused', 'Unused']);
  assert.deepEqual(
    c.inventory(shop(), 'tag:Billing').orphans,
    ['OnlyUsedByUnused', 'Unused'],
    'orphans do not depend on the scope',
  );
});

// ------------------------------------------------------------------ semantic diff
test('a change of key order is not a change', () => {
  const r = c.diffContracts(shop(), reversed(shop()));
  assert.equal(r.identical, true);
  assert.deepEqual(
    [r.operations.added, r.operations.removed, r.operations.renamed, r.operations.moved, r.operations.modified],
    [[], [], [], [], []],
  );
  assert.deepEqual([r.schemas.added, r.schemas.removed, r.schemas.modified, r.elsewhere], [[], [], [], []]);
});
test('the order of required, enum and parameters is not a change either', () => {
  const r = diff((d) => {
    d.components.schemas.Order.required.reverse();
    d.components.schemas.Order.properties.status.enum.reverse();
    d.paths['/orders/{orderId}'].parameters.reverse();
    body(d, '/invoices').required.reverse();
  });
  assert.deepEqual([r.operations.modified, r.schemas.modified], [[], []]);
});
test('an empty required list is the same as no required list', () => {
  const r = diff((d) => {
    body(d, '/orders').properties.note.required = [];
  });
  assert.deepEqual([r.operations.modified, r.schemas.modified], [[], []]);
});
test('an operation added and an operation removed are identified by method and path', () => {
  const r = diff((d) => {
    d.paths['/orders/{orderId}'].delete = {
      operationId: 'cancelOrder',
      tags: ['Orders'],
      responses: { 204: { description: 'Cancelled' } },
    };
    delete d.paths['/countries/{countryCode}/products'];
  });
  assert.deepEqual(r.operations.added, [
    { method: 'DELETE', path: '/orders/{orderId}', operationId: 'cancelOrder', tags: ['Orders'] },
  ]);
  assert.deepEqual(r.operations.removed, [
    { method: 'GET', path: '/countries/{countryCode}/products', operationId: 'listProducts', tags: ['Catalogue'] },
  ]);
  assert.equal(r.identical, false);
});
test('a renamed operationId is reported as renamed, not as a modification', () => {
  const r = diff((d) => {
    d.paths['/orders'].get.operationId = 'searchOrders';
  });
  assert.deepEqual(r.operations.renamed, [{ method: 'GET', path: '/orders', from: 'listOrders', to: 'searchOrders' }]);
  assert.deepEqual([r.operations.added, r.operations.removed, r.operations.modified], [[], [], []]);
});
test('an operation moved to another path is reported as moved, not as an addition and a removal', () => {
  const r = diff((d) => {
    d.paths['/billing/invoices'] = d.paths['/invoices'];
    delete d.paths['/invoices'];
  });
  assert.deepEqual(r.operations.moved, [
    { operationId: 'createInvoice', from: 'POST /invoices', to: 'POST /billing/invoices' },
  ]);
  assert.deepEqual([r.operations.added, r.operations.removed, r.operations.modified], [[], [], []]);
});
test('an inline change modifies its operation and names the pointer with old and new values', () => {
  const r = diff((d) => {
    body(d, '/orders').properties.note.type = 'integer';
    d.paths['/orders'].post.summary = `Place ${'x'.repeat(100)}`;
  });
  assert.deepEqual(ids(r.operations.modified), ['createOrder']);
  assert.deepEqual(modified(r, 'createOrder').changes, [
    {
      pointer: '/requestBody/content/application~1json/schema/properties/note/type',
      kind: 'changed',
      old: 'string',
      new: 'integer',
    },
    { pointer: '/summary', kind: 'changed', old: 'Place an order', new: `Place ${'x'.repeat(74)}…` },
  ]);
  assert.deepEqual(modified(r, 'createOrder').schemas, []);
  assert.deepEqual(facts(r, 'createOrder'), ['type changed']);
});
test('an operation is modified when only a component schema it uses has changed', () => {
  const r = diff((d) => {
    d.components.schemas.Money.properties.amount.type = 'string';
  });
  assert.deepEqual(ids(r.operations.modified), ['createInvoice', 'listOrders', 'createOrder', 'getOrder']);
  for (const o of r.operations.modified) {
    assert.deepEqual(o.changes, []);
    assert.deepEqual(o.schemas, ['Money']);
    assert.ok(o.facts.some((f) => f.fact === 'type changed'));
  }
  assert.equal(
    modified(r, 'getOrder').facts[0].at,
    '/responses/200/content/application~1json/schema/properties/total/properties/amount/type',
  );
  assert.deepEqual(r.schemas.modified, [
    {
      schema: 'Money',
      operations: {
        base: ['createInvoice', 'createOrder', 'getOrder', 'listOrders'],
        current: ['createInvoice', 'createOrder', 'getOrder', 'listOrders'],
      },
      outsideScope: false,
      changes: [{ pointer: '/properties/amount/type', kind: 'changed', old: 'number', new: 'string' }],
    },
  ]);
});
test('a change deep in a cyclic schema reaches the operations that use it', () => {
  const r = diff((d) => {
    d.components.schemas.OrderLine.properties.quantity.type = 'number';
  });
  assert.deepEqual(ids(r.operations.modified), ['listOrders', 'createOrder', 'getOrder']);
  assert.ok(facts(r, 'listOrders').includes('type changed'));
});
test('a request field that becomes required and a new required request field are two facts', () => {
  const r = diff((d) => {
    body(d, '/orders').required.push('note', 'channel');
    body(d, '/orders').properties.channel = text();
    body(d, '/invoices').properties.revenue.required = ['amount'];
  });
  assert.deepEqual(modified(r, 'createOrder').facts, [
    { fact: 'new required request field', at: '/requestBody/content/application~1json/schema/required/channel' },
    { fact: 'request field became required', at: '/requestBody/content/application~1json/schema/required/note' },
  ]);
  assert.deepEqual(facts(r, 'createInvoice'), ['request field became required']);
});
test('a field made required in a component schema counts for the requests that carry it, not for the responses', () => {
  const r = diff((d) => {
    d.components.schemas.Money.required = ['currency'];
  });
  assert.deepEqual(facts(r, 'createInvoice'), ['request field became required']);
  assert.deepEqual(facts(r, 'getOrder'), []);
});
test('a required parameter added is a fact; an optional one is not', () => {
  const r = diff((d) => {
    d.paths['/orders'].get.parameters.push(
      { name: 'tenant', in: 'header', required: true, schema: text() },
      { name: 'page', in: 'query', schema: { type: 'integer' } },
    );
    d.paths['/orders/{orderId}'].get.parameters[0].required = true;
  });
  assert.deepEqual(modified(r, 'listOrders').facts, [
    { fact: 'required parameter added', at: '/parameters/header:tenant' },
  ]);
  assert.deepEqual(
    modified(r, 'listOrders').changes.map((x) => `${x.kind} ${x.pointer}`),
    ['added /parameters/header:tenant', 'added /parameters/query:page'],
  );
  assert.deepEqual(facts(r, 'getOrder'), ['parameter became required']);
});
test('a response field removed is a fact, inline or through a component schema', () => {
  const r = diff((d) => {
    delete d.paths['/orders/{orderId}/status-history'].get.responses[200].content['application/json'].schema.items
      .properties.at;
    delete d.components.schemas.Product.properties.name;
  });
  assert.deepEqual(modified(r, 'getStatusHistory').facts, [
    { fact: 'response field removed', at: '/responses/200/content/application~1json/schema/items/properties/at' },
  ]);
  assert.deepEqual(facts(r, 'listProducts'), ['response field removed']);
  const request = diff((d) => {
    delete body(d, '/orders').properties.note;
  });
  assert.deepEqual(facts(request, 'createOrder'), [], 'a request field removed is not a response field removed');
});
test('an enum value removed is a fact everywhere; an enum value added is a fact in responses', () => {
  const r = diff((d) => {
    d.paths['/orders'].get.parameters[0].schema.enum = ['OPEN', 'SHIPPED', 'RETURNED'];
    d.components.schemas.Order.properties.status.enum.push('RETURNED');
  });
  assert.deepEqual(modified(r, 'listOrders').facts, [
    { fact: 'enum value removed', at: '/parameters/query:status/schema/enum/CANCELLED' },
    {
      fact: 'enum value added (response)',
      at: '/responses/200/content/application~1json/schema/items/properties/status/enum/RETURNED',
    },
  ]);
  assert.deepEqual(facts(r, 'getOrder'), ['enum value added (response)']);
  assert.deepEqual(modified(r, 'listOrders').changes, [
    { pointer: '/parameters/query:status/schema/enum/CANCELLED', kind: 'removed', old: 'CANCELLED' },
    { pointer: '/parameters/query:status/schema/enum/RETURNED', kind: 'added', new: 'RETURNED' },
  ]);
});
test('a 2xx status code removed is a fact; a 4xx one is not', () => {
  const r = diff((d) => {
    delete d.paths['/orders'].post.responses[201];
    delete d.paths['/orders'].post.responses[409];
  });
  assert.deepEqual(modified(r, 'createOrder').facts, [{ fact: '2xx status code removed', at: '/responses/201' }]);
});
test('a change of description, summary or example only is flagged as such', () => {
  const r = diff((d) => {
    d.paths['/orders/{orderId}'].get.summary = 'Read an order';
    d.paths['/orders/{orderId}'].get.responses[404].description = 'No such order';
    d.paths['/invoices'].post.responses[422].content['application/json'].example.code = 'INV009';
    d.components.schemas.Product.description = 'Something sold';
    d.paths['/orders'].get.summary = 'List';
    d.paths['/orders'].get.deprecated = true;
  });
  for (const id of ['getOrder', 'createInvoice', 'listProducts'])
    assert.deepEqual(facts(r, id), ['description/summary/example only'], id);
  assert.deepEqual(facts(r, 'listOrders'), [], 'deprecated is not documentation');
});
test('a property named description or type is a field, not documentation nor a type', () => {
  const r = diff((d) => {
    d.components.schemas.Product.properties.description = text();
    d.components.schemas.Product.properties.type = text();
  });
  const back = c.diffContracts(
    changed((d) => {
      d.components.schemas.Product.properties.description = text();
      d.components.schemas.Product.properties.type = text();
    }),
    shop(),
  );
  assert.deepEqual(facts(r, 'listProducts'), []);
  assert.deepEqual(facts(back, 'listProducts'), ['response field removed', 'response field removed']);
});
test('schemas added, removed and modified come with the operations that use them on each side', () => {
  const r = diff((d) => {
    d.components.schemas.Address = { type: 'object', properties: { city: text() } };
    d.components.schemas.Order.properties.shipTo = ref('Address');
    delete d.components.schemas.Product;
    d.paths['/countries/{countryCode}/products'].get.responses[200].content['application/json'].schema.items = {
      type: 'object',
    };
  });
  assert.deepEqual(r.schemas.added, [
    {
      schema: 'Address',
      operations: { base: [], current: ['createOrder', 'getOrder', 'listOrders'] },
      outsideScope: false,
    },
  ]);
  assert.deepEqual(r.schemas.removed, [
    { schema: 'Product', operations: { base: ['listProducts'], current: [] }, outsideScope: false },
  ]);
  assert.deepEqual(
    r.schemas.modified.map((s) => [s.schema, s.changes]),
    [['Order', [{ pointer: '/properties/shipTo', kind: 'added' }]]],
  );
  assert.deepEqual(
    modified(r, 'listProducts').changes.map((x) => `${x.kind} ${x.pointer}`),
    [
      'removed /responses/200/content/application~1json/schema/items/$ref',
      'added /responses/200/content/application~1json/schema/items/type',
    ],
  );
});
test('schemas that become orphan or stop being orphan are reported', () => {
  const r = diff((d) => {
    d.paths['/countries/{countryCode}/products'].get.responses[200].content['application/json'].schema.items =
      ref('Unused');
    d.components.schemas.Late = { type: 'object' };
  });
  assert.deepEqual(r.orphans, { became: ['Product'], stopped: ['OnlyUsedByUnused', 'Unused'] });
  assert.deepEqual(
    r.schemas.added[0],
    { schema: 'Late', operations: { base: [], current: [] }, outsideScope: false },
    'a new schema nobody uses is not a transition',
  );
  assert.deepEqual(c.diffContracts(shop(), shop()).orphans, { became: [], stopped: [] });
});
test('a change outside the operations and the schemas is listed apart', () => {
  const r = diff((d) => {
    d.info.version = '1.5.0';
    d.servers = [{ url: 'https://shop.example' }];
    d.components.parameters.OrderId.schema.type = 'integer';
  });
  assert.deepEqual(r.versions, { base: '1.4.0', current: '1.5.0' });
  assert.deepEqual(r.elsewhere, [
    { pointer: '/components/parameters/OrderId/schema/type', kind: 'changed', old: 'string', new: 'integer' },
    { pointer: '/info/version', kind: 'changed', old: '1.4.0', new: '1.5.0' },
    { pointer: '/servers', kind: 'added' },
  ]);
  assert.deepEqual(
    modified(r, 'getStatusHistory').facts,
    [{ fact: 'type changed', at: '/parameters/path:orderId/schema/type' }],
    'a shared parameter is compared where it is used',
  );
  assert.deepEqual(c.diffContracts({ paths: {} }, { paths: {} }).versions, { base: null, current: null });
});
test('with a tag scope, operations are sorted into both sides, entering, leaving and outside', () => {
  const r = diff((d) => {
    d.paths['/countries/{countryCode}/products'].get.tags.push('Orders');
    d.paths['/orders/{orderId}/status-history'].get.tags = ['Audit'];
    d.paths['/orders/{orderId}'].delete = {
      operationId: 'cancelOrder',
      tags: ['Orders'],
      responses: { 204: { description: 'Cancelled' } },
    };
    delete d.paths['/orders'].post;
  }, 'tag:Orders');
  const names = (items) => items.map((o) => `${o.operationId}${o.because ? `: ${o.because}` : ''}`);
  assert.equal(r.scope.text, 'tag:Orders');
  assert.deepEqual(names(r.scope.both), ['listOrders', 'getOrder']);
  assert.deepEqual(names(r.scope.entering), [
    'listProducts: out of scope at the base',
    'cancelOrder: absent at the base',
  ]);
  assert.deepEqual(names(r.scope.leaving), ['createOrder: absent now', 'getStatusHistory: out of scope now']);
  assert.deepEqual(names(r.scope.outside), ['createInvoice']);
  assert.deepEqual(
    ids(r.operations.modified),
    ['listProducts', 'getStatusHistory'],
    'in scope on one side is enough to be detailed',
  );
});
test('with a scope, changes out of scope are counted and a shared changed schema is marked', () => {
  const r = diff((d) => {
    d.components.schemas.Money.properties.amount.type = 'string';
    d.components.schemas.Product.properties.sku.type = 'integer';
    d.paths['/invoices'].post.summary = 'Bill';
  }, 'tag:Orders');
  assert.deepEqual(ids(r.operations.modified), ['listOrders', 'createOrder', 'getOrder']);
  assert.deepEqual(r.outOfScopeChanges, { operations: 2, schemas: 1 });
  assert.deepEqual(
    r.schemas.modified.map((s) => [s.schema, s.outsideScope]),
    [['Money', true]],
  );
  assert.equal(c.diffContracts(shop(), shop(), 'tag:Orders').scope.both.length, 4);
});
test('a scope tag that no longer exists blocks the diff and names the operations that carried it', () => {
  blocked(
    () =>
      diff((d) => {
        d.paths['/invoices'].post.tags = ['Finance'];
        d.tags.splice(2, 1);
      }, 'tag:Orders;tag:Billing'),
    /scope entry tag:Billing no longer exists in the current contract/,
    /POST \/invoices \(createInvoice\)/,
  );
  blocked(
    () =>
      diff((d) => {
        d.paths['/invoices'].post.tags = ['Finance'];
      }, 'tag:Billing'),
    /"tag:Billing" selects no operation of the current contract/,
    /selected at the base: POST \/invoices \(createInvoice\)/,
  );
});
test('a scope operationId renamed or removed blocks the diff', () => {
  blocked(
    () =>
      diff((d) => {
        d.paths['/orders'].get.operationId = 'searchOrders';
      }, 'operationId:listOrders'),
    /operationId:listOrders was renamed \(operationId now: searchOrders\)/,
    /GET \/orders \(listOrders\)/,
  );
  blocked(
    () =>
      diff((d) => {
        delete d.paths['/orders'].get;
      }, 'operationId:listOrders'),
    /operationId:listOrders was removed/,
    /GET \/orders \(listOrders\)/,
  );
  blocked(() => diff(() => {}, 'operationId:nothing'), /unknown operationId "nothing"/);
});

// ------------------------------------------------------------------ command line, in a git repository made here
// git and Node start slowly on Windows: the repository is made once and copied, and the tests run concurrently.
const script = fileURLToPath(contractPath);
const file = 'docs/contracts/shop.openapi.json';
const run = (cwd, ...args) => spawnAsync(process.execPath, [script, ...args], { cwd });
const git = async (cwd, ...args) => {
  const r = await spawnAsync('git', args, { cwd });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
const write = (dir, doc, rel = file) => fs.writeFileSync(path.join(dir, rel), `${JSON.stringify(doc, null, 2)}\n`);
const baseRepo = async () => {
  const dir = tmp({ [file]: `${JSON.stringify(shop(), null, 2)}\n` });
  for (const args of [
    ['init', '-q'],
    ['config', 'user.email', 'tests@partition.invalid'],
    ['config', 'user.name', 'Partition tests'],
    ['config', 'commit.gpgsign', 'false'],
    // Git 2.47+ ends a commit with a detached `maintenance run --auto` whose objects/maintenance.lock outlives
    // the commit: a copy made meanwhile lists the lock, which vanishes before it is read.
    ['config', 'maintenance.auto', 'false'],
    ['add', '.'],
    ['commit', '-q', '-m', 'base contract'],
  ])
    await git(dir, ...args);
  return dir;
};
let base;
const repo = async () => copyOf(await (base ??= baseRepo()));
const next = () =>
  changed((d) => {
    d.info.version = '1.5.0';
    d.components.schemas.Money.properties.amount.type = 'string';
    body(d, '/orders').required.push('note');
    d.paths['/orders/{orderId}'].delete = {
      operationId: 'cancelOrder',
      tags: ['Orders'],
      responses: { 204: { description: 'Cancelled' } },
    };
  });
const hasGit = spawnSync('git', ['--version']).status === 0;
const gitTest = (name, fn) => test(name, { skip: !hasGit && 'git not available' }, fn);

describe('command line', { concurrency: true }, () => {
  gitTest(
    'provenance prints the path, the version, the sha of the last commit and the absence of uncommitted changes',
    async () => {
      const dir = await repo(),
        r = await run(dir, 'provenance', file);
      assert.equal(r.status, 0, r.stderr);
      assert.equal(
        r.stdout,
        `Contract: ${file}\nVersion: 1.4.0\nProvenance: ${await git(dir, 'rev-parse', 'HEAD')}\nUncommitted changes: no\n`,
      );
    },
  );
  gitTest('provenance reports uncommitted changes with the last commit', async () => {
    const dir = await repo();
    write(dir, next());
    const sha = await git(dir, 'rev-parse', 'HEAD');
    assert.equal(
      (await run(dir, 'provenance', file)).stdout,
      `Contract: ${file}\nVersion: 1.5.0\nProvenance: uncommitted (last commit ${sha})\nUncommitted changes: yes\n`,
    );
    const data = JSON.parse((await run(dir, 'provenance', file, '--json')).stdout);
    assert.deepEqual([data.contract, data.version, data.uncommittedChanges, data.sha], [file, '1.5.0', true, sha]);
  });
  gitTest('provenance tells a file never committed from a directory without git history', async () => {
    const dir = await repo();
    write(
      dir,
      changed((d) => {
        delete d.info.version;
      }),
      'draft.json',
    );
    assert.match(
      (await run(dir, 'provenance', 'draft.json')).stdout,
      /^Contract: draft\.json\nVersion: absent\nProvenance: uncommitted\nUncommitted changes: yes\n$/,
    );
    const plain = tmp({ 'shop.json': JSON.stringify(shop()) });
    assert.match(
      (await run(plain, 'provenance', 'shop.json')).stdout,
      /\nProvenance: no git history\nUncommitted changes: unknown \(no git history\)\n$/,
    );
  });
  gitTest('diff against HEAD prints every section for the working-tree contract', async () => {
    const dir = await repo();
    write(dir, next());
    const r = await run(dir, 'diff', file, '--base', 'HEAD'),
      sha = await git(dir, 'rev-parse', 'HEAD');
    assert.equal(r.status, 0, r.stderr);
    for (const expected of [
      `Base: HEAD (${sha})`,
      'Version: 1.4.0 → 1.5.0',
      `Current provenance: uncommitted (last commit ${sha})`,
      '## Operations added (1)',
      '- DELETE /orders/{orderId} - cancelOrder [Orders]',
      '## Operations removed (0)',
      '## operationId renamed (0)',
      '## Operations moved (0)',
      '## Operations modified (4)',
      '    - request field became required: /requestBody/content/application~1json/schema/required/note',
      '  - changed component schemas it depends on: Money',
      '## Schemas added (0)',
      '## Schemas removed (0)',
      '## Schemas modified (1)',
      '  - changed /properties/amount/type: "number" → "string"',
      '## Orphans',
      '- became orphan: none',
      '## Changes elsewhere in the contract (1)\n- changed /info/version: "1.4.0" → "1.5.0"',
    ]) {
      assert.ok(r.stdout.includes(expected), `missing: ${expected}\n${r.stdout}`);
    }
    assert.ok(!r.stdout.includes('## Scope'));
  });
  gitTest('diff with a scope adds the scope section and counts what it leaves out', async () => {
    const dir = await repo();
    write(dir, next());
    const r = await run(
      path.join(dir, 'docs'),
      'diff',
      'contracts/shop.openapi.json',
      '--base',
      'HEAD',
      '--scope',
      'tag:Billing',
    );
    assert.equal(r.status, 0, r.stderr);
    for (const expected of [
      'Scope: tag:Billing',
      '## Operations added (0)',
      '## Operations modified (1)',
      '- Money - used at the base by: createInvoice, createOrder, getOrder, listOrders; now by: createInvoice, createOrder, getOrder, listOrders - coupling outside the scope',
      '## Scope',
      '- in scope on both sides (1): POST /invoices',
      '- entering (0): none',
      '- changes out of scope, not detailed: 4 operations, 0 schemas',
    ]) {
      assert.ok(r.stdout.includes(expected), `missing: ${expected}\n${r.stdout}`);
    }
    const gone = await run(dir, 'diff', file, '--base', 'HEAD', '--scope', 'tag:billing');
    assert.equal(gone.status, 1);
    assert.match(gone.stderr, /^contract: unknown tag "billing"/);
  });
  gitTest('diff against a ref that does not exist exits 1 and asks for an explicit base', async () => {
    const r = await run(await repo(), 'diff', file, '--base', '0000000');
    assert.equal(r.status, 1);
    assert.equal(r.stdout, '');
    assert.match(r.stderr, /^contract: base 0000000 does not exist in this repository\. Pass an explicit base/);
  });
  gitTest('a base that starts with - is refused, never passed to git as an option', async () => {
    const r = await run(await repo(), 'diff', file, '--base', '--output=injected');
    assert.equal(r.status, 1);
    assert.equal(r.stdout, '');
    assert.match(r.stderr, /^contract: base --output=injected does not exist in this repository/);
  });
  test('diff outside a git repository exits 1: there is no base', async () => {
    const r = await run(tmp({ 'shop.json': JSON.stringify(shop()) }), 'diff', 'shop.json', '--base', 'HEAD');
    assert.equal(r.status, 1);
    assert.equal(r.stdout, '');
    assert.match(r.stderr, /^contract: shop\.json is not in a git repository: there is no base to compare with\./);
  });
  gitTest(
    'diff on a contract renamed since the base exits 1 with the --base-path hint, then works with --base-path',
    async () => {
      const dir = await repo(),
        moved = 'docs/contracts/store.openapi.json';
      await git(dir, 'mv', file, moved);
      await git(dir, 'commit', '-q', '-m', 'rename the contract');
      const r = await run(dir, 'diff', moved, '--base', 'HEAD~1');
      assert.equal(r.status, 1);
      assert.match(r.stderr, /^contract: docs\/contracts\/store\.openapi\.json does not exist at HEAD~1/);
      assert.ok(r.stderr.includes(file), 'the history names the former path');
      assert.match(r.stderr, /--base-path <path from the repository root>/);
      const same = await run(dir, 'diff', moved, '--base', 'HEAD~1', '--base-path', file);
      assert.equal(same.status, 0, same.stderr);
      assert.equal(same.stdout, 'Nothing changed since HEAD~1.\n');
      write(dir, next(), moved);
      const after = await run(dir, 'diff', moved, '--base', 'HEAD~1', '--base-path', file);
      assert.equal(after.status, 0, after.stderr);
      assert.match(after.stdout, /## Operations added \(1\)/);
    },
  );
  gitTest('diff on an unchanged contract prints that nothing changed and exits 0', async () => {
    const dir = await repo(),
      r = await run(dir, 'diff', file, '--base', 'HEAD');
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout, 'Nothing changed since HEAD.\n');
    fs.writeFileSync(path.join(dir, file), JSON.stringify(reversed(shop())));
    assert.match(
      (await run(dir, 'diff', file, '--base', 'HEAD')).stdout,
      /Current provenance: uncommitted[^]*## Operations modified \(0\)/,
      'reformatted but uncommitted: the report says so',
    );
  });
  gitTest('--json prints one JSON document for each command', async () => {
    const dir = await repo();
    write(dir, next());
    const inventory = JSON.parse((await run(dir, 'inventory', file, '--scope', 'tag:Orders', '--json')).stdout);
    assert.deepEqual([inventory.inScope, inventory.total, inventory.orphans], [5, 7, ['OnlyUsedByUnused', 'Unused']]);
    const r = JSON.parse((await run(dir, 'diff', file, '--base', 'HEAD', '--json')).stdout);
    assert.deepEqual(
      [r.contract, r.base.ref, r.base.sha, r.base.path],
      [file, 'HEAD', await git(dir, 'rev-parse', 'HEAD'), file],
    );
    assert.deepEqual(
      [r.identical, r.operations.added.length, r.operations.modified.length, r.provenance.uncommittedChanges],
      [false, 1, 4, true],
    );
  });
  test('a file that is not JSON exits 2 with the instruction to convert it', async () => {
    const r = await run(tmp({ 'shop.yaml': 'openapi: 3.0.3\ninfo:\n  title: Shop API\n' }), 'inventory', 'shop.yaml');
    assert.equal(r.status, 2);
    assert.equal(r.stdout, '');
    assert.equal(
      r.stderr,
      'contract: shop.yaml is not JSON. Convert a YAML contract to JSON first; this script reads JSON only.\n',
    );
  });
  test('a JSON file that does not hold an object exits 2', async () => {
    const r = await run(tmp({ 'shop.json': '[1, 2]' }), 'inventory', 'shop.json');
    assert.equal(r.status, 2);
    assert.equal(r.stdout, '');
    assert.equal(r.stderr, 'contract: shop.json does not hold a JSON object; an OpenAPI 3 document is expected.\n');
  });
  test('the inventory prints compact Markdown: header, blocks in scope, lines out of scope, matrix, orphans', async () => {
    const r = await run(
      tmp({ 'shop.json': JSON.stringify(shop()) }),
      'inventory',
      'shop.json',
      '--scope',
      'tag:Orders',
    );
    assert.equal(r.status, 0, r.stderr);
    for (const expected of [
      '# Shop API - version 1.4.0',
      'Operations: 4 in scope / 6 in the contract',
      'Tags: Billing (1), Catalogue (1), Orders (4), Returns (0)',
      '### GET /orders/{orderId}/status-history',
      '- parameters: orderId (path, string, required); verbose (query, integer, optional)',
      '- request body: application/json: inline object {customer: object, discount: object, lines*: array<OrderLine>, note: string}',
      '  - 409 Duplicate order - application/json: inline object {code: string, message: string}',
      '- terminal resource: status-history (sub-resource of orders)',
      '- terminal resource: orders\n',
      '- business error codes: HTTP 400: BAD001; HTTP 409: DUP001, DUP002',
      '- description: absent',
      '## Operations out of scope\n\n- GET /countries/{countryCode}/products - listProducts [Catalogue]\n- POST /invoices - createInvoice [Billing]\n',
      '| Money | createInvoice, createOrder, getOrder, listOrders | coupling outside the scope |',
      '| Order | createOrder, getOrder, listOrders |  |',
      '- {amount: number, currency: string} - createInvoice: requestBody.revenue; createOrder: requestBody.discount - coupling outside the scope',
      '## Orphan schemas\n\nOnlyUsedByUnused, Unused',
    ]) {
      assert.ok(r.stdout.includes(expected), `missing: ${expected}\n${r.stdout}`);
    }
    assert.ok(!r.stdout.includes('| Unused |'), 'orphans are not in the matrix');
    assert.ok(!r.stdout.includes('Stock is read'), 'nothing of an out-of-scope operation but its line');
  });
  test('what the contract does not say is printed as absent, and a schema every operation uses as all N operations', async () => {
    const reply = (description) => ({
      responses: { 200: { description, content: json(ref('Money')) }, 500: { description: 'Failure' } },
    });
    const doc = {
      paths: { '/a': { get: reply('A') }, '/{id}': { get: reply('B') } },
      components: { schemas: { Money: amount() } },
    };
    const r = await run(tmp({ 'tiny.json': JSON.stringify(doc) }), 'inventory', 'tiny.json');
    assert.equal(r.status, 0, r.stderr);
    for (const expected of [
      '# absent - version absent',
      'Operations: 2 in scope / 2 in the contract',
      'Scope: whole contract',
      'Tags: none; without tag (2)',
      '### GET /{id}',
      '- operationId: absent',
      '- tags: none',
      '- summary: absent',
      '- parameters: none',
      '  - 500 Failure - no content',
      '- terminal resource: absent',
      '- business error codes: none documented',
      '## Operations out of scope\n\nnone',
      '| Money | all 2 operations |  |',
      '## Inline duplicated structures\n\nnone',
      '## Orphan schemas\n\nnone',
    ]) {
      assert.ok(r.stdout.includes(expected), `missing: ${expected}\n${r.stdout}`);
    }
  });
  test('usage errors exit 2 and blocking checks exit 1, both on stderr with the contract: prefix', async () => {
    const dir = tmp({ 'shop.json': JSON.stringify(shop()) });
    const cases = [
      [['inventory'], 2, /^contract: usage:/],
      [['explain', 'shop.json'], 2, /^contract: usage:/],
      [['diff', 'shop.json'], 2, /^contract: usage:/],
      [['inventory', 'shop.json', '--scopes', 'x'], 2, /^contract: unknown or incomplete option --scopes/],
      [['inventory', 'missing.json'], 2, /^contract: cannot read missing\.json/],
      [['inventory', 'shop.json', '--scope', 'Orders'], 1, /^contract: invalid scope entry "Orders"/],
      [
        ['inventory', 'shop.json', '--scope', 'tag:Returns'],
        1,
        /^contract: the scope "tag:Returns" selects no operation/,
      ],
    ];
    const results = await Promise.all(cases.map(([args]) => run(dir, ...args)));
    cases.forEach(([args, status, pattern], i) => {
      assert.equal(results[i].status, status, args.join(' '));
      assert.match(results[i].stderr, pattern);
      assert.equal(results[i].stdout, '');
    });
  });
});
