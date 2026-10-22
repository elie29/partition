#!/usr/bin/env node

// Partition - facts about an OpenAPI 3 contract (JSON only). Node >= 22, no dependency.
//
//   node contract.mjs provenance <contract>
//   node contract.mjs inventory  <contract> [--scope "<scope>"] [--json]
//   node contract.mjs diff       <contract> --base <git-ref> [--base-path <path-at-base>] [--scope "<scope>"] [--json]
//
// Scope: "tag:<tag name>;operationId:<operationId>" - union of the entries, exact match.
// The script reports facts and decides nothing; a value absent from the contract is printed as absent.
// Exit codes: 0 success, 1 blocking precondition, 2 usage or I/O error.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const USAGE =
  'usage:\n  node contract.mjs provenance <contract>\n  node contract.mjs inventory  <contract> [--scope "<scope>"] [--json]\n  node contract.mjs diff       <contract> --base <git-ref> [--base-path <path-at-base>] [--scope "<scope>"] [--json]';
const SYNTAX =
  'Scope syntax: "tag:<tag name>;operationId:<operationId>" - entries separated by ";", each prefixed by tag: or operationId:, compared exactly.';
const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'];
const SCHEMAS = '#/components/schemas/';
const COMPOSED = ['allOf', 'oneOf', 'anyOf'];
const CODES = new Set(['code', 'errorCode']);
const DOC = new Set(['description', 'summary', 'example', 'examples']);

// ---------------------------------------------------------------- helpers
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const obj = (v) => (isObj(v) ? v : {});
const list = (v) => (Array.isArray(v) ? v : []);
const scalar = (v) => v === null || typeof v !== 'object';
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const byKey = (a, b) => cmp(a[0], b[0]);
const clip = (v, max) => (typeof v === 'string' && v.length > max ? `${v.slice(0, max)}…` : v);
const firstLine = (v, max) => (typeof v === 'string' ? clip(v.trim().split(/\r?\n/)[0], max) : null);
const esc = (k) => String(k).replace(/~/g, '~0').replace(/\//g, '~1');
const unesc = (k) => k.replace(/~1/g, '/').replace(/~0/g, '~');
const canon = (v) =>
  JSON.stringify(v, (_, x) =>
    isObj(x)
      ? Object.fromEntries(
          Object.keys(x)
            .sort()
            .map((k) => [k, x[k]]),
        )
      : x,
  );
const labels = (ops) => [...new Set(ops.map((o) => o.label))].sort();
const brief = (o) => ({ method: o.method, path: o.path, operationId: o.operationId, tags: o.tags });
function fail(message, exitCode = 1) {
  throw Object.assign(new Error(message), { exitCode });
}

// Local references: "#/a/b" is read in the document; anything else is external and never followed.
const at = (doc, ref) =>
  ref
    .slice(2)
    .split('/')
    .reduce((n, k) => (n !== null && typeof n === 'object' ? n[unesc(k)] : undefined), doc);
const localRef = (v) => (isObj(v) && typeof v.$ref === 'string' && v.$ref.startsWith('#/') ? v.$ref : null);
const follow = (doc, v) => {
  for (let i = 0; i < 32 && localRef(v); i++) v = at(doc, v.$ref);
  return localRef(v) ? undefined : v;
};
const schemaName = (ref) => (ref.startsWith(SCHEMAS) ? unesc(ref.slice(SCHEMAS.length).split('/')[0]) : null);
const refLabel = (ref) => schemaName(ref) ?? `${ref.startsWith('#') ? 'unresolved' : 'external'} ref ${ref}`;

// Inlines the local references that are not component schemas (parameters, responses, request bodies, examples).
function expand(doc, node, seen = []) {
  if (Array.isArray(node)) return node.map((x) => expand(doc, x, seen));
  if (!isObj(node)) return node;
  const ref = localRef(node);
  if (ref && !ref.startsWith(SCHEMAS) && !seen.includes(ref) && at(doc, ref) !== undefined)
    return expand(doc, at(doc, ref), [...seen, ref]);
  return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, expand(doc, v, seen)]));
}

// Names of the component schemas referenced anywhere under a node.
function refs(node, out = new Set()) {
  if (Array.isArray(node)) node.forEach((x) => refs(x, out));
  else if (isObj(node)) {
    for (const [k, v] of Object.entries(node)) {
      if (k === '$ref' && typeof v === 'string') {
        if (schemaName(v) !== null) out.add(schemaName(v));
      } else refs(v, out);
    }
  }
  return out;
}

// ---------------------------------------------------------------- operations and scope
const paramKey = (p) => (isObj(p) && typeof p.name === 'string' ? `${p.in}:${p.name}` : `ref:${p?.$ref}`);

// Every paths.<path>.<method>, path-level parameters merged (the operation wins on name + in), sorted by path then method.
export function listOperations(contract) {
  const ops = [];
  for (const [route, raw] of Object.entries(obj(contract?.paths))) {
    const item = obj(expand(contract, raw));
    for (const m of METHODS) {
      if (!isObj(item[m])) continue;
      const params = new Map([...list(item.parameters), ...list(item[m].parameters)].map((p) => [paramKey(p), p]));
      const op = { ...item[m], parameters: [...params.values()] };
      const operationId = typeof op.operationId === 'string' ? op.operationId : null;
      const key = `${m.toUpperCase()} ${route}`;
      ops.push({
        key,
        method: m.toUpperCase(),
        path: route,
        operationId,
        label: operationId ?? key,
        tags: list(op.tags).filter((t) => typeof t === 'string'),
        op,
      });
    }
  }
  const rank = (o) => METHODS.indexOf(o.method.toLowerCase());
  return ops.sort((a, b) => cmp(a.path, b.path) || rank(a) - rank(b));
}

export function parseScope(text) {
  const entries = [];
  for (const raw of String(text ?? '').split(';')) {
    const entry = raw.trim();
    if (!entry) continue;
    const m = /^(tag|operationId):([\s\S]*)$/.exec(entry);
    if (!m || !m[2].trim()) fail(`invalid scope entry "${entry}". ${SYNTAX}`);
    entries.push({ kind: m[1], value: m[2].trim() });
  }
  return entries;
}

const scopeText = (entries) => entries.map((e) => `${e.kind}:${e.value}`).join(';');
const tagsOf = (doc, ops) =>
  [
    ...new Set(
      [...list(doc?.tags).map((t) => t?.name), ...ops.flatMap((o) => o.tags)].filter((t) => typeof t === 'string'),
    ),
  ].sort();
const idsOf = (ops) =>
  ops
    .map((o) => o.operationId)
    .filter((id) => id !== null)
    .sort();
const matches = (o, e) => (e.kind === 'tag' ? o.tags.includes(e.value) : o.operationId === e.value);
const known = (doc, ops, e) => (e.kind === 'tag' ? tagsOf(doc, ops) : idsOf(ops)).includes(e.value);

// The operations a scope selects (text or parsed entries); an empty scope is the whole contract.
export function selectOperations(contract, scope, ops = listOperations(contract)) {
  const entries = Array.isArray(scope) ? scope : parseScope(scope);
  if (!entries.length) return ops;
  const unknown = entries.filter((e) => !known(contract, ops, e));
  if (unknown.length) {
    fail(
      `unknown ${unknown.map((e) => `${e.kind} "${e.value}"`).join(', ')}: nothing in the contract matches exactly. ` +
        `Tags of the contract: ${tagsOf(contract, ops).join(', ') || 'none'}. operationIds of the contract: ${idsOf(ops).join(', ') || 'none'}.`,
    );
  }
  const selected = ops.filter((o) => entries.some((e) => matches(o, e)));
  if (!selected.length)
    fail(
      `the scope "${scopeText(entries)}" selects no operation: no operation carries it. The whole contract is not used instead; correct the scope.`,
    );
  return selected;
}

// ---------------------------------------------------------------- schema usage
// Operations, component schemas, who uses what (transitively, cycles tolerated) and the orphans.
function analyse(doc) {
  const ops = listOperations(doc);
  const schemas = obj(obj(doc?.components).schemas);
  const names = Object.keys(schemas).sort(),
    direct = new Map(names.map((n) => [n, [...refs(schemas[n])]]));
  const closure = (roots) => {
    const seen = new Set(),
      todo = [...roots];
    while (todo.length) {
      const n = todo.pop();
      if (seen.has(n)) continue;
      seen.add(n);
      todo.push(...(direct.get(n) ?? []));
    }
    return seen;
  };
  const users = new Map(names.map((n) => [n, []]));
  for (const o of ops) {
    o.uses = closure(refs(o.op));
    for (const n of o.uses) users.get(n)?.push(o);
  }
  return { ops, schemas, names, closure, users, orphans: names.filter((n) => !users.get(n).length) };
}

// Type of a schema as one word: its $ref name, array<…>, a composition, its type, or untyped.
function typeOf(s) {
  if (!isObj(s)) return 'untyped';
  if (typeof s.$ref === 'string') return refLabel(s.$ref);
  for (const k of COMPOSED) if (Array.isArray(s[k])) return `${k}<${s[k].map(typeOf).join(', ')}>`;
  if (s.type === 'array' || s.items !== undefined) return `array<${typeOf(s.items)}>`;
  if (s.type !== undefined) return [].concat(s.type).join('|');
  return isObj(s.properties) ? 'object' : 'untyped';
}

// A body or response schema: component name, or the top-level properties of an inline object.
function describe(s) {
  if (s === undefined) return 'no schema';
  if (isObj(s) && s.$ref === undefined && isObj(s.properties)) {
    const required = list(s.required);
    return `inline object {${Object.keys(s.properties)
      .sort()
      .map((n) => `${n}${required.includes(n) ? '*' : ''}: ${typeOf(s.properties[n])}`)
      .join(', ')}}`;
  }
  if (isObj(s) && s.$ref === undefined && isObj(s.items)) return `array<${describe(s.items)}>`;
  return typeOf(s);
}

function coupling(an, inScope) {
  const outside = (ops) => ops.some((o) => inScope.has(o.key)) && ops.some((o) => !inScope.has(o.key));
  const schemas = an.names.map((schema) => ({
    schema,
    operations: labels(an.users.get(schema)),
    outsideScope: outside(an.users.get(schema)),
  }));
  // Inline objects of two properties or more, keyed by their shape (property names and types).
  const shapes = new Map();
  const visit = (o, s, ptr) => {
    if (!isObj(s) || s.$ref !== undefined) return;
    if (isObj(s.properties)) {
      const props = Object.keys(s.properties).sort();
      if (props.length >= 2) {
        const shape = props.map((n) => `${n}: ${typeOf(s.properties[n])}`).join(', ');
        if (!shapes.has(shape)) shapes.set(shape, { properties: props, ops: new Map() });
        if (!shapes.get(shape).ops.has(o.key)) shapes.get(shape).ops.set(o.key, { o, pointers: new Set() });
        shapes.get(shape).ops.get(o.key).pointers.add(ptr);
      }
      for (const n of props) visit(o, s.properties[n], `${ptr}.${n}`);
    }
    visit(o, s.items, `${ptr}[]`);
    for (const k of COMPOSED) list(s[k]).forEach((x) => visit(o, x, ptr));
  };
  for (const o of an.ops) {
    for (const m of Object.values(obj(obj(o.op.requestBody).content))) visit(o, obj(m).schema, 'requestBody');
    for (const [status, r] of Object.entries(obj(o.op.responses)))
      for (const m of Object.values(obj(obj(r).content))) visit(o, obj(m).schema, `responses.${status}`);
  }
  const inline = [...shapes.entries()]
    .filter(([, v]) => v.ops.size >= 2)
    .sort(byKey)
    .map(([shape, v]) => {
      const found = [...v.ops.values()].sort((p, q) => cmp(p.o.label, q.o.label)),
        users = found.map((f) => f.o);
      return {
        properties: v.properties,
        shape,
        operations: labels(users),
        occurrences: found.map((f) => ({ operation: f.o.label, pointers: [...f.pointers].sort() })),
        outsideScope: outside(users),
      };
    });
  return { schemas, inline };
}

export function couplingMatrix(contract, scope) {
  const an = analyse(contract);
  return coupling(an, new Set(selectOperations(contract, scope, an.ops).map((o) => o.key)));
}

export function orphanSchemas(contract) {
  return analyse(contract).orphans;
}

// ---------------------------------------------------------------- inventory
// Terminal resource of a path: its last segment that is not a {parameter}; parent: the resource before the identifier before it.
function terminal(route) {
  const segs = route.split('/').filter(Boolean),
    isParam = (s) => /^\{.*\}$/.test(s);
  const i = segs.findLastIndex((s) => !isParam(s));
  return {
    name: i < 0 ? null : segs[i],
    parent: i >= 2 && isParam(segs[i - 1]) && !isParam(segs[i - 2]) ? segs[i - 2] : null,
  };
}

// Values documented for a property named code or errorCode in the 4xx/5xx responses: examples, schema enum and example.
function errorCodes(doc, responses) {
  const out = {};
  for (const [status, r] of Object.entries(obj(responses)).sort(byKey)) {
    if (!/^[45]/.test(status)) continue;
    const found = new Set(),
      seen = new Set();
    const keep = (v) => {
      if (v !== undefined && v !== null && scalar(v)) found.add(String(v));
    };
    const fromValue = (v) => {
      if (Array.isArray(v)) v.forEach(fromValue);
      else if (isObj(v))
        for (const [k, x] of Object.entries(v)) {
          if (CODES.has(k)) keep(x);
          fromValue(x);
        }
    };
    const fromSchema = (s) => {
      const ref = localRef(s);
      if (ref) {
        if (!seen.has(ref)) {
          seen.add(ref);
          fromSchema(at(doc, ref));
        }
        return;
      }
      if (!isObj(s)) return;
      fromValue(s.example);
      for (const [name, p] of Object.entries(obj(s.properties))) {
        const leaf = obj(follow(doc, p));
        if (CODES.has(name)) [...list(leaf.enum), leaf.example].forEach(keep);
        fromSchema(p);
      }
      [s.items, s.additionalProperties, ...COMPOSED.flatMap((k) => list(s[k]))].forEach(fromSchema);
    };
    for (const m of Object.values(obj(obj(r).content))) {
      fromValue(obj(m).example);
      for (const e of Object.values(obj(obj(m).examples))) fromValue(obj(e).value);
      fromSchema(obj(m).schema);
    }
    if (found.size) out[status] = [...found].sort();
  }
  return out;
}

// Content types of a request body or a response, each with its schema.
function media(node) {
  if (typeof node?.$ref === 'string') return [{ contentType: null, schema: refLabel(node.$ref) }];
  return Object.entries(obj(obj(node).content))
    .sort(byKey)
    .map(([contentType, m]) => ({ contentType, schema: describe(obj(m).schema) }));
}

function detail(doc, o, scoped) {
  const t = terminal(o.path),
    text = typeof o.op.description === 'string' ? o.op.description : null;
  return {
    ...brief(o),
    summary: firstLine(o.op.summary, 160),
    parameters: o.op.parameters.map((p) =>
      isObj(p) && typeof p.name === 'string'
        ? { name: p.name, in: p.in ?? null, type: typeOf(p.schema), required: p.required === true }
        : { ref: refLabel(String(p?.$ref)) },
    ),
    requestBody: media(o.op.requestBody),
    responses: Object.entries(obj(o.op.responses))
      .sort(byKey)
      .map(([status, r]) => ({ status, description: firstLine(obj(r).description, 80), content: media(r) })),
    terminalResource: t.name,
    subResourceOf:
      t.parent !== null && scoped.some((x) => x.key !== o.key && terminal(x.path).name === t.parent) ? t.parent : null,
    errorCodes: errorCodes(doc, o.op.responses),
    description:
      text === null || text.length <= 400 ? text : `${text.slice(0, 400)}… (truncated, ${text.length} chars)`,
  };
}

export function inventory(contract, scope) {
  const an = analyse(contract),
    entries = parseScope(scope);
  const scoped = selectOperations(contract, entries, an.ops),
    inScope = new Set(scoped.map((o) => o.key));
  return {
    title: contract?.info?.title ?? null,
    version: contract?.info?.version ?? null,
    scope: entries.length ? scopeText(entries) : null,
    total: an.ops.length,
    inScope: scoped.length,
    tags: tagsOf(contract, an.ops).map((tag) => ({
      tag,
      operations: an.ops.filter((o) => o.tags.includes(tag)).length,
    })),
    untagged: an.ops.filter((o) => !o.tags.length).length,
    operations: scoped.map((o) => detail(contract, o, scoped)),
    outOfScope: an.ops.filter((o) => !inScope.has(o.key)).map(brief),
    coupling: coupling(an, inScope),
    orphans: an.orphans,
  };
}

// ---------------------------------------------------------------- semantic diff
// Changed pointers between two JSON values: objects by key, arrays of scalars as sets, other arrays by index.
// With `deref`, local $refs are followed on both sides, so that a change inside a component schema shows where it lands;
// a pair of schemas is entered once per top-level key (parameters, requestBody, responses): the first place it lands.
function changes(a, b, deref) {
  const seen = new Set(),
    ref = (v) => (deref ? localRef(v) : null);
  const entry = (pointer, kind, o, n) => ({
    pointer,
    kind,
    ...(o !== undefined && scalar(o) ? { old: clip(o, 80) } : {}),
    ...(n !== undefined && scalar(n) ? { new: clip(n, 80) } : {}),
  });
  const walk = (x, y, ptr, out) => {
    const rx = ref(x),
      ry = ref(y);
    if (rx && ry) {
      if ((rx === ry && deref.clean(rx)) || seen.has(`${rx} ${ry}`)) return;
      seen.add(`${rx} ${ry}`);
      walk(at(deref.a, rx), at(deref.b, ry), ptr, out);
    } else if (rx || ry) walk(rx ? follow(deref.a, x) : x, ry ? follow(deref.b, y) : y, ptr, out);
    else if (isObj(x) && isObj(y)) {
      for (const k of [...new Set([...Object.keys(x), ...Object.keys(y)])].sort()) {
        if (ptr === '') seen.clear();
        let p = x[k],
          q = y[k];
        if (k === 'required' && (Array.isArray(p) || Array.isArray(q))) {
          p ??= [];
          q ??= [];
        } // no list = nothing required
        if (p === undefined) out.push(entry(`${ptr}/${esc(k)}`, 'added', undefined, q));
        else if (q === undefined) out.push(entry(`${ptr}/${esc(k)}`, 'removed', p));
        else walk(p, q, `${ptr}/${esc(k)}`, out);
      }
    } else if (Array.isArray(x) && Array.isArray(y)) {
      if (!(x.every(scalar) && y.every(scalar))) return walk({ ...x }, { ...y }, ptr, out);
      const only = (from, other, kind) =>
        [...new Set(from)]
          .filter((v) => !other.includes(v))
          .sort((p, q) => cmp(String(p), String(q)))
          .forEach((v) =>
            out.push(
              kind === 'added' ? entry(`${ptr}/${esc(v)}`, kind, undefined, v) : entry(`${ptr}/${esc(v)}`, kind, v),
            ),
          );
      only(x, y, 'removed');
      only(y, x, 'added');
    } else if (x !== y && (x !== undefined || y !== undefined)) out.push(entry(ptr, 'changed', x, y));
  };
  const out = [];
  walk(a, b, '', out);
  return out;
}

// The operation as compared: parameters keyed by "in:name", so that their order does not count.
// A renamed operationId is reported on its own and left out of the comparison.
function comparable(o, renamed) {
  const { operationId, ...rest } = o.op;
  return { ...(renamed ? rest : o.op), parameters: Object.fromEntries(o.op.parameters.map((p) => [paramKey(p), p])) };
}
const dig = (doc, node, segs) =>
  segs.reduce((n, k) => {
    n = follow(doc, n);
    return n !== null && typeof n === 'object' ? n[k] : undefined;
  }, node);

// Plain facts read from the dereferenced changes of one operation; the caller classifies them.
function factsOf(changed, a, b, baseDoc) {
  const out = new Map(),
    add = (fact, c) => out.set(`${fact} ${c.pointer}`, { fact, at: c.pointer });
  let docOnly = changed.length > 0;
  for (const c of changed) {
    const s = c.pointer.split('/').slice(1).map(unesc);
    if (s.some((k, i) => DOC.has(k) && s[i - 1] !== 'properties')) continue;
    docOnly = false;
    const zone = s[0],
      last = s.at(-1),
      prev = s.at(-2),
      keyword = s.at(-3) !== 'properties'; // prev is a schema keyword, not a property name
    if (zone === 'requestBody' && prev === 'required' && keyword && c.kind === 'added') {
      add(
        dig(baseDoc, a, [...s.slice(0, -2), 'properties', last]) !== undefined
          ? 'request field became required'
          : 'new required request field',
        c,
      );
    }
    if (zone === 'parameters' && s.length === 2 && c.kind === 'added' && obj(b.parameters[s[1]]).required === true)
      add('required parameter added', c);
    if (zone === 'parameters' && s.length === 3 && last === 'required' && c.new === true)
      add('parameter became required', c);
    if (zone === 'responses' && prev === 'properties' && c.kind === 'removed') add('response field removed', c);
    if ((last === 'type' && prev !== 'properties' && c.kind === 'changed') || (prev === 'type' && keyword))
      add('type changed', c);
    if (prev === 'enum' && keyword && c.kind === 'removed') add('enum value removed', c);
    if (prev === 'enum' && keyword && c.kind === 'added' && zone === 'responses') add('enum value added (response)', c);
    if (zone === 'responses' && s.length === 2 && c.kind === 'removed' && /^2/.test(last))
      add('2xx status code removed', c);
  }
  return [...out.values(), ...(docOnly ? [{ fact: 'description/summary/example only' }] : [])];
}

export function diffContracts(base, current, scope) {
  const A = analyse(base),
    B = analyse(current),
    entries = parseScope(scope);
  // Scope on both sides: strict on the current contract, as it was at the base. A scope gone stale blocks.
  const pick = (ops) => ops.filter((o) => !entries.length || entries.some((e) => matches(o, e)));
  const named = (ops) =>
    `${ops.map((o) => `${o.key} (${o.operationId ?? 'absent'})`).join(', ')}. Correct the scope, then run the diff again.`;
  for (const e of entries) {
    const carried = A.ops.filter((o) => matches(o, e));
    if (known(current, B.ops, e) || !carried.length) continue;
    const now = B.ops.find((o) => o.key === carried[0].key);
    const what =
      e.kind === 'tag'
        ? 'no longer exists in the current contract'
        : now
          ? `was renamed (operationId now: ${now.operationId ?? 'absent'})`
          : 'was removed';
    fail(`scope entry ${e.kind}:${e.value} ${what}. Operations that carried it at the base: ${named(carried)}`);
  }
  if (entries.length && !pick(B.ops).length && pick(A.ops).length && entries.every((e) => known(current, B.ops, e))) {
    fail(
      `the scope "${scopeText(entries)}" selects no operation of the current contract. Operations it selected at the base: ${named(pick(A.ops))}`,
    );
  }
  const inA = new Set(pick(A.ops).map((o) => o.key)),
    inB = new Set(selectOperations(current, entries, B.ops).map((o) => o.key));

  // Pair the operations: same METHOD path first, then same operationId elsewhere (moved).
  const byKeyB = new Map(B.ops.map((o) => [o.key, o]));
  const tracks = A.ops.map((o) => ({ base: o, cur: byKeyB.get(o.key) }));
  const keysA = new Set(A.ops.map((o) => o.key)),
    fresh = B.ops.filter((o) => !keysA.has(o.key));
  for (const t of tracks) {
    const i = t.cur || t.base.operationId === null ? -1 : fresh.findIndex((o) => o.operationId === t.base.operationId);
    if (i >= 0) [t.cur] = fresh.splice(i, 1);
  }
  tracks.push(...fresh.map((o) => ({ cur: o })));

  // Component schemas: added, removed, modified in their own text; dirty = reaches one of those.
  const names = [...new Set([...A.names, ...B.names])].sort(),
    has = (an, n) => Object.hasOwn(an.schemas, n);
  const modified = new Map(
    names
      .filter((n) => has(A, n) && has(B, n))
      .map((n) => [n, changes(A.schemas[n], B.schemas[n])])
      .filter(([, c]) => c.length),
  );
  const touched = new Set(names.filter((n) => !has(A, n) || !has(B, n) || modified.has(n)));
  const dirty = new Set(names.filter((n) => [...A.closure([n]), ...B.closure([n])].some((x) => touched.has(x))));
  const deref = { a: base, b: current, clean: (ref) => schemaName(ref) !== null && !dirty.has(schemaName(ref)) };

  const operations = { added: [], removed: [], renamed: [], moved: [], modified: [] };
  const sides = { both: [], entering: [], leaving: [], outside: [] };
  const hidden = { operations: 0, schemas: 0 };
  for (const t of tracks) {
    const a = t.base,
      b = t.cur,
      wasIn = !!a && inA.has(a.key),
      isIn = !!b && inB.has(b.key),
      shown = wasIn || isIn,
      found = [];
    if (wasIn && isIn) sides.both.push(brief(b));
    else if (isIn) sides.entering.push({ ...brief(b), because: a ? 'out of scope at the base' : 'absent at the base' });
    else if (wasIn) sides.leaving.push({ ...brief(a), because: b ? 'out of scope now' : 'absent now' });
    else sides.outside.push(brief(b ?? a));
    if (!a) found.push(['added', brief(b)]);
    else if (!b) found.push(['removed', brief(a)]);
    else {
      const renamed = a.operationId !== null && b.operationId !== null && a.operationId !== b.operationId;
      if (renamed) found.push(['renamed', { method: b.method, path: b.path, from: a.operationId, to: b.operationId }]);
      if (a.key !== b.key) found.push(['moved', { operationId: b.operationId, from: a.key, to: b.key }]);
      const x = comparable(a, renamed),
        y = comparable(b, renamed),
        own = changes(x, y);
      const schemas = [...modified.keys()].filter((n) => a.uses.has(n) || b.uses.has(n));
      if (own.length || schemas.length)
        found.push([
          'modified',
          { ...brief(b), facts: shown ? factsOf(changes(x, y, deref), x, y, base) : [], schemas, changes: own },
        ]);
    }
    if (shown) for (const [kind, item] of found) operations[kind].push(item);
    else if (found.length) hidden.operations++;
  }

  // Each changed schema with its users on both sides; shown when an operation of the scope uses it.
  const schemas = { added: [], removed: [], modified: [] };
  for (const n of touched) {
    const ua = A.users.get(n) ?? [],
      ub = B.users.get(n) ?? [];
    const inside = ua.some((o) => inA.has(o.key)) || ub.some((o) => inB.has(o.key)),
      outside = ua.some((o) => !inA.has(o.key)) || ub.some((o) => !inB.has(o.key));
    const item = {
      schema: n,
      operations: { base: labels(ua), current: labels(ub) },
      outsideScope: inside && outside,
      ...(modified.has(n) ? { changes: modified.get(n) } : {}),
    };
    if (entries.length && !inside) hidden.schemas++;
    else schemas[!has(A, n) ? 'added' : !has(B, n) ? 'removed' : 'modified'].push(item);
  }
  // What the sections above do not read: info, servers, security, tags, and the components that are not schemas.
  const rest = ({ paths, components, ...other }) => {
    const { schemas: _, ...shared } = obj(components);
    return { ...other, components: shared };
  };
  return {
    identical: canon(base) === canon(current),
    versions: { base: base?.info?.version ?? null, current: current?.info?.version ?? null },
    scope: entries.length ? { text: scopeText(entries), ...sides } : null,
    operations,
    schemas,
    elsewhere: changes(rest(base), rest(current)),
    orphans: {
      became: B.orphans.filter((n) => has(A, n) && !A.orphans.includes(n)),
      stopped: A.orphans.filter((n) => has(B, n) && !B.orphans.includes(n)),
    },
    outOfScopeChanges: hidden,
  };
}

// ---------------------------------------------------------------- git
function git(cwd, ...args) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28 });
  } catch {
    return null;
  }
}

function provenance(file) {
  const dir = path.dirname(path.resolve(file)),
    name = path.basename(file);
  if (git(dir, 'rev-parse', '--is-inside-work-tree')?.trim() !== 'true')
    return { sha: null, uncommittedChanges: null, label: 'no git history' };
  const sha = git(dir, 'log', '-1', '--format=%H', '--', name)?.trim() || null;
  const dirty = (git(dir, 'status', '--porcelain', '--', name) ?? '').trim() !== '';
  return {
    sha,
    uncommittedChanges: dirty,
    label: sha === null ? 'uncommitted' : dirty ? `uncommitted (last commit ${sha})` : sha,
  };
}

// The contract as it was at the base ref; every failure is blocking and says how to recover.
function readBase(file, ref, basePath) {
  const dir = path.dirname(path.resolve(file)),
    name = path.basename(file);
  if (git(dir, 'rev-parse', '--is-inside-work-tree')?.trim() !== 'true')
    fail(`${file} is not in a git repository: there is no base to compare with.`);
  if (ref.startsWith('-') || git(dir, 'cat-file', '-e', `${ref}^{commit}`) === null)
    fail(
      `base ${ref} does not exist in this repository. Pass an explicit base (--base <sha, tag or branch>); no other ref is used instead.`,
    );
  const sha = git(dir, 'rev-parse', `${ref}^{commit}`).trim();
  const rel = basePath ?? `${git(dir, 'rev-parse', '--show-prefix').trim()}${name}`;
  const text = git(dir, 'show', `${sha}:${rel}`);
  if (text === null) {
    const log = (git(dir, 'log', '--follow', '--name-only', '--format=%h', '--', name) ?? '')
      .split('\n')
      .filter((l) => l.trim())
      .join('\n  ');
    fail(
      `${rel} does not exist at ${ref}: the contract was moved or renamed since, or did not exist yet. Its history (commit, then path):\n  ${log || '(no commit touches this file)'}\nPass its path at the base with --base-path <path from the repository root>.`,
    );
  }
  return { ref, sha, path: rel, contract: parse(text, `${ref}:${rel}`) };
}

// ---------------------------------------------------------------- output
const absent = (v) => v ?? 'absent';
const opLine = (o) => `${o.method} ${o.path} - ${absent(o.operationId)} [${o.tags.join(', ') || 'no tag'}]`;
const mediaText = (m) => m.map((x) => (x.contentType ? `${x.contentType}: ${x.schema}` : x.schema)).join('; ');
const csv = (items) => items.join(', ') || 'none';

function renderInventory(r) {
  const L = [
    `# ${absent(r.title)} - version ${absent(r.version)}`,
    '',
    `Operations: ${r.inScope} in scope / ${r.total} in the contract`,
    `Scope: ${r.scope ?? 'whole contract'}`,
    `Tags: ${csv(r.tags.map((t) => `${t.tag} (${t.operations})`))}${r.untagged ? `; without tag (${r.untagged})` : ''}`,
    '',
    '## Operations in scope',
  ];
  for (const o of r.operations) {
    L.push(
      '',
      `### ${o.method} ${o.path}`,
      `- operationId: ${absent(o.operationId)}`,
      `- tags: ${csv(o.tags)}`,
      `- summary: ${absent(o.summary)}`,
      `- parameters: ${o.parameters.map((p) => (p.ref ? p.ref : `${p.name} (${absent(p.in)}, ${p.type}, ${p.required ? 'required' : 'optional'})`)).join('; ') || 'none'}`,
      `- request body: ${mediaText(o.requestBody) || 'none'}`,
      '- responses:',
      ...o.responses.map((x) => `  - ${x.status} ${absent(x.description)} - ${mediaText(x.content) || 'no content'}`),
      `- terminal resource: ${absent(o.terminalResource)}${o.subResourceOf ? ` (sub-resource of ${o.subResourceOf})` : ''}`,
      `- business error codes: ${
        Object.entries(o.errorCodes)
          .map(([status, codes]) => `HTTP ${status}: ${codes.join(', ')}`)
          .join('; ') || 'none documented'
      }`,
      `- description: ${absent(o.description).replace(/\r?\n/g, '\n  ')}`,
    );
  }
  L.push(
    '',
    '## Operations out of scope',
    '',
    ...(r.outOfScope.length ? r.outOfScope.map((o) => `- ${opLine(o)}`) : ['none']),
  );
  const all = (s) => (r.total > 1 && s.operations.length === r.total ? `all ${r.total} operations` : null),
    mark = (s) => (s.outsideScope ? 'coupling outside the scope' : '');
  L.push(
    '',
    '## Coupling matrix',
    '',
    '| Schema | Operations using it, directly or through another schema | |',
    '| --- | --- | --- |',
    ...r.coupling.schemas
      .filter((s) => s.operations.length)
      .map((s) => `| ${s.schema} | ${all(s) ?? s.operations.join(', ')} | ${mark(s)} |`),
  );
  const places = (s) =>
    all(s)
      ? `${all(s)}: ${[...new Set(s.occurrences.flatMap((x) => x.pointers))].sort().join(', ')}`
      : s.occurrences.map((x) => `${x.operation}: ${x.pointers.join(', ')}`).join('; ');
  L.push(
    '',
    '## Inline duplicated structures',
    '',
    ...(r.coupling.inline.length
      ? r.coupling.inline.map((s) => `- {${s.shape}} - ${places(s)}${mark(s) && ` - ${mark(s)}`}`)
      : ['none']),
  );
  L.push('', '## Orphan schemas', '', csv(r.orphans));
  return L.join('\n');
}

// One changed pointer; at most 30 are printed per block, --json has them all.
function pointerLines(items, indent = '  ') {
  const text = (c) => {
    const leaf = unesc(c.pointer.split('/').at(-1)),
      show = (v) => JSON.stringify(v);
    if (c.kind !== 'changed' && String(c.old ?? c.new) === leaf) return `${c.kind} ${c.pointer}`;
    const values = [...('old' in c ? [show(c.old)] : []), ...('new' in c ? [show(c.new)] : [])].join(' → ');
    return `${c.kind} ${c.pointer}${values ? `: ${values}` : ''}`;
  };
  return [
    ...items.slice(0, 30).map((c) => `${indent}- ${text(c)}`),
    ...(items.length > 30 ? [`${indent}- … ${items.length - 30} more (use --json)`] : []),
  ];
}

function renderDiff(r) {
  const L = [
    `# Contract diff - ${r.contract}`,
    '',
    `Base: ${r.base.ref} (${r.base.sha})`,
    `Version: ${absent(r.versions.base)} → ${absent(r.versions.current)}`,
    `Current provenance: ${r.provenance.label}`,
    ...(r.scope ? [`Scope: ${r.scope.text}`] : []),
  ];
  const section = (title, items, lines) => L.push('', `## ${title} (${items.length})`, ...items.flatMap(lines));
  section('Operations added', r.operations.added, (o) => [`- ${opLine(o)}`]);
  section('Operations removed', r.operations.removed, (o) => [`- ${opLine(o)}`]);
  section('operationId renamed', r.operations.renamed, (o) => [`- ${o.method} ${o.path}: ${o.from} → ${o.to}`]);
  section('Operations moved', r.operations.moved, (o) => [`- ${absent(o.operationId)}: ${o.from} → ${o.to}`]);
  section('Operations modified', r.operations.modified, (o) => [
    `- ${opLine(o)}`,
    ...(o.facts.length
      ? [
          '  - facts:',
          ...o.facts.slice(0, 30).map((f) => `    - ${f.fact}${f.at ? `: ${f.at}` : ''}`),
          ...(o.facts.length > 30 ? [`    - … ${o.facts.length - 30} more (use --json)`] : []),
        ]
      : []),
    ...(o.schemas.length ? [`  - changed component schemas it depends on: ${o.schemas.join(', ')}`] : []),
    ...(o.changes.length ? ['  - changed pointers:', ...pointerLines(o.changes, '    ')] : []),
  ]);
  for (const kind of ['added', 'removed', 'modified']) {
    section(`Schemas ${kind}`, r.schemas[kind], (s) => [
      `- ${s.schema} - used at the base by: ${csv(s.operations.base)}; now by: ${csv(s.operations.current)}${s.outsideScope ? ' - coupling outside the scope' : ''}`,
      ...pointerLines(s.changes ?? []),
    ]);
  }
  L.push(
    '',
    '## Orphans',
    `- became orphan: ${csv(r.orphans.became)}`,
    `- stopped being orphan: ${csv(r.orphans.stopped)}`,
  );
  L.push('', `## Changes elsewhere in the contract (${r.elsewhere.length})`, ...pointerLines(r.elsewhere, ''));
  if (r.scope) {
    const names = (items) => csv(items.map((o) => `${o.method} ${o.path}${o.because ? ` (${o.because})` : ''}`));
    L.push(
      '',
      '## Scope',
      `- in scope on both sides (${r.scope.both.length}): ${names(r.scope.both)}`,
      `- entering (${r.scope.entering.length}): ${names(r.scope.entering)}`,
      `- leaving (${r.scope.leaving.length}): ${names(r.scope.leaving)}`,
      `- out of scope on both sides (${r.scope.outside.length}): ${names(r.scope.outside)}`,
      `- changes out of scope, not detailed: ${r.outOfScopeChanges.operations} operations, ${r.outOfScopeChanges.schemas} schemas`,
    );
  }
  return L.join('\n');
}

// ---------------------------------------------------------------- command line
function parse(text, name) {
  let doc;
  try {
    doc = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch {
    fail(`${name} is not JSON. Convert a YAML contract to JSON first; this script reads JSON only.`, 2);
  }
  if (!isObj(doc)) fail(`${name} does not hold a JSON object; an OpenAPI 3 document is expected.`, 2);
  return doc;
}

function load(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (e) {
    fail(`cannot read ${file} (${e.code ?? e.message}).`, 2);
  }
  return parse(text, file);
}

function main(argv) {
  const [command, ...rest] = argv,
    opt = {},
    files = [];
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(USAGE);
    return 0;
  }
  try {
    for (let i = 0; i < rest.length; i++) {
      if (rest[i] === '--json') opt.json = true;
      else if (['--scope', '--base', '--base-path'].includes(rest[i]) && i + 1 < rest.length)
        opt[rest[i].slice(2)] = rest[++i];
      else if (rest[i].startsWith('--')) fail(`unknown or incomplete option ${rest[i]}\n${USAGE}`, 2);
      else files.push(rest[i]);
    }
    if (
      !['provenance', 'inventory', 'diff'].includes(command) ||
      files.length !== 1 ||
      (command === 'diff' && !opt.base)
    )
      fail(USAGE, 2);
    const [file] = files,
      contract = load(file);
    const print = (data, text) => console.log(opt.json ? JSON.stringify(data, null, 2) : text);
    if (command === 'provenance') {
      const p = provenance(file),
        data = { contract: file, version: contract.info?.version ?? null, ...p };
      print(
        data,
        [
          `Contract: ${file}`,
          `Version: ${absent(data.version)}`,
          `Provenance: ${p.label}`,
          `Uncommitted changes: ${p.uncommittedChanges === null ? 'unknown (no git history)' : p.uncommittedChanges ? 'yes' : 'no'}`,
        ].join('\n'),
      );
    } else if (command === 'inventory') {
      const r = inventory(contract, opt.scope);
      print(r, renderInventory(r));
    } else {
      const { contract: before, ...base } = readBase(file, opt.base, opt['base-path']),
        p = provenance(file);
      const r = { contract: file, base, provenance: p, ...diffContracts(before, contract, opt.scope) };
      print(r, r.identical && !p.uncommittedChanges ? `Nothing changed since ${opt.base}.` : renderDiff(r));
    }
    return 0;
  } catch (e) {
    console.error(`contract: ${e.message}`);
    return e.exitCode ?? 2;
  }
}

// Run as a command, not when imported. Node resolves links for import.meta.url, not for argv[1].
const isMain = () => {
  try {
    return fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
};

// exitCode rather than exit(): a long report written to a pipe is flushed before the process ends.
if (process.argv[1] && isMain()) process.exitCode = main(process.argv.slice(2));
