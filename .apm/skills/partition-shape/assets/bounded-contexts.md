# Bounded contexts — <area>

> **Source:** `<path or URL of the source>`
>
> **Source version:** <info.version, or the version or date of the document>
>
> **Provenance:** YYYY-MM-DD · <sha of the source's commit, `uncommitted`, or `external` for a URL>
>
> **Scope:** <scope, or `whole source`>
>
> **Units covered:** <n> / <N>
>
> **Decided:** YYYY-MM-DD · <names> · <proposal: option n | workshop: <path of the result under paths.sources>>

The **Scope** line fixes the units analysed; the others appear in the `Coverage` table with the mention "out of scope". Change it only when a scope extension has been validated, or when the owner rewrites a scope that a change of the source made stale.

The **Provenance** line is the anchor of every later update: it fixes the exact state of the source this decomposition comes from. Never delete it; change it only together with the content it dates.

## Splitting criteria applied

<Reminder of the six criteria and of the decision rules R1–R6.>

## Bounded contexts retained

| Bounded context | Units                    | Criteria satisfied | Justification                        |
| --------------- | ------------------------ | ------------------ | ------------------------------------ |
| <bc-1>          | <operationId or anchor…> | C2, C4 (hint: C1)  | <one sentence, backed by the source> |

## Decisions not to split

| Units kept together | Criteria failing | Reason |
| --- | --- | --- |
| <operationId or anchor…> | C2 | <why the separation is not justified — R1: C2 fails, or C3, C4 and C5 all fail> |

## Alternatives rejected

| Split considered                    | Why rejected |
| ----------------------------------- | ------------ |
| <e.g. one bounded context per unit> | <reason>     |

## Kept against the criteria

| Point                                 | Criterion failing | Decided by | Date       | Reason                      |
| ------------------------------------- | ----------------- | ---------- | ---------- | --------------------------- |
| <bounded context, pair or attachment> | <e.g. C2 (R1)>    | <names>    | YYYY-MM-DD | <the architect's, as given> |

<When a point comes back: `references/boundary-decision.md` of `partition-shape`, _The record_. Write "None" when nothing was kept against the criteria.>

## Gaps detected

<Divergences between the source, the existing documentation of the area, the project's rules, the area rules and the INV- invariants. One line per gap, with the decision expected from the user. Couplings outside the scope are listed here too: shared data, out-of-scope units concerned; so is a rule found in two specs. Write "None" if the analysis found none. Never correct here.>

## Coverage

| Unit | Grouping | Bounded context |
| --- | --- | --- |
| <One line per unit of the source, in scope or not — this table proves that no unit was lost. An out-of-scope |
| unit carries "out of scope" in the Bounded context column.> |

## History

| Date | Version | Provenance | Nature | Detail |
| ---- | ------- | ---------- | ------ | ------ |
