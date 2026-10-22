---
name: partition-spec
description: Write and change the durable specification of a bounded context or the area file of an area, and feed the invariant register. Use when a behaviour changes, when code and spec disagree, when a rule or a word is shared by the bounded contexts of an area, or to decide where a statement belongs.
license: MIT
---

# Durable spec

The durable spec of a bounded context is the source of truth; the code implements it. There is one per bounded context, at `<specs>/<area>/<bounded-context>/spec.md`, or `<specs>/<bounded-context>/spec.md` for one in no area (`<specs>` is `paths.specs` in `docs/partition.yml`, default `docs/specs`). It says what is true now, in the present tense. It is not a journal and it holds no plan. The words of the method are explained in `references/glossary.md`.

## Where a statement belongs

| The statement is | It goes in |
| --- | --- |
| True for one bounded context, for every feature | its durable spec |
| Owned by one bounded context and needed by others | the durable spec of the owner; the others consume its result through its contract, and a copy another bounded context's source also states stays in that bounded context's spec, reported as a duplicate, until that source is amended; nothing is moved |
| An API contract given for a bounded context that exists, whose decomposition records another source | its `Contracts with neighbours`; never a second source of the decomposition, whose provenance does not change |
| The API contract of a system a bounded context only calls | that bounded context's `Contracts with neighbours`, the contract read where it lives; never a source of a decomposition |
| Shared by the bounded contexts of one area, with no owner among them | the area file of that area |
| True for every feature, spanning at least two areas or layers, a defect when broken | the invariant register |
| What one feature must do, checked once at delivery | the design of that feature |
| Progress, a task, a blocker, the dated reason for a choice | its plan |
| How code is written here, however many bounded contexts it reaches | a rule file of the project, scoped to the code it binds, written through `partition-rules`; never an area rule |
| What a source says beyond its rules, invariants and decisions | the source, pointed to from `Source parts owned` |

A statement that fails the admission test is placed by its object. What a bounded context holds or shows (the meaning, unit or form of its data, its observable behaviour, its contract) goes to its spec or its area file; the form of its stored data goes to `Persistence`, after "No schema documents are declared for this project" when the project declares none. How its code is shaped and what it does beside that behaviour (names, layout, configuration, framework, logs and other side channels) is a line of a rule file, even when a breach is a defect. How code is written that a caller also observes at the contract is put to the owner as two readings, a rule file or a business rule, neither proposed; nothing of it is written before the owner's answer.

A statement goes to the lowest level that holds it all, and a lower level never contradicts a higher one: the hierarchy of rules in `references/glossary.md`. An acceptance criterion never enters a durable spec. What survives the feature does: a business rule, a word of the language, a contract with a neighbour.

## Write the spec of a new bounded context

A new bounded context is created by the `partition-shape` skill from a source, a described context included, never started here; the one a fission creates, by the `partition-reshape` skill. Once a bounded context is retained or created by a fission, its spec is written through these steps:

1. Check the bounded context is declared in `docs/partition.yml` (`contexts:` with `id`, `spec`, `code`, and `area` when it belongs to one). Add it if not, as `partition-shape` or, for a fission, `partition-reshape` declares it; ask for the code paths rather than guessing them.
2. Copy `assets/spec.md` to its path. `partition-shape` (or `partition-reshape`, for a fission) fills its five source lines and `Source parts owned`: which parts of the source the bounded context owns, and its provenance.
3. Fill only what a source establishes: a workshop record, a document, a person's answer. Name the source. Everything else goes to `Open questions`, worded so it can be answered.
4. Leave `Business rules` empty with its "TO FILL" banner when the source states no rule for it; otherwise copy the rules it states word for word, mark them "from source" with their anchor, and keep the "TO VALIDATE" banner. A business rule is not deduced from code, from a field name or from an example. A person fills or confirms it, then removes the banner; until then the bounded context is not fit for design or implementation, and you say so.
5. Write `Language` with the person: one meaning per word, no synonym. A word shared by the bounded contexts of an area goes once, to its area file. A word that means something else in a neighbouring bounded context is recorded in both specs: it marks the boundary. A word given two meanings in one bounded context is not written: ask which meaning holds there and whether the other belongs to another bounded context, recall that a word meaning something else in a neighbour marks a boundary, and put the question in `Open questions` until a person settles it.

## Change a spec: the spec moves first

When a behaviour must change, or when the code and the spec disagree:

1. Say which side is wrong and why. A spec can be incomplete, outdated or ambiguous; the code can be a bug. When you cannot tell, ask. Do not edit the spec to match the code because the code is what runs. A rule copied from a source changes only through its source. When the source contradicts itself, say so, ask the owner of the source which requirement holds, and propose no wording for the copied rule: once the source is amended, a person rewrites it.
2. If the spec is wrong, correct the spec, show the change, and get it validated.
3. Only then realign the code, through its plan.
4. Put the dated reason in `## Decisions` of the plan in progress. The spec keeps the result, not the story.

If the work contradicts a line of the area file or of the invariant register, stop and flag it before writing code. It is a bug in the work or the reversal of a decision; both need the owner. A rule is reversed the way any behaviour changes: one copied from a source through its source, whose owner amends it before the delta of `partition-shape` carries it; one written by a person through this section, the owner validating the change.

## Sections and who writes them

| Class | Sections | Treatment |
| --- | --- | --- |
| Derived from the source | `Source parts owned` | regenerated by `partition-shape`; never edited by hand |
| Copied from the source | the "from source" lines of `Business rules`, `Decisions` | copied word for word with their anchor; confirmed by a person; never rewritten |
| Semi-derived | `Persistence` | lines are added; an existing line that became false is reported, not rewritten |
| Hand-written | every other section | added to; never replaced, reordered or emptied without the owner |
| Hand-written | `Open questions` | an entry leaves once a person settles it, in the change that writes the answer, that answer being the owner's word; an unsettled one leaves only with the owner |

## The area file

`<specs>/<area>/area.md` holds the language and the area rules shared by the bounded contexts of one area. Every bounded context of the area reads it: keep it small. Before writing, changing or removing a rule or a word of it, LOAD `references/area.md`: how an entry is written and validated, and what another area already holds.

## The invariant register

`<invariants>` (`paths.invariants` in `docs/partition.yml`, default `<specs>/invariants.md`) holds the statements that span at least two areas or layers, one line each, as `INV-{CAT}-{NNN}`. Create it from `assets/invariants.md` when its first entry is validated. Before adding, changing or removing an entry, LOAD `references/invariants.md`: it holds the admission test and the procedure. Most plans produce no entry; that is the normal outcome.

## One home

A bounded context spread over several repositories has one home for its spec. The other repositories point to it in their `docs/partition.yml` (`spec:` may be a path outside the repository) and never copy it.

## Keep it small

The spec is read by every task of its bounded context, so its size is part of the budget. Cut what the source or the code already says. A spec that keeps growing is a sign that the bounded context holds two: say so, and see `partition-budget`.
