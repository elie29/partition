# Step 18 — The quarter → the assessment; nothing changes

## The situation

A quarter has passed, and the budget assessment is held on a schedule, not when something hurts. The project has two deployables, three areas, five bounded contexts, and three features coming. Before they start, you read it from cold four times: its load, its patterns, its hexagons, one bounded context against its spec.

## What you bring

- [architect, PO, BA] The coming features: _invoice reminders_ (`invoice`), _partial payments_ (`payment`), _product bundles_ (`product`).
- [architect, PO, BA, TL] The answers to the three warning signs a script cannot measure. Two are "not observed"; the third, "the assistant reinvents a rule that already exists elsewhere", was observed once: the VIP customer under fraud review at step 09, stopped before code, not after.

The assistant asks who decides and when the next assessment falls. You answer as the team would.

## What you ask

Each prompt in a fresh session: each is a reading from cold, and nothing of the build may colour it.

> Hold the quarterly budget assessment.

Then the pattern grid:

> Audit the code against the pattern grid.

Then the layer maps:

> Check the hexagons against their layer maps.

And one bounded context:

> Audit `payment` against its spec.

## What partition does

1. **The assessment.** `partition-budget` runs its script and pastes the output, unedited, into the record of the day under `docs/budget/`. An earlier record is never overwritten: the series is the trend, and the record says what moved.
2. **The features against the load.** For each coming feature: what it needs to load, against what it will load. None is near its threshold at this size.
3. **The options, not a choice.** Scope or cut a rule, trim a spec, a workshop, a promotion, or nothing, each with its reason. The assistant does not pick: the decision goes in with the names of those who took it and the next date.
4. **The pattern audit.** `partition-patterns` replays `P-1`: the status of an invoice is coded as ruled, or the deviation with `file:line`. Patterns in the code that the grid never ruled on (the adapters, the generated interfaces) are listed as questions, not faults. A row goes to `## Audits`; the code is not touched.
5. **The hexagon check.** `partition-hexagon` matches each layer's imports against its map, for every hexagon of `docs/partition.yml`: a forbidden dependency, a business decision in an adapter, a use case reaching a database without a port, one hexagon importing another. Each finding has its `file:line`; it says what it did not check, the ArchUnit test included when it did not run it. Nothing changes.
6. **The spec auditor.** The `spec-auditor` agent reads `payment`'s spec, `billing/area.md` and the register, then its code in `payment-app`, as a reader who did not write it. For each rule and contract it reports a gap and which side is wrong. It changes nothing.

**Why it works this way.** Load is reviewed on a calendar, with the people who know what is coming, not when symptoms appear. And every reading here only reports: a finding is fixed through a plan, once someone decides to fix it.

## The shape after

Unchanged: a new budget record and an audit row. The figure is [step 17's](17-promotion.md#the-shape-after).
