# Splitting criteria and decision rules

Single definition. The decomposition procedure (`references/decompose.md`) and the delta procedure (`references/delta.md`) apply what follows as it stands and never redefine it.

A **unit** is the smallest part of the source the criteria judge: an operation of an API contract, or a requirement or story of a document under its anchor, or one of its sections when the document identifies none. A part that only records decisions, defines terms or gives context is not a unit: the decisions it states are copied, the rest is pointed to. How C2, C5 and C6 are measured depends on the kind of source and is said by its reader: `references/sources/openapi.md` or `references/sources/document.md`.

## The six criteria

Evaluate the six criteria **unit by unit, over the units in scope**. Each criterion is settled by yes / no, with the justification taken from the source. The comparisons "distinct from the others" are made between units in scope.

A coupling outside the scope (C6) never brings a unit into the scope: it is recorded in the gaps detected, so that the user decides whether the scope must be extended.

| # | Criterion | What it measures | Argues for |
| --- | --- | --- | --- |
| C1 | **Functional grouping** | The unit carries a grouping distinct from the others: a `tag` for an API, a section for a document | **Hint** — outside the threshold (see R2) |
| C2 | **Root aggregate of its own** | The root aggregate the unit acts on differs from that of the others. The reader of the source says how the root aggregate is found | Separation — **mandatory** (see R1) |
| C3 | **Business language of its own** | The vocabulary of the unit stands alone: a reader of the bounded context does not need the vocabulary of the others | Separation |
| C4 | **Life-cycle autonomy** | The unit can be used, versioned and have its model evolve without coordination with the others | Separation |
| C5 | **Distinct external dependencies** | The unit relies on **named** third-party systems different from those of the others. An unnamed third party never satisfies C5 | Separation |
| C6 | **Shared data** | The unit shares data with other units: schemas or structures for an API, entities or data for a document | **Grouping** |

## Decision rules

- **R1 — Threshold.** A bounded context is retained only if **C2 is satisfied and at least one criterion among C3, C4, C5** is satisfied too. Without a root aggregate of its own, no bounded context, whatever the number of other criteria satisfied.
- **R2 — C1 is a hint.** It never counts in the threshold: a grouping reflects an editorial choice of the source's author (a split by controller, by audience, by chapter), and a grouping carried by a single unit is distinct by construction. C1 only serves to confirm a split or to decide between two attachments.
- **R3 — Attachment.** A unit that does not satisfy R1 against a candidate bounded context **joins** it. If several candidates fit, it joins the nearest neighbour: the one with which it shares the root aggregate, otherwise the one against which it satisfies the fewest criteria among C3–C5; C1 then C6 break ties. The attachment is justified explicitly, by name.
- **R4 — C6 never creates a bounded context.** A strong sharing of data, or of business rules, between two candidates that satisfy R1 is an argument **against** their separation and must be discussed explicitly; if it prevails, the decision goes to `Decisions not to split`.
- **R5 — Single unit.** A single unit neither justifies nor forbids a bounded context by itself: R1 decides, not the count.
- **R6 — Merge.** Two bounded contexts that no longer satisfy R1 against each other call for a merge.

## The three outcomes of the decision

Three outcomes are possible, and all three are legitimate:

1. **Several bounded contexts** — the common case of a source that covers several resources or subjects.
2. **A single bounded context** — the source is cohesive. This outcome is justified **as explicitly** as a split: name the separation criteria that failed and why.
3. **Decomposition impossible as things stand** — the source is too ambiguous to decide. Stop, list the ambiguities, ask the questions. Write nothing.

## Naming a bounded context

Propose a name for each bounded context after its business vocabulary, in **kebab-case**, in the singular of the aggregate (`order`, `product`, `price-list`). Never the snake_case of code packages, never the name of an endpoint or of a chapter. The name is a proposal: the architect keeps it or chooses another when deciding the boundary (`references/boundary-decision.md`).
