# Step 18 — The scheduled assessment, the pattern audit, the hexagon check

> **Session:** 📌 open a **fresh session** for each of the four prompts. Each is a reading of the project from cold: nothing of the build may colour it.

## The problem

A quarter has passed: the assessment is due, and three features are coming: invoice reminders, partial payments, product bundles.

## Before

Your `partition-commerce` project should be at the commit of step 17: two deployables; areas `billing` (`invoice`, `payment`), `catalog` (`product`), `customer` (`customer`, `fraud`); several budget records in `docs/budget/`; `P-1` in the grid.

## Provided

`[architect, PO, BA, team]` give you the answers to the warning signs of the assessment:

| Sign | Answer |
| --- | --- |
| The same context has to be explained again at every request | not observed |
| The assistant causes regressions outside the scope asked | not observed |
| The assistant reinvents a rule that already exists elsewhere | observed once: the request to let a VIP customer under fraud review pay was stopped before code, not after |

`[architect, PO, BA]` give you the coming features: _invoice reminders_ (`invoice`), _partial payments_ (`payment`), _product bundles_ (`product`).

## Prompt

**18.a** — 📌 in a fresh session, type:

> Hold the quarterly budget assessment.

Then commit the record:

```bash
git add docs/budget && git commit -m "docs(budget): the quarterly assessment"
```

**18.b** — 📌 in a fresh session, type:

> Audit the code against the pattern grid.

Then commit the audit:

```bash
git add docs/architecture && git commit -m "docs(architecture): the pattern audit"
```

**18.c** — 📌 in a fresh session, type:

> Check the hexagons against their layer maps.

**18.d** — 📌 in a fresh session, type:

> Audit `payment` against its spec.

18.c and 18.d change no file: nothing to commit.

## Expected

### 18.a — The assessment

You should see `partition-budget` (_The assessment_) do this:

1. `budget.mjs` run; its output pasted **unedited** into `docs/budget/YYYY-MM-DD.md`, from `assets/assessment.md`. A second assessment the same day replaces that day's record; no earlier record is overwritten.
2. For each coming feature: what it needs to load, against what it will load.
3. For a gauge over its threshold: what makes it so. None is expected at this size.
4. The options, **not chosen by the assistant**: scope or cut a rule, trim a spec, a workshop, a promotion, nothing — with the reason (`partition-budget`, _The assessment_, step 4, lists them all whatever the gauges).
5. The decision, with the names of those who took it, and the date of the next assessment (quarterly).

The first sign, files touched per change, is measured by the script; the three others are the team's answers, recorded with their evidence. The record compares with the previous one and says what moved.

### 18.b — The pattern audit

You should see `partition-patterns` (_Audit_) replay `P-1` — the status of an invoice is coded as ruled, or the deviation with `file:line`. Patterns present in the code and absent from the grid (the adapters, the generated interfaces are ports and adapters, not rulings) are listed **as questions, not as faults**. A row in `## Audits`. Nothing changes in the code.

### 18.c — The hexagon check

You should see `partition-hexagon` (_Check_) match, for each hexagon of `docs/partition.yml`, each layer's imports against its map. Every forbidden dependency with `file:line` and its two layers; a business decision in an adapter; a use case reaching a database without a port; a domain file importing the framework; one hexagon importing another instead of going through a contract. What it did not check, and why. No change. The ArchUnit test is the same check, failing the build: the reading does not run it; when the session says it did not, that is among what it did not check.

### 18.d — The spec auditor

You should see the `spec-auditor` agent, on `payment`, read `docs/partition.yml` for the spec, the area and the code paths of `payment` (now in `payment-app`), the spec, `billing/area.md` and the register, then the code, as a reader who did not write it. Each business rule and each contract checked against the code; it reports and changes nothing.

### The shape after

Unchanged: a new budget record and an audit row. The figure is [step 17's](17-promotion.md#the-shape-after).

## Verdict

- [ ] 18.a — `budget.mjs` is run; its output is pasted unedited into `docs/budget/YYYY-MM-DD.md`, from `assets/assessment.md`
- [ ] 18.a — No earlier record is overwritten; a second assessment the same day replaces that day's record
- [ ] 18.a — For each coming feature (invoice reminders, partial payments, product bundles): what it needs to load, against what it will load
- [ ] 18.a — A gauge over its threshold is explained; none is expected
- [ ] 18.a — The options are listed, with the reason, and not chosen by the assistant
- [ ] 18.a — The decision carries the names of those who took it, and the date of the next quarterly assessment
- [ ] 18.a — Files touched per change is measured by the script; the three other signs are the team's answers, with their evidence
- [ ] 18.a — The record compares with the previous one and says what moved
- [ ] 18.b — `partition-patterns` replays `P-1`: the status of an invoice is coded as ruled, or the deviation with `file:line`
- [ ] 18.b — Patterns present in the code and absent from the grid are listed as questions, not faults
- [ ] 18.b — A row is added to `## Audits`; nothing changes in the code
- [ ] 18.c — `partition-hexagon` matches each layer's imports against its map, for each hexagon of `docs/partition.yml`
- [ ] 18.c — It reports forbidden dependencies, business decisions in adapters, use cases reaching a database without a port, domain files importing the framework, hexagons importing one another
- [ ] 18.c — Each finding has `file:line`, and a forbidden dependency its two layers
- [ ] 18.c — It says what it did not check, and why; no change
- [ ] 18.c — Whether the ArchUnit test was run is said; when it was, it agrees with the check, or the difference is a finding
- [ ] 18.d — The `spec-auditor` reads `docs/partition.yml` for the spec, area and code paths of `payment` (in `payment-app`), the spec, `billing/area.md` and the register, then the code
- [ ] 18.d — Each business rule and each contract is checked against the code; it reports and changes nothing
