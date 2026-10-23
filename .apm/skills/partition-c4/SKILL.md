---
name: partition-c4
description: Maintain the C4 architecture model as text and generate its draw.io views and sequence diagrams. Use to add or change a system, container, component or relation, to draw a context, container, component or dynamic view, or a sequence diagram, or to turn a hand-drawn draw.io file into the model.
license: MIT
compatibility: Node.js 22 or later
---

# C4 as text

The architecture is described in C4 (systems, containers, components) in one text file, `docs/architecture/model.yml`. It is the source: you read it and you change it. The draw.io file is generated from it and is never the place where an element, a relation or a label is changed. A `.drawio` file is tens of thousands of tokens of XML; the model is a few hundred.

## Change the architecture

1. Edit `docs/architecture/model.yml`. If it does not exist, start from `assets/model.yml`, or from the project's hand-drawn `.drawio` file: read it once and write the model from its boxes, nesting and arrows. The kind and parent of a box the drawing leaves open is a question to the owner, never a guess. For the format, LOAD `references/model.md`.
2. Validate, then generate (run from the root of the project; `scripts/c4-drawio.mjs` stands for that file in this skill's folder):

   ```bash
   node scripts/c4-drawio.mjs --check
   node scripts/c4-drawio.mjs            # writes docs/architecture/c4.drawio, one page per view
   ```

3. Show the output of both commands. A validation error names the view and the identifier it does not know: fix the model, not the message.

Add an element only when a source establishes it: the code, a decision, the owner. A container you guess from a folder name is an invention. What you do not know is a question.

## What a person owns in the draw.io file

Regenerating keeps what was done by hand in draw.io: the position and size of every box, the route and style of every relation, and every cell or page the model does not know about. What the script placed and nobody changed is placed again on each run, so a page never keeps the layout of elements that left it; a `partition=` key in the style of each cell tells the two apart. So:

- to move, resize or reroute, a person does it in draw.io, once, and it stays;
- to hand a box or a relation back to the script, delete it in draw.io; the next run places it again;
- to rename, describe, add, remove or reconnect, change the model and regenerate;
- an element added to a page that was already arranged takes a free place, clear of the kept boxes, and a kept boundary grows to hold its new children without covering a box kept outside it.
- two kept boxes that overlap are the one exception: the later in the model's order takes a free place, as an added element does, and the run names it. A box hidden under another cannot be reached in draw.io.

Never edit the generated cells of the `.drawio` file yourself, and never read that file to learn the architecture: read the model. The one reading is the transformation above, before a model exists.

## Views

| `kind`       | Shows                                                               |
| ------------ | ------------------------------------------------------------------- |
| `context`    | one system, with the people and systems related to it               |
| `containers` | the containers of a system, and what they talk to outside it        |
| `components` | the components of a container, and what they talk to outside it     |
| `dynamic`    | one scenario as numbered steps between elements: a sequence diagram |

A relation written between two components also appears, lifted, in the container and context views. Write each relation once, at the lowest level you know.

## Sequence diagrams

A `dynamic` view is drawn as a sequence page in the draw.io file. To embed the same scenario in a durable spec or a design, print it as Mermaid and paste the block:

```bash
node scripts/c4-drawio.mjs --mermaid <view id>
```

Every participant of a step must be an element of the model; the script refuses the others. A scenario that needs an element the model does not have is a change of architecture first, a diagram second. Do not write a sequence diagram by hand beside the model: the two would drift.

## Bounded contexts

Give each container or component its `context:`. A relation between two elements of different contexts is a contract: it must exist in `Contracts with neighbours` of both specs. When an element changes kind or parent (a component promoted to a container, a container to a system), the move is prepared by `partition-reshape`; here you only record it.
