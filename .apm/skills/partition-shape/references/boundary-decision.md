# Deciding a boundary

Where a boundary goes is the architect's decision. This file says how the assistant helps reach it: it warns, lets the architect choose the way, proposes or challenges, and records. It never decides.

## When

Before a boundary moves: the decomposition of a source (`references/decompose.md`, step 4); a delta that proposes a new bounded context, a merge, a removal or a move (`references/delta.md`, step 4); a fission, a merge, a removal or a move (`partition-reshape`). Not an attachment (R3 of `references/criteria.md`): it moves no boundary. Not a promotion: it is a decision of the C4 model.

## The choice

Once the criteria are evaluated, and before a decision is shown as one, tell the architect:

- what is at stake: the units, the candidate aggregates, the zones the criteria leave open (a strong sharing under R4, a criterion settled "no" for lack of information);
- that the decision is theirs;
- the two ways to reach it, and ask which:
  1. **a workshop** (Event Storming, or the team's own): hand over the material below and stop. Nothing is written. The procedure resumes when the result is given;
  2. **a proposal**: the options below.

When the request already names the way ("prepare a workshop", "propose a split"), do not ask it again.

## The material for a workshop

From the source and the existing specs:

1. the domain events the source names, in its words;
2. the words that carry two meanings, each quoted with where it is found;
3. the candidate aggregates, and the units that act on each;
4. the data and the rules the candidates share (C6, R4).

`partition-reshape` adds its own. Hand the material over as it is: no boundary comes with it.

## A proposal

Two or three options, side by side, numbered 1, 2, 3; the `Decided` line names the one chosen by its number:

Above the table, one line: how many splits the criteria leave. When they leave a single split, the line names it and, for each other split, the criterion that makes it fall.

| Option | Bounded contexts and their units | Criteria satisfied | Criterion broken | What it costs | What it brings |
| ------ | -------------------------------- | ------------------ | ---------------- | ------------- | -------------- |

Criterion broken: the criterion of C1–C6 or the rule of R1–R6 the option keeps a point against, with the units it fails on; "None" for an option the criteria leave. A rule that is none of these is not a criterion broken. What it costs: the data and the rules shared across the line (R4), the budget it moves, the dependencies to put behind an interface. What it brings: in the terms of the criteria. Then say which option is recommended, and why.

Before the options are shown, check: the line above the table is written; each option's `Criterion broken` names a criterion or reads "None"; the recommended option reads "None".

The recommended option is one the criteria C1–C6 and the rules R1–R6 leave. An option that keeps a point against a criterion may be shown; it is never the one recommended: keeping it is the architect's decision. Never invent an option to make up a number. The architect chooses one, combines them or rejects them all; an answer that asks for another split sends back to the decision step of the procedure.

Each bounded context of an option carries the name the naming rule of `references/criteria.md` gives. That name is a proposal: the architect keeps it or chooses another when deciding the boundary.

## The result of a workshop

Any readable form: a text, a table, a transcribed wall. It is saved under `paths.sources` of `docs/partition.yml` (default `docs/sources/`), under a name the architect gives, shown and validated before it is challenged, like any source given in the chat.

## The challenge

Confront the result, point by point, with:

- the source: every unit in scope belongs to one bounded context;
- the criteria C1–C6 and the rules R1–R6 of `references/criteria.md`;
- the material prepared;
- the invariant register, the area file and the existing specs.

Each bounded context the result names is checked against R1 from the source alone: C2 and one of C3–C5, each quoted from the units it would own. One that fails is a finding, with the criterion and the units: a decision of the result does not make a criterion hold, it keeps the point against it.

For each finding: what the result says, what it contradicts, quoted with where, and the improvement proposed. Then offer to take the result as it is. "No finding" is a normal outcome: say so. The architect decides each finding.

## The record

- The way and who decided: the `Decided` line of `bounded-contexts.md`; the `Decided on` line of the reshape record (`partition-reshape`, `assets/reshape-record.md`).
- An option not chosen, and an improvement refused that touches no criterion: `Alternatives rejected`, with the architect's reason.
- A point kept although a criterion fails: `Kept against the criteria`, with the point, the criterion, who decided, the date and the reason. A later delta does not propose it again unless it changes, for the units of that point, the criterion it was kept against.
- After a workshop, in a reshape: each finding and its outcome in the record's `## Challenge`.
