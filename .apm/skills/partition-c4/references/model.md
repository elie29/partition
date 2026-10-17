# The model file

`docs/architecture/model.yml`, in the strict YAML subset every Partition script reads: block maps and lists, one value per line, flow lists `[a, b]` of plain values. Put quotes around a value that holds `: ` or starts with `*`, `&` or `!`. Anything else (flow maps, multi-line strings, anchors, tabs) fails with its line number.

```yaml
title: Shop platform

elements:
  - id: buyer # lowercase letters, digits, hyphens; never two hyphens in a row
    kind: person # person | system | container | component
    name: Buyer
    description: Orders goods
  - id: shop
    kind: system
    name: Shop
    description: Sells goods online
  - id: web
    kind: container
    in: shop # a container lives in a system, a component in a container
    name: Web app
    technology: SPA # optional
    description: What the buyer sees
    color: orange # optional
    context: orders # optional: the bounded context it belongs to
  - id: api
    kind: container
    in: shop
    name: API
  - id: db
    kind: container
    in: shop
    name: Database
  - id: psp
    kind: system
    external: true # optional: drawn grey, labelled External system
    name: Payment provider

relations:
  - buyer -> web: places orders [HTTPS] # from -> to: label [protocol]
  - web -> api: calls # the protocol is optional
  - api -> db # so is the label

views:
  - id: context
    kind: context # context | containers | components | dynamic
    of: shop # a system for context and containers, a container for components
    title: C4 1 - Context
  - id: containers
    kind: containers
    of: shop
    title: C4 2 - Containers
  - id: checkout
    kind: dynamic
    title: Dynamic - Checkout
    participants: [web, api, db] # optional; default: order of first appearance
    steps:
      - web -> api: POST /orders
      - api -> db: insert order
      - db --> api: order id # --> is a return, drawn dashed
      - api --> web: 201 Created
```

## Rules the script checks

- Identifiers are unique. `in` names an existing element of the right kind; a person and a system have none; a container and a component must have one.
- Both ends of a relation and of a step exist. `-->` is for steps only.
- `of` exists and has the kind the view needs.
- A dynamic view has at least one step; when `participants` is given, every step uses only those.
- A model has at least one view.

## Colours

`red`, `green`, `orange`, `purple`, `blue`, `grey`, `yellow`, `amber`, `white`. Without `color`: a person is orange, a system red, a container purple, a component white, anything external grey. A boundary takes the colour of its element.

## Commands

```bash
node scripts/c4-drawio.mjs [--model docs/architecture/model.yml] [--out docs/architecture/c4.drawio]
node scripts/c4-drawio.mjs --check [--model FILE]          # validate only, exit 1 on errors
node scripts/c4-drawio.mjs --mermaid VIEW [--model FILE]   # print a dynamic view as Mermaid
```

## Limits to know

- The first layout is a readable draft, in rows. A relation the script routes goes around the boxes, never through one, and runs along no stretch of another relation unless the page leaves no other way. A route the script drew is drawn again on each run; a route a person changed is kept, so a box added later or moved by hand can sit on it: route it by hand once more; the route is kept.
- A file draw.io saved before the script marked its cells counts as all placed by hand: every cell keeps its place. Delete the file once to hand the whole layout back to the script.
- A new child that would make the boundary grow over a box kept outside it goes beside a kept child instead. When no free place keeps the boundary clear, as when a person put an outside box on the boundary, the new child takes the nearest free place of its row and the boundary can cover that box.
- Two relations between the same boxes are told apart by their order in the file. Inserting one before another can hand a hand-made route to its neighbour.
- A link or a tooltip added in draw.io to a generated cell is lost on regeneration; its position is kept.
- The script generates; it does not read a hand-drawn `.drawio` file. The model is written from it once, by hand (see the skill). Its pages are kept as they are, beside the generated ones, until a person deletes them.
