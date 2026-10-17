#!/usr/bin/env node

// Partition - the C4 model as text, drawn for draw.io. Node >= 22, no dependency.
//
//   node c4-drawio.mjs [--model docs/architecture/model.yml] [--out docs/architecture/c4.drawio]
//   node c4-drawio.mjs --check [--model FILE]            validate only, write nothing
//   node c4-drawio.mjs --mermaid VIEW [--model FILE]     print a dynamic view as a Mermaid sequenceDiagram
//
// model.yml is the source of truth; the .drawio file is generated, one page per view.
// Regenerating keeps what a person did in draw.io: the position and size of every box, the
// route and style of every edge, and every cell or page the model does not know about; but of two
// kept boxes that overlap, the later in the model's order is placed again. What the generator
// placed and no person changed is placed again from the model: a mark in its style tells them apart.

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import zlib from 'node:zlib';

// ---------------------------------------------------------------- YAML subset
// Block maps, block lists, one-line flow lists of scalars, quoted and plain scalars,
// comments. Anything else fails with its line number. Keep this block identical in
// budget.mjs and c4-drawio.mjs (tests/c4.test.mjs checks it).
// <yaml-subset>
export function parseYaml(text, file = 'yaml') {
  const fail = (n, msg) => {
    throw new Error(`${file}:${n}: ${msg}`);
  };
  const stripComment = (s) => {
    let q = null;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (q) {
        if (c === q && s[i - 1] !== '\\') q = null;
        continue;
      }
      if (c === '"' || c === "'") {
        q = c;
        continue;
      }
      if (c === '#' && (i === 0 || /\s/.test(s[i - 1]))) return s.slice(0, i);
    }
    return s;
  };
  const lines = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    if (/^ *\t/.test(raw)) fail(i + 1, 'tab in indentation; use spaces');
    const s = stripComment(raw).replace(/\s+$/, '');
    if (s.trim() === '') return;
    if (s.trim() === '---') {
      if (lines.length) fail(i + 1, 'several documents are not supported');
      return;
    }
    lines.push({ n: i + 1, indent: s.length - s.trimStart().length, text: s.trim() });
  });
  const keyEnd = (s) => {
    let q = null;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (q) {
        if (c === q) q = null;
        continue;
      }
      if ((c === '"' || c === "'") && i === 0) {
        q = c;
        continue;
      }
      if (c === ':' && (i === s.length - 1 || s[i + 1] === ' ')) return i;
    }
    return -1;
  };
  const unquote = (s, n) => {
    if (s.startsWith('"')) {
      if (!s.endsWith('"') || s.length < 2) fail(n, 'unterminated double-quoted string');
      return s.slice(1, -1).replace(/\\(["\\nt])/g, (_, c) => ({ n: '\n', t: '\t' })[c] ?? c);
    }
    if (s.startsWith("'")) {
      if (!s.endsWith("'") || s.length < 2) fail(n, 'unterminated single-quoted string');
      return s.slice(1, -1).replace(/''/g, "'");
    }
    return null;
  };
  const scalar = (s, n) => {
    const quoted = unquote(s, n);
    if (quoted !== null) return quoted;
    if (s.startsWith('{')) fail(n, 'flow maps { } are not supported; use block style');
    if (/^[|>][+-]?$/.test(s)) fail(n, 'block scalars (| and >) are not supported; keep the value on one line');
    if (/^[&*!]/.test(s))
      fail(n, `"${s}" starts with &, * or !; put it in quotes (anchors, aliases and tags are not supported)`);
    if (s.startsWith('[')) {
      if (!s.endsWith(']')) fail(n, 'a flow list must close on the same line');
      const inner = s.slice(1, -1).trim();
      if (inner === '') return [];
      const items = [];
      let cur = '';
      let q = null;
      for (const c of inner) {
        if (q) {
          cur += c;
          if (c === q) q = null;
          continue;
        }
        if (c === '"' || c === "'") {
          q = c;
          cur += c;
          continue;
        }
        if (c === '[' || c === '{') fail(n, 'nested flow collections are not supported');
        if (c === ',') {
          items.push(cur.trim());
          cur = '';
          continue;
        }
        cur += c;
      }
      items.push(cur.trim());
      return items.map((it) => scalar(it, n));
    }
    if (s.includes(': ')) fail(n, `"${s}" holds ": "; put the value in quotes`);
    if (s === 'true') return true;
    if (s === 'false') return false;
    if (s === 'null' || s === '~') return null;
    if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
    return s;
  };
  const isItem = (l) => l.text === '-' || l.text.startsWith('- ');
  let pos = 0;
  const parseBlock = (indent) => (isItem(lines[pos]) ? parseList(indent) : parseMap(indent));
  function parseMap(indent) {
    const obj = {};
    while (pos < lines.length && lines[pos].indent === indent && !isItem(lines[pos])) {
      const line = lines[pos];
      const k = keyEnd(line.text);
      if (k < 0) fail(line.n, `expected "key: value", got "${line.text}"`);
      const rawKey = line.text.slice(0, k).trim();
      const key = unquote(rawKey, line.n) ?? rawKey;
      if (Object.hasOwn(obj, key)) fail(line.n, `duplicate key "${key}"`);
      const rest = line.text.slice(k + 1).trim();
      pos++;
      if (rest !== '') {
        obj[key] = scalar(rest, line.n);
        continue;
      }
      const next = lines[pos];
      if (next && next.indent > indent) obj[key] = parseBlock(next.indent);
      else if (next && next.indent === indent && isItem(next)) obj[key] = parseList(indent);
      else obj[key] = null;
    }
    if (pos < lines.length && lines[pos].indent > indent) fail(lines[pos].n, 'unexpected indentation');
    return obj;
  }
  function parseList(indent) {
    const arr = [];
    while (pos < lines.length && lines[pos].indent === indent && isItem(lines[pos])) {
      const line = lines[pos];
      const rest = line.text === '-' ? '' : line.text.slice(1).trimStart();
      if (rest === '') {
        pos++;
        const next = lines[pos];
        arr.push(next && next.indent > indent ? parseBlock(next.indent) : null);
      } else if (!/^["'\[]/.test(rest) && keyEnd(rest) >= 0) {
        const inner = indent + (line.text.length - rest.length);
        lines[pos] = { n: line.n, indent: inner, text: rest };
        arr.push(parseMap(inner));
      } else {
        arr.push(scalar(rest, line.n));
        pos++;
      }
    }
    if (pos < lines.length && lines[pos].indent > indent) fail(lines[pos].n, 'unexpected indentation');
    return arr;
  }
  if (lines.length === 0) return {};
  const root = parseBlock(lines[0].indent);
  if (pos < lines.length) fail(lines[pos].n, 'unexpected indentation');
  return root;
}
// </yaml-subset>

// ---------------------------------------------------------------- model
const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/; // no "--": it separates the parts of a cell id
const PARENT = { person: null, system: null, container: 'system', component: 'container' };
const VIEW_OF = { context: 'system', containers: 'system', components: 'container' };
const PALETTE = {
  // name: [fill, stroke]
  red: ['#f8cecc', '#b85450'],
  green: ['#d5e8d4', '#82b366'],
  orange: ['#ffe6cc', '#d79b00'],
  purple: ['#e1d5e7', '#9673a6'],
  blue: ['#dae8fc', '#6c8ebf'],
  grey: ['#f5f5f5', '#666666'],
  yellow: ['#e3c800', '#B09500'],
  amber: ['#f0a30a', '#BD7000'],
  white: ['#ffffff', '#b85450'],
};
const DEFAULT_COLOR = { person: 'orange', system: 'red', container: 'purple', component: 'white' };
const colorOf = (e) => PALETTE[e.color || (e.external ? 'grey' : DEFAULT_COLOR[e.kind])];

// "a -> b: text" reaches us as the map { 'a -> b': 'text' }, as the plain string 'a -> b',
// or with a flow list as value when the text is only "[protocol]".
function arrow(item) {
  let key = item,
    val = '';
  if (item && typeof item === 'object' && !Array.isArray(item) && Object.keys(item).length === 1)
    [[key, val]] = Object.entries(item);
  else if (typeof item === 'string' && item.includes(': '))
    [key, val] = [item.slice(0, item.indexOf(': ')), item.slice(item.indexOf(': ') + 2)];
  const m = typeof key === 'string' && /^(\S+)\s+(-->|->)\s+(\S+)$/.exec(key.trim());
  if (!m) return null;
  return {
    from: m[1],
    to: m[3],
    ret: m[2] === '-->',
    text: (Array.isArray(val) ? `[${val.join(', ')}]` : String(val ?? '')).trim(),
  };
}

// Parses and normalises: every field is a string, relations and steps are objects.
// What has the wrong shape is noted in "problems", which validate() reports.
export function loadModel(text, file = 'model.yml') {
  const doc = parseYaml(String(text).replace(/^\u{FEFF}/u, ''), file),
    problems = [];
  const str = (v) => (v == null ? '' : String(v)),
    list = (v) => (Array.isArray(v) ? v : []);
  const elements = list(doc.elements).map((e) => ({
    id: str(e?.id),
    kind: str(e?.kind),
    in: str(e?.in),
    name: str(e?.name) || str(e?.id),
    technology: str(e?.technology),
    description: str(e?.description),
    color: str(e?.color),
    context: str(e?.context),
    external: e?.external === true,
  }));
  const relations = [];
  list(doc.relations).forEach((item, i) => {
    const a = arrow(item);
    if (!a || a.ret) return problems.push(`relation ${i + 1}: expected "from -> to: label [protocol]"`);
    const [, label, protocol = ''] = /^(.*?)\s*(?:\[([^\]]*)\])?$/.exec(a.text);
    relations.push({ n: i + 1, from: a.from, to: a.to, label, protocol });
  });
  const views = list(doc.views).map((v) => {
    const id = str(v?.id),
      steps = [];
    list(v?.steps).forEach((item, i) => {
      const a = arrow(item);
      if (a) steps.push({ n: i + 1, from: a.from, to: a.to, ret: a.ret, label: a.text });
      else problems.push(`view "${id}": step ${i + 1}: expected "from -> to: label" or "from --> to: label"`);
    });
    const participants = v?.participants == null ? null : [...new Set([].concat(v.participants).map(str))];
    return { id, kind: str(v?.kind), of: str(v?.of), title: str(v?.title) || id, participants, steps };
  });
  const byId = new Map();
  for (const e of elements) if (!byId.has(e.id)) byId.set(e.id, e);
  return { title: str(doc.title), elements, relations, views, byId, problems };
}

// Returns every error of the model, as sentences that name the view or relation and the id.
export function validate(model) {
  const { byId } = model,
    errs = [...model.problems],
    unknown = (id) => `"${id}", which is not an element of the model`;
  const seen = new Set();
  for (const e of model.elements) {
    const who = `element "${e.id}"`;
    if (!ID.test(e.id)) errs.push(`${who}: an id is made of lowercase letters, digits and single hyphens`);
    if (seen.has(e.id)) errs.push(`${who} is declared twice; ids are unique`);
    seen.add(e.id);
    if (e.color && !Object.hasOwn(PALETTE, e.color))
      errs.push(`${who}: color "${e.color}" is unknown; use ${Object.keys(PALETTE).join(', ')}`);
    if (!Object.hasOwn(PARENT, e.kind)) {
      errs.push(`${who}: kind "${e.kind}" is unknown; use person, system, container or component`);
      continue;
    }
    const need = PARENT[e.kind],
      parent = byId.get(e.in);
    if (!need) {
      if (e.in) errs.push(`${who}: a ${e.kind} has no "in"`);
    } else if (!e.in) errs.push(`${who}: a ${e.kind} needs "in", the id of its ${need}`);
    else if (!parent) errs.push(`${who}: "in" refers to ${unknown(e.in)}`);
    else if (parent.kind !== need)
      errs.push(`${who}: a ${e.kind} lives in a ${need}, but "${e.in}" is a ${parent.kind}`);
  }
  for (const r of model.relations) {
    for (const end of new Set([r.from, r.to]))
      if (!byId.has(end)) errs.push(`relation ${r.n} (${r.from} -> ${r.to}) uses ${unknown(end)}`);
  }
  if (!model.views.length) errs.push('the model has no view; a draw.io file needs at least one page');
  const views = new Set();
  for (const v of model.views) {
    const who = `view "${v.id}"`,
      of = byId.get(v.of);
    if (!ID.test(v.id)) errs.push(`${who}: an id is made of lowercase letters, digits and single hyphens`);
    if (views.has(v.id)) errs.push(`${who} is declared twice; ids are unique`);
    views.add(v.id);
    if (v.kind === 'dynamic') {
      if (!v.steps.length) errs.push(`${who}: a dynamic view needs at least one step`);
      for (const p of v.participants ?? []) if (!byId.has(p)) errs.push(`${who}: participants lists ${unknown(p)}`);
      for (const s of v.steps) {
        for (const end of new Set([s.from, s.to])) {
          if (!byId.has(end)) errs.push(`${who}: step ${s.n} uses ${unknown(end)}`);
          else if (v.participants && !v.participants.includes(end))
            errs.push(`${who}: step ${s.n} uses "${end}", which is not listed in participants`);
        }
      }
    } else if (!Object.hasOwn(VIEW_OF, v.kind))
      errs.push(`${who}: kind "${v.kind}" is unknown; use context, containers, components or dynamic`);
    else if (!of) errs.push(`${who}: "of" refers to ${unknown(v.of)}`);
    else if (of.kind !== VIEW_OF[v.kind])
      errs.push(`${who}: a ${v.kind} view needs a ${VIEW_OF[v.kind]}, but "${v.of}" is a ${of.kind}`);
  }
  return errs;
}

// Nothing is drawn from a model that has errors.
function checked(model) {
  const errs = validate(model);
  if (errs.length) throw new Error(`the model has errors:\n${errs.join('\n')}`);
}

const participantsOf = (view) => view.participants ?? [...new Set(view.steps.flatMap((s) => [s.from, s.to]))];

// ---------------------------------------------------------------- static views
// What a context, containers or components view shows: the children of "of" (the system
// itself in a context view), the outside elements related to them, and the relations
// lifted to the elements that are shown (C4 implied relationships).
function resolveStatic(model, view) {
  const { byId } = model,
    ctx = view.kind === 'context';
  const chain = (id) => {
    const up = [];
    for (let e = byId.get(id); e; e = byId.get(e.in)) up.push(e.id);
    return up;
  };
  const lineage = chain(view.of); // "of" and its ancestors are never drawn as a box of their own
  const lift = (id) => {
    const up = chain(id),
      at = up.indexOf(view.of);
    if (at >= 0) return { id: ctx ? view.of : up[at - 1], inside: ctx || at > 0 };
    return { id: up.filter((x) => !lineage.includes(x)).pop(), inside: false };
  };
  const relations = [],
    merged = new Map(),
    pairs = new Map();
  for (const r of model.relations) {
    const a = lift(r.from),
      b = lift(r.to);
    if (!a.id || !b.id || a.id === b.id || !(a.inside || b.inside)) continue;
    const key = [a.id, b.id, r.label].join('\n'),
      same = merged.get(key);
    if (same) {
      if (r.protocol && !same.protocols.includes(r.protocol)) same.protocols.push(r.protocol);
      continue;
    }
    const pair = `${a.id}--${b.id}`,
      n = (pairs.get(pair) ?? 0) + 1;
    pairs.set(pair, n);
    const lifted = { from: a.id, to: b.id, label: r.label, protocols: r.protocol ? [r.protocol] : [], n };
    merged.set(key, lifted);
    relations.push(lifted);
  }
  const ends = new Set(relations.flatMap((r) => [r.from, r.to])),
    receives = new Set(relations.map((r) => r.to));
  const inside = model.elements.filter((e) => (ctx ? e.id === view.of : e.in === view.of));
  const outside = model.elements.filter((e) => ends.has(e.id) && !inside.includes(e));
  return {
    of: byId.get(view.of),
    boundary: !ctx,
    inside,
    relations,
    above: outside.filter((e) => !receives.has(e.id)),
    below: outside.filter((e) => receives.has(e.id)),
  };
}

// First draft of a static page: the inside elements in rows by rank, the elements that only
// call in on a row above, the others on a row below. Every row is centred on the same axis.
// A box the old file has keeps its place; a new one takes the nearest free slot of its row, away
// from every kept box. The boundary frames its children, and a kept boundary only grows to hold them.
const BOX = { w: 270, h: 140 },
  PITCH = { x: BOX.w + 90, y: BOX.h + 110 },
  AXIS = 855;
const hits = (a, b, gap = 0) =>
  a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;
function layout(shown, keptBox = () => null, keptBoundary = null) {
  const kids = shown.inside.map((e) => e.id),
    inner = shown.relations.filter((r) => kids.includes(r.from) && kids.includes(r.to));
  // Longest-path ranks. A relation that closes a cycle (met in declaration order) is ignored.
  const state = new Map(),
    back = new Set(),
    ranks = new Map();
  const visit = (u) => {
    state.set(u, 'open');
    for (const r of inner)
      if (r.from === u) {
        if (state.get(r.to) === 'open') back.add(r);
        else if (!state.has(r.to)) visit(r.to);
      }
    state.set(u, 'done');
  };
  for (const k of kids) if (!state.has(k)) visit(k);
  const rank = (v) => {
    if (!ranks.has(v))
      ranks.set(v, 1 + Math.max(-1, ...inner.filter((r) => r.to === v && !back.has(r)).map((r) => rank(r.from))));
    return ranks.get(v);
  };
  const rows = [];
  for (const k of kids) (rows[rank(k)] ??= []).push(k);

  const at = new Map(),
    width = (n) => n * PITCH.x - 90;
  const row = (ids, y) =>
    ids.forEach((id, i) => at.set(id, { x: AXIS - width(ids.length) / 2 + i * PITCH.x, y, ...BOX }));
  const pad = shown.boundary ? 40 : 0,
    foot = shown.boundary ? 70 : 0; // the title of the boundary sits at its foot
  const top = 40 + PITCH.y + pad,
    widest = Math.max(1, ...rows.map((r) => r.length)),
    height = Math.max(1, rows.length) * PITCH.y - 110;
  row(
    shown.above.map((e) => e.id),
    40,
  );
  rows.forEach((ids, i) => row(ids, top + i * PITCH.y));
  row(
    shown.below.map((e) => e.id),
    top + height + foot + 110,
  );

  // The kept boxes first; then each new box, in the order of the draft, takes the free slot of its
  // row nearest its draft place: one pitch to the right, then to the left, and so on.
  const outside = [...shown.above, ...shown.below].map((e) => e.id),
    all = [...kids, ...outside],
    taken = [];
  for (const id of all) {
    const k = keptBox(id);
    if (k) {
      at.set(id, k);
      taken.push(k);
    }
  }
  const slot = (draft, fits, reach = Infinity) => {
    for (let step = 0; step <= reach; step++) {
      const shift = (step % 2 ? 1 : -1) * Math.ceil(step / 2) * PITCH.x,
        r = { ...draft, x: draft.x + shift };
      if (!taken.some((t) => hits(r, t, 20)) && fits(r)) return r;
    }
    return null;
  };
  const put = (id, r) => {
    at.set(id, r);
    taken.push(r);
  };
  const frame = (rs) => {
    const x = Math.min(...rs.map((r) => r.x)),
      y = Math.min(...rs.map((r) => r.y));
    return {
      x: x - pad,
      y: y - pad,
      w: Math.max(...rs.map((r) => r.x + r.w)) - x + 2 * pad,
      h: Math.max(...rs.map((r) => r.y + r.h)) - y + pad + foot,
    };
  };
  const grow = (a, b) => {
    const x = Math.min(a.x, b.x),
      y = Math.min(a.y, b.y);
    return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
  };
  const enclosing = (rs) => (keptBoundary ? grow(keptBoundary, frame(rs)) : frame(rs));

  // A new child must not make the boundary grow over a kept outside box. It takes the nearest slot
  // that keeps the boundary clear of them: in its draft row, else in the row of a kept child nearest
  // its draft, where the boundary only widens. With no such slot within reach, the nearest free slot
  // of its draft row.
  const keptOut = outside.map(keptBox).filter(Boolean),
    placed = kids.map(keptBox).filter(Boolean),
    reach = 2 * all.length + 2;
  const clear = (r) => !shown.boundary || !keptOut.some((o) => hits(enclosing([...placed, r]), o));
  for (const id of kids) {
    if (keptBox(id)) continue;
    const draft = at.get(id),
      ys = [draft.y, ...new Set(placed.map((r) => r.y).sort((a, b) => Math.abs(a - draft.y) - Math.abs(b - draft.y)))];
    const r = ys.reduce((found, y) => found ?? slot({ ...draft, y }, clear, reach), null) ?? slot(draft, () => true);
    put(id, r);
    placed.push(r);
  }
  const empty = { x: AXIS - width(widest) / 2 - pad, y: top - pad, w: width(widest) + 2 * pad, h: height + pad + foot },
    boundary = kids.length ? enclosing(kids.map((id) => at.get(id))) : keptBoundary ? grow(keptBoundary, empty) : empty;
  // An outside box keeps 110px off the boundary: above it or below it, as in the draft.
  for (const [list, side] of [
    [shown.above, -1],
    [shown.below, 1],
  ])
    for (const e of list) {
      if (keptBox(e.id)) continue;
      const draft = at.get(e.id),
        y = side < 0 ? Math.min(draft.y, boundary.y - 110 - BOX.h) : Math.max(draft.y, boundary.y + boundary.h + 110);
      put(
        e.id,
        slot({ ...draft, y }, (r) => !shown.boundary || !hits(r, boundary, 20)),
      );
    }
  return { at, boundary };
}

// ---------------------------------------------------------------- routes
// Every relation we draw is anchored on a side of each box and routed with its bends written as
// points, so that no segment crosses a box other than its two ends. The rule: the first relation
// between two boxes leaves by the side that faces the other box; each further one between the same
// two boxes takes a lane of its own around them (right, left, right…), farther out each time. The
// route itself is the shortest orthogonal path, with few bends, on a sparse grid of lines that run
// clear of every box; it never runs along a stretch another route already takes, unless the page
// leaves it no other way, where such a stretch only costs more.
const SIDES = {
  top: { x: 0.5, y: 0, dx: 0, dy: -1 },
  bottom: { x: 0.5, y: 1, dx: 0, dy: 1 },
  left: { x: 0, y: 0.5, dx: -1, dy: 0 },
  right: { x: 1, y: 0.5, dx: 1, dy: 0 },
};
const CLEAR = 15, // the room kept around a box
  STUB = 25, // how far a route leaves a box before it turns
  LANE = 40, // the distance between two lanes of twin relations
  BEND = 120; // the cost of a bend, in pixels of length

function facing(s, t) {
  if (t.y >= s.y + s.h) return ['bottom', 'top'];
  if (t.y + t.h <= s.y) return ['top', 'bottom'];
  return t.x >= s.x + s.w ? ['right', 'left'] : ['left', 'right'];
}

function routes(relations, at, keepOff = []) {
  // Sides first: the facing pair for the first of twins, a lane on each side for the others.
  const legs = relations.map((r) => {
    const twins = relations.filter((o) => [o.from, o.to].sort().join() === [r.from, r.to].sort().join()),
      k = twins.indexOf(r),
      s = at.get(r.from),
      t = at.get(r.to);
    const [out, inn] = facing(s, t);
    if (k === 0) return { r, out, inn, reach: STUB };
    const vertical = out === 'top' || out === 'bottom',
      side = vertical ? (k % 2 ? 'right' : 'left') : k % 2 ? 'bottom' : 'top';
    return { r, out: side, inn: side, reach: STUB + LANE * Math.ceil(k / 2) };
  });
  // Then the place on each side: the relations that share a side of a box are spread along it, in
  // the order of the other ends, so that they do not cross on leaving.
  const spot = new Map();
  const ends = legs.flatMap((l) => [
    { l, box: l.r.from, side: l.out, other: at.get(l.r.to) },
    { l, box: l.r.to, side: l.inn, other: at.get(l.r.from) },
  ]);
  for (const group of Map.groupBy(ends, (e) => `${e.box} ${e.side}`).values()) {
    const across = group[0].side === 'top' || group[0].side === 'bottom' ? 'x' : 'y';
    group.sort((a, b) => a.other[across] - b.other[across]);
    group.forEach((e, i) => spot.set(e, Math.round(((i + 1) / (group.length + 1)) * 100) / 100));
  }
  const used = [],
    labels = [];
  return legs.map((l) => {
    const [a, b] = ends.filter((e) => e.l === l);
    const anchor = (e) => {
      const r = at.get(e.box),
        side = SIDES[e.side],
        f = spot.get(e);
      const fx = side.dx ? side.x : f,
        fy = side.dy ? side.y : f;
      return { fx, fy, x: r.x + fx * r.w, y: r.y + fy * r.h, dx: side.dx, dy: side.dy };
    };
    const from = anchor(a),
      to = anchor(b);
    const points = route(
      { x: from.x + from.dx * l.reach, y: from.y + from.dy * l.reach },
      { x: to.x + to.dx * l.reach, y: to.y + to.dy * l.reach },
      [...at.values()],
      used,
    );
    const line = [from, ...points, to];
    for (let i = 1; i < line.length; i++) used.push([line[i - 1], line[i]]);
    return {
      style: `exitX=${from.fx};exitY=${from.fy};exitPerimeter=0;entryX=${to.fx};entryY=${to.fy};entryPerimeter=0;`,
      points,
      along: label(l.r, [from, ...points, to], [...at.values(), ...keepOff], labels),
    };
  });
}

// Where the label of a relation sits on its route, as draw.io reads it: -1 at the source, 1 at the
// target, 0 in the middle. It starts in the middle and slides along its own route, a tenth at a time,
// to the first place where it covers no other label, no box and no title of a boundary. A label is estimated at 9px a
// character (fontSize 15) and 20px a line.
function label(r, line, boxes, labels) {
  const texts = [r.label, r.protocols.length ? `[${r.protocols.join(', ')}]` : ''].filter(Boolean),
    w = 9 * Math.max(0, ...texts.map((t) => [...t].length)),
    h = 20 * texts.length;
  if (!w) return 0;
  const lengths = line.slice(1).map((q, i) => Math.abs(q.x - line[i].x) + Math.abs(q.y - line[i].y)),
    total = lengths.reduce((m, n) => m + n, 0);
  const box = (t) => {
    let left = ((t + 1) / 2) * total;
    for (const [i, n] of lengths.entries()) {
      if (left <= n || i === lengths.length - 1) {
        const f = n ? Math.min(1, left / n) : 0,
          p = line[i],
          q = line[i + 1];
        return { x: p.x + (q.x - p.x) * f - w / 2, y: p.y + (q.y - p.y) * f - h / 2, w, h };
      }
      left -= n;
    }
  };
  const free = (b) => !labels.some((o) => hits(b, o, 4)) && !boxes.some((o) => hits(b, o));
  for (const t of [0, 0.2, -0.2, 0.4, -0.4, 0.6, -0.6, 0.8, -0.8]) {
    const b = box(t);
    if (free(b)) {
      labels.push(b);
      return t;
    }
  }
  labels.push(box(0));
  return 0;
}

// The shortest orthogonal path from p to q that keeps CLEAR of every box, on the lines through
// p, q and the edges of the boxes' clear zones, plus an outer ring; its bends, with p and q. A stretch
// already used is out of bounds; with no path left, it is allowed at a higher cost.
const route = (p, q, boxes, used) => track(p, q, boxes, used, true) ?? track(p, q, boxes, used, false) ?? [p, q];
function track(p, q, boxes, used, apart) {
  const zones = boxes.map((b) => ({ x: b.x - CLEAR, y: b.y - CLEAR, w: b.w + 2 * CLEAR, h: b.h + 2 * CLEAR })),
    inside = (x, y) => zones.some((z) => x > z.x && x < z.x + z.w && y > z.y && y < z.y + z.h),
    blocked = (x1, y1, x2, y2) =>
      zones.some((z) =>
        x1 === x2
          ? x1 > z.x && x1 < z.x + z.w && Math.max(y1, y2) > z.y && Math.min(y1, y2) < z.y + z.h
          : y1 > z.y && y1 < z.y + z.h && Math.max(x1, x2) > z.x && Math.min(x1, x2) < z.x + z.w,
      );
  if (inside(p.x, p.y) || inside(q.x, q.y)) return null;
  const ring = 2 * STUB + 4 * LANE,
    left = Math.min(p.x, q.x, ...zones.map((z) => z.x)) - ring,
    right = Math.max(p.x, q.x, ...zones.map((z) => z.x + z.w)) + ring,
    up = Math.min(p.y, q.y, ...zones.map((z) => z.y)) - ring,
    down = Math.max(p.y, q.y, ...zones.map((z) => z.y + z.h)) + ring;
  const xs = [...new Set([p.x, q.x, left, right, ...zones.flatMap((z) => [z.x - 10, z.x + z.w + 10])])].sort(
      (m, n) => m - n,
    ),
    ys = [...new Set([p.y, q.y, up, down, ...zones.flatMap((z) => [z.y - 10, z.y + z.h + 10])])].sort((m, n) => m - n);
  const shared = (x1, y1, x2, y2) =>
    used.some(([u, v]) =>
      x1 === x2
        ? u.x === v.x && u.x === x1 && Math.max(y1, y2) > Math.min(u.y, v.y) && Math.min(y1, y2) < Math.max(u.y, v.y)
        : u.y === v.y && u.y === y1 && Math.max(x1, x2) > Math.min(u.x, v.x) && Math.min(x1, x2) < Math.max(u.x, v.x),
    );
  // Dijkstra over (column, row, direction): a bend costs BEND, a stretch shared with a route already
  // drawn is out of bounds, or costs its length twice more when no path keeps apart.
  const key = (i, j, d) => `${i},${j},${d}`,
    start = [xs.indexOf(p.x), ys.indexOf(p.y)],
    goal = [xs.indexOf(q.x), ys.indexOf(q.y)];
  const best = new Map([[key(...start, -1), 0]]),
    from = new Map(),
    open = [[0, ...start, -1]];
  const MOVES = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  let end = null;
  while (open.length) {
    open.sort((m, n) => m[0] - n[0]);
    const [cost, i, j, d] = open.shift();
    if (cost > (best.get(key(i, j, d)) ?? Infinity)) continue;
    if (i === goal[0] && j === goal[1]) {
      end = key(i, j, d);
      break;
    }
    MOVES.forEach(([di, dj], nd) => {
      const ni = i + di,
        nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= xs.length || nj >= ys.length) return;
      const [x1, y1, x2, y2] = [xs[i], ys[j], xs[ni], ys[nj]];
      if (inside(x2, y2) || blocked(x1, y1, x2, y2) || (apart && shared(x1, y1, x2, y2))) return;
      const length = Math.abs(x2 - x1) + Math.abs(y2 - y1),
        c = cost + length + (d >= 0 && d !== nd ? BEND : 0) + (shared(x1, y1, x2, y2) ? 2 * length : 0),
        k = key(ni, nj, nd);
      if (c < (best.get(k) ?? Infinity)) {
        best.set(k, c);
        from.set(k, key(i, j, d));
        open.push([c, ni, nj, nd]);
      }
    });
  }
  if (!end) return null;
  const cells = [];
  for (let k = end; k; k = from.get(k)) {
    const [i, j] = k.split(',').map(Number);
    cells.unshift({ x: xs[i], y: ys[j] });
  }
  // Keep the ends and the corners only.
  return cells.filter(
    (c, n) =>
      n === 0 ||
      n === cells.length - 1 ||
      !((cells[n - 1].x === c.x && c.x === cells[n + 1].x) || (cells[n - 1].y === c.y && c.y === cells[n + 1].y)),
  );
}

// ---------------------------------------------------------------- cells
// Model text is escaped once to become HTML and once more, with the whole value, to become
// an XML attribute. Characters that XML forbids are dropped.
const ENTITY = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '\n': '&#10;',
  '\r': '&#13;',
  '\t': '&#9;',
};
const esc = (s) =>
  String(s)
    .replace(/[^\x09\x0A\x0D\x20-\u{D7FF}\u{E000}-\u{FFFD}\u{10000}-\u{10FFFF}]/gu, '')
    .replace(/[&<>"'\n\r\t]/g, (c) => ENTITY[c]);
const span = (css, html) => `<span style="${css}">${html}</span>`;
const capital = (s) => s[0].toUpperCase() + s.slice(1);

const boxStyle = ([fill, stroke]) =>
  `rounded=1;absoluteArcSize=1;arcSize=14;html=1;whiteSpace=wrap;fillColor=${fill};strokeColor=${stroke};strokeWidth=2;fontFamily=IBM Plex Sans;align=left;verticalAlign=top;spacingLeft=14;spacingRight=10;spacingTop=10;`;
const boundaryStyle = ([fill, stroke]) =>
  `rounded=1;absoluteArcSize=1;arcSize=20;html=1;whiteSpace=wrap;fillColor=${fill};strokeColor=${stroke};strokeWidth=2;fontFamily=IBM Plex Sans;fontSize=20;verticalAlign=bottom;spacingTop=6;spacingBottom=6;`;
const participantStyle = ([fill, stroke]) =>
  `rounded=1;absoluteArcSize=1;arcSize=10;html=1;fillColor=${fill};strokeColor=${stroke};strokeWidth=2;fontColor=#000000;fontFamily=IBM Plex Sans;fontSize=19;`;
const RELATION =
  'edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;endArrow=block;endFill=1;endSize=9;strokeColor=#333333;strokeWidth=2;fontFamily=IBM Plex Sans;fontSize=15;fontColor=#000000;labelBackgroundColor=#FFFFFF;spacing=3;';
const LIFELINE = 'endArrow=none;strokeColor=#999999;strokeWidth=1;html=1;dashed=1;dashPattern=4 4;';
const CALL =
  'endArrow=block;endFill=1;endSize=9;strokeColor=#333333;strokeWidth=2;dashed=0;html=1;fontFamily=IBM Plex Sans;fontSize=17;fontColor=#000000;verticalAlign=bottom;align=center;labelBackgroundColor=none;spacingBottom=4;';
const RETURN = CALL.replace('endArrow=block', 'endArrow=open')
  .replace('strokeColor=#333333', 'strokeColor=#666666')
  .replace('dashed=0', 'dashed=1');
const BADGE =
  'display:inline-block;width:24px;height:24px;line-height:24px;border-radius:12px;background:#333333;color:#fff;font-weight:600;font-size:13px;text-align:center;margin-right:7px;vertical-align:middle';

function boxValue(e) {
  const type =
    (e.external ? `External ${e.kind}` : capital(e.kind)) +
    (e.technology ? `: ${e.technology}` : '') +
    (e.context ? ` · ${e.context}` : '');
  return [
    span('font-size:21px;font-weight:600;color:#000000', esc(e.name)),
    span('font-family:IBM Plex Mono;font-size:14px;color:#666666', `[${esc(type)}]`),
    e.description && span('font-size:16px;color:#333333;line-height:1.3', esc(e.description)),
  ]
    .filter(Boolean)
    .join('<br>');
}
const relationValue = (r) =>
  [
    esc(r.label),
    r.protocols.length &&
      span('font-family:IBM Plex Mono;font-size:13px;color:#666666', `[${esc(r.protocols.join(', '))}]`),
  ]
    .filter(Boolean)
    .join('<br>');

const rectXml = (r) => `<mxGeometry x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" as="geometry"/>`;
const lineXml = (x1, y1, x2, y2) => `<mxGeometry relative="1" as="geometry">
            <mxPoint x="${x1}" y="${y1}" as="sourcePoint"/>
            <mxPoint x="${x2}" y="${y2}" as="targetPoint"/>
          </mxGeometry>`;
// A style is plain text for a cell we generate, and the text of the old file for an edge we keep.
const cellXml = (
  c,
) => `        <mxCell id="${esc(c.id)}" value="${esc(c.value)}" style="${c.style}" parent="1" ${c.vertex ? 'vertex' : 'edge'}="1"${c.source ? ` source="${esc(c.source)}" target="${esc(c.target)}"` : ''}>
          ${c.geometry}
        </mxCell>`;

// The cells of a static page: the boundary first so that it sits behind, then boxes, then relations.
function staticCells(model, view, old = new Map()) {
  const shown = resolveStatic(model, view),
    id = (type, x) => `${view.id}--${type}--${x}`,
    kept = (cellId) => (old.get(cellId)?.geometry ? rectOf(old.get(cellId).geometry) : null);
  // Of two kept boxes that overlap, the later in the model's order is placed again, as a new box: a
  // box hidden under another cannot be reached in draw.io. The relations it ends are routed again.
  const elements = [...shown.inside, ...shown.above, ...shown.below],
    held = [],
    moved = new Set();
  for (const e of elements) {
    const k = kept(id('e', e.id));
    if (!k) continue;
    if (held.some((h) => hits(h, k))) moved.add(e.id);
    else held.push(k);
  }
  const { at, boundary } = layout(
    shown,
    (e) => (moved.has(e) ? null : kept(id('e', e))),
    shown.boundary ? kept(id('b', shown.of.id)) : null,
  );
  const same = (r) => (o) => {
    const k = rectOf(o.geometry);
    return k.x === r.x && k.y === r.y && k.w === r.w && k.h === r.h;
  };
  const cells = [];
  if (shown.boundary) {
    cells.push({
      id: id('b', shown.of.id),
      vertex: true,
      value: `<b>${esc(shown.of.name)}</b> [${capital(shown.of.kind)}]`,
      style: boundaryStyle(colorOf(shown.of)),
      geometry: rectXml(boundary),
      ok: same(boundary), // a kept boundary that had to grow is written again, and stays a person's
      hand: Boolean(kept(id('b', shown.of.id))),
    });
  }
  for (const e of elements) {
    cells.push({
      id: id('e', e.id),
      vertex: true,
      value: boxValue(e),
      style: boxStyle(colorOf(e)),
      geometry: rectXml(at.get(e.id)),
      ...(moved.has(e.id) && { ok: () => false }),
    });
  }
  // Each relation on its own route; its label on it, in the middle unless another label is there.
  // the title of the boundary sits in its foot, centred: labels keep off it
  const title = shown.boundary ? [{ x: boundary.x, y: boundary.y + boundary.h - 70, w: boundary.w, h: 70 }] : [];
  routes(shown.relations, at, title).forEach(({ style, points, along }, i) => {
    const r = shown.relations[i];
    cells.push({
      id: id('r', `${r.from}--${r.to}--${r.n}`),
      value: relationValue(r),
      style: RELATION + style,
      source: id('e', r.from),
      target: id('e', r.to),
      geometry: routeXml(points, along),
      ...((moved.has(r.from) || moved.has(r.to)) && { ok: () => false }),
    });
  });
  cells.moved = [...moved];
  return cells;
}
const routeXml = (points, along = 0) => `<mxGeometry${along ? ` x="${along}"` : ''} relative="1" as="geometry">
            <Array as="points">
${points.map((p) => `              <mxPoint x="${Math.round(p.x)}" y="${Math.round(p.y)}"/>`).join('\n')}
            </Array>
          </mxGeometry>`;

// The cells of a dynamic page. Its arrows are not connected, so their geometry says which
// lifelines they join: an arrow of the old file is kept only while that is still what the model says.
function dynamicCells(model, view, place, old) {
  const id = (type, x) => `${view.id}--${type}--${x}`,
    parts = participantsOf(view),
    was = (cellId) => old.get(cellId)?.geometry;
  // Participants: 260x42, at least 432px apart. The gap between two neighbours holds the widest
  // label of a step between them: 10px a character at fontSize 17 (IBM Plex Sans averages about 9),
  // plus the 31px badge and 40px of margin. A step that spans several gaps shares its width among them;
  // a step to oneself needs its short edge and half its label on the right. A new participant takes
  // the first free slot, away from the kept ones.
  const index = new Map(parts.map((p, i) => [p, i])),
    wide = (s) => 10 * [...s.label].length + 31 + 40,
    gaps = parts.slice(1).map(() => 432);
  for (const s of view.steps) {
    const a = index.get(s.from),
      b = index.get(s.to);
    if (a === b) {
      if (a < gaps.length) gaps[a] = Math.max(gaps[a], 120 / 2 + wide(s) / 2);
      continue;
    }
    const lo = Math.min(a, b),
      hi = Math.max(a, b),
      short = wide(s) - gaps.slice(lo, hi).reduce((m, n) => m + n, 0);
    if (short > 0) for (let g = lo; g < hi; g++) gaps[g] += Math.ceil(short / (hi - lo));
  }
  const slot = (i) => 129 + gaps.slice(0, i).reduce((m, n) => m + n, 0);
  const taken = parts
    .map((p) => was(id('p', p)))
    .filter(Boolean)
    .map(rectOf);
  const top = taken.length ? Math.min(...taken.map((r) => r.y)) : 0;
  const boxes = parts.map((p, i) => {
    let x = slot(i);
    if (!was(id('p', p))) {
      while (taken.some((r) => x < r.x + r.w && r.x < x + 260)) x += 432;
      taken.push({ x, w: 260 });
    }
    const e = model.byId.get(p);
    return place({
      id: id('p', p),
      vertex: true,
      value: `<b>${esc(e.name)}</b>`,
      style: participantStyle(colorOf(e)),
      geometry: rectXml({ x, y: top, w: 260, h: 42 }),
    });
  });
  // A lifeline hangs from the centre of its box, or stays where the old file has it.
  const rects = boxes.map((b) => rectOf(b.geometry));
  const lifeX = new Map(
    parts.map((p, i) => [p, pointOf(was(id('l', p)), 'sourcePoint')?.x ?? rects[i].x + rects[i].w / 2]),
  );
  const nearest = (x) =>
    Number.isFinite(x)
      ? parts.reduce((a, p) => (Math.abs(lifeX.get(p) - x) < Math.abs(lifeX.get(a) - x) ? p : a))
      : null;
  const steps = view.steps.map((s, i) => {
    const y = top + 100 + 70 * i,
      x = lifeX.get(s.from);
    return place({
      id: id('s', i + 1),
      value: span(BADGE, i + 1) + esc(s.label),
      style: s.ret ? RETURN : CALL,
      geometry: lineXml(x, y, s.from === s.to ? x + 120 : lifeX.get(s.to), y),
      ok: (o) =>
        nearest(pointOf(o.geometry, 'sourcePoint')?.x) === s.from &&
        nearest(pointOf(o.geometry, 'targetPoint')?.x) === s.to &&
        /(^|;)dashed=1(;|$)/.test(o.style ?? '') === s.ret,
    });
  });
  // A lifeline runs past the last step; one of the old file that stops short is drawn again.
  const last = Math.max(...steps.map((c) => pointOf(c.geometry, 'sourcePoint').y));
  const lifelines = parts.map((p, i) =>
    place({
      id: id('l', p),
      value: '',
      style: LIFELINE,
      geometry: lineXml(lifeX.get(p), rects[i].y + rects[i].h, lifeX.get(p), last + 40),
      ok: (o) => pointOf(o.geometry, 'sourcePoint') && pointOf(o.geometry, 'targetPoint')?.y >= last,
    }),
  );
  return [...boxes, ...lifelines, ...steps];
}

// ---------------------------------------------------------------- the existing file
// Read with regular expressions, whatever the order of the attributes, the quotes, or the
// way an empty element is closed. Attribute values stay as written (escaped).
const ATTRS = `((?:[^>"']|"[^"]*"|'[^']*')*?)`;
const element = (names) => new RegExp(`<(${names})\\b${ATTRS}(?:/>|>([\\s\\S]*?)</\\1>)`, 'g'); // [1] name, [2] attributes, [3] content
const attrsOf = (text) =>
  Object.fromEntries(
    [...String(text ?? '').matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map((m) => [
      m[1],
      m[2] ?? m[3].replace(/"/g, '&quot;'),
    ]),
  );
const num = (v) => Number(v ?? 0); // draw.io leaves out a coordinate that is 0
const rectOf = (geometry) => {
  const a = attrsOf(/<mxGeometry\b[^>]*/.exec(geometry)?.[0]);
  return { x: num(a.x), y: num(a.y), w: num(a.width), h: num(a.height) };
};
const pointOf = (geometry, as) => {
  for (const m of String(geometry ?? '').matchAll(element('mxPoint'))) {
    const a = attrsOf(m[2]);
    if (a.as === as) return { x: num(a.x), y: num(a.y) };
  }
  return null;
};

// The mark of the generator: the style key partition= holds a fingerprint of the geometry and the
// anchors it wrote the cell with, and of the whole style of an edge, or "hand" for a cell a person
// placed or restyled. A cell that still matches its fingerprint was left as the generator wrote it.
// The style of a box is not in it: the generator writes it again on each run.
const MARK = /(^|;)partition=[^;]*;?/;
const fingerprint = (geometry, style, edge) => {
  const g = attrsOf(/<mxGeometry\b[^>]*/.exec(geometry ?? '')?.[0]),
    points = [...String(geometry ?? '').matchAll(element('mxPoint'))].map((m) => {
      const a = attrsOf(m[2]);
      return `${a.as ?? ''}:${num(a.x)},${num(a.y)}`;
    }),
    anchors = ['exitX', 'exitY', 'entryX', 'entryY'].map(
      (k) => new RegExp(`(?:^|;)${k}=([^;]*)`).exec(style ?? '')?.[1],
    );
  return createHash('sha1')
    .update(
      [num(g.x), num(g.y), num(g.width), num(g.height), ...points, ...anchors, edge ? unmarked(style) : ''].join(' '),
    )
    .digest('base64url')
    .slice(0, 10);
};
const unmarked = (style) => String(style ?? '').replace(MARK, '$1');
const marked = (style, mark) => `${unmarked(style)}partition=${mark};`;
// A cell of the old file is a person's when its mark says so, when it left its fingerprint,
// or, unmarked, when draw.io saved the file: an unmarked file of our own was never edited.
const byPerson = (o, ours) => {
  const mark = /(?:^|;)partition=([^;]*)/.exec(o.style ?? '')?.[1];
  return mark === 'hand' || (mark ? mark !== fingerprint(o.geometry, o.style, o.edge) : !ours);
};

const readPages = (xml) =>
  [...xml.matchAll(element('diagram'))].map((m) => ({ id: attrsOf(m[2]).id ?? '', raw: m[0], body: m[3] ?? '' }));

function readCells(page) {
  let body = page.body;
  if (body.trim() && !body.includes('<')) {
    // a page saved compressed: base64 of a raw deflate of the URI-encoded XML
    try {
      body = decodeURIComponent(zlib.inflateRawSync(Buffer.from(body.trim(), 'base64')).toString('utf8'));
    } catch {
      throw new Error(
        `page "${page.id}" of the existing file cannot be read; in draw.io untick File > Properties > Compressed and save again`,
      );
    }
  }
  return [...body.matchAll(element('UserObject|object|mxCell'))].map((m) => {
    const inner = m[1] === 'mxCell' ? null : element('mxCell').exec(m[3] ?? ''); // a cell with custom data is wrapped; the wrapper holds the id
    const a = { ...attrsOf(inner?.[2]), ...attrsOf(m[2]) };
    return {
      id: a.id ?? '',
      style: a.style,
      edge: a.edge === '1',
      geometry: element('mxGeometry').exec((inner ?? m)[3] ?? '')?.[0],
      raw: m[0],
    };
  });
}

// ---------------------------------------------------------------- generation
const GRAPH =
  '<mxGraphModel dx="1434" dy="836" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="0" pageScale="1" pageWidth="1728" pageHeight="700" background="#FFFFFF" math="0" shadow="0">';

function build(model, existingXml) {
  checked(model);
  const oldPages = existingXml ? readPages(existingXml) : [],
    ours = /^\s*<mxfile\b[^>]*\bhost="partition"/.test(existingXml ?? ''),
    pages = [],
    report = [];
  for (const view of model.views) {
    const oldPage = oldPages.find((p) => p.id === view.id && !p.used);
    const oldCells = oldPage ? readCells(oldPage) : [],
      // only a person's cells are kept: the generator's are placed again
      old = new Map(oldCells.filter((c) => byPerson(c, ours)).map((c) => [c.id, c])),
      count = { kept: 0, placed: 0 };
    let moved = [];
    if (oldPage) oldPage.used = true;
    // Guarantee (a): a cell the old page already holds keeps its geometry, and an edge its style,
    // unless the cell says otherwise (a boundary that grew, a box moved off another, its relations).
    const place = (c) => {
      const o = old.get(c.id),
        keep = Boolean(o?.geometry) && (!c.ok || c.ok(o));
      if (c.vertex) count[keep ? 'kept' : 'placed']++;
      if (keep) return { ...c, geometry: o.geometry, style: marked(c.vertex ? c.style : (o.style ?? c.style), 'hand') };
      return { ...c, style: marked(c.style, c.hand ? 'hand' : fingerprint(c.geometry, c.style, !c.vertex)) };
    };
    let cells;
    if (view.kind === 'dynamic') cells = dynamicCells(model, view, place, old);
    else {
      const generated = staticCells(model, view, old);
      moved = generated.moved;
      cells = generated.map(place);
    }
    // Cells a person added are kept as they are; cells of ours that are no longer generated go.
    const byHand = oldCells.filter((c) => c.id !== '0' && c.id !== '1' && !c.id.startsWith(`${view.id}--`));
    pages.push(
      [
        `  <diagram id="${esc(view.id)}" name="${esc(view.title)}">`,
        `    ${GRAPH}`,
        '      <root>',
        '        <mxCell id="0"/>',
        '        <mxCell id="1" parent="0"/>',
        ...cells.map(cellXml),
        ...byHand.map((c) => `        ${c.raw}`),
        '      </root>',
        '    </mxGraphModel>',
        '  </diagram>',
      ].join('\n'),
    );
    report.push(
      `page "${view.title}" (${view.id}): ${count.kept} elements kept their hand-set position, ${count.placed} placed automatically` +
        (moved.length ? `, ${moved.length} moved off a kept box they overlapped (${moved.join(', ')})` : '') +
        (byHand.length ? `, ${byHand.length} hand-made cells kept` : ''),
    );
  }
  for (const p of oldPages) {
    if (p.used) continue;
    pages.push(`  ${p.raw}`); // a page that is not a view of the model belongs to a person
    report.push(`page "${p.id}": not a view of the model, kept as it was`);
  }
  return {
    xml: `<mxfile host="partition" agent="c4-drawio.mjs" compressed="false">\n${pages.join('\n')}\n</mxfile>\n`,
    report,
  };
}

// The whole .drawio file for the model; existingXml is the file it replaces, or null.
export const generate = (model, existingXml = null) => build(model, existingXml).xml;

// ---------------------------------------------------------------- Mermaid
export function mermaid(model, viewId) {
  const view = model.views.find((v) => v.id === viewId);
  if (!view)
    throw new Error(
      `view "${viewId}" does not exist; the views are ${model.views.map((v) => v.id).join(', ') || '(none)'}`,
    );
  if (view.kind !== 'dynamic')
    throw new Error(`view "${viewId}" is a ${view.kind} view; only a dynamic view becomes a sequence diagram`);
  checked(model);
  const id = (s) => s.replace(/-/g, '_'),
    text = (s) => s.replace(/[#;]/g, (c) => `#${c.charCodeAt(0)};`); // Mermaid reads # and ; as syntax
  return [
    'sequenceDiagram',
    '    autonumber',
    ...participantsOf(view).map((p) => `    participant ${id(p)} as ${text(model.byId.get(p).name)}`),
    ...view.steps.map((s) => `    ${id(s.from)}${s.ret ? '-->>' : '->>'}${id(s.to)}: ${text(s.label)}`),
  ].join('\n');
}

// ---------------------------------------------------------------- command line
const USAGE = `node c4-drawio.mjs [--model docs/architecture/model.yml] [--out docs/architecture/c4.drawio]
node c4-drawio.mjs --check [--model FILE]
node c4-drawio.mjs --mermaid VIEW [--model FILE]`;

function main(argv) {
  const opt = { model: 'docs/architecture/model.yml', out: 'docs/architecture/c4.drawio' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--check') opt.check = true;
    else if (['--model', '--out', '--mermaid'].includes(a) && argv[i + 1] !== undefined) opt[a.slice(2)] = argv[++i];
    else if (a === '--help' || a === '-h') {
      console.log(USAGE);
      return 0;
    } else {
      console.error(`c4: unknown or incomplete option ${a}\n${USAGE}`);
      return 2;
    }
  }
  let text, model;
  try {
    text = fs.readFileSync(opt.model, 'utf8');
  } catch (e) {
    console.error(`c4: cannot read ${opt.model} (${e.code ?? e.message})`);
    return 2;
  }
  try {
    model = loadModel(text, opt.model);
  } catch (e) {
    // YAML that cannot be read is an invalid model
    console.error(`c4: ${e.message}`);
    return 1;
  }
  const errs = validate(model);
  if (errs.length) {
    for (const e of errs) console.error(`c4: ${e}`);
    console.error(`c4: ${errs.length} error${errs.length > 1 ? 's' : ''} in ${opt.model}; nothing was written`);
    return 1;
  }
  try {
    if (opt.mermaid !== undefined) {
      console.log(mermaid(model, opt.mermaid));
      return 0;
    }
    if (opt.check) {
      console.log(
        `${opt.model}: ${model.elements.length} elements, ${model.relations.length} relations, ${model.views.length} views, no error`,
      );
      return 0;
    }
    const { xml, report } = build(model, fs.existsSync(opt.out) ? fs.readFileSync(opt.out, 'utf8') : null);
    fs.mkdirSync(path.dirname(path.resolve(opt.out)), { recursive: true });
    fs.writeFileSync(opt.out, xml);
    for (const line of report) console.log(`${opt.out}: ${line}`);
    return 0;
  } catch (e) {
    console.error(`c4: ${e.message}`);
    return 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  process.exit(main(process.argv.slice(2)));
