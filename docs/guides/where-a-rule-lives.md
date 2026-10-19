# Where a rule lives

A walk through one example, step by step: four rules, and the file each one lands in. The words used here are explained in the [glossary](../../.apm/skills/partition-spec/references/glossary.md); the rule that decides is the table _Where a statement belongs_ of the `partition-spec` skill.

The same example is built from an empty folder, skill by skill, in [a project step by step](a-project-step-by-step/README.md); its step 08 reaches the state described here.

## The project

Two [areas](../../.apm/skills/partition-spec/references/glossary.md#the-levels), five bounded contexts:

| Area      | Bounded contexts               |
| --------- | ------------------------------ |
| `billing` | `invoice`, `payment`, `refund` |
| `catalog` | `product`, `price-list`        |

```text
docs/specs/
├── invariants.md                # the invariant register: what spans two areas or layers; read by every bounded context
├── billing/                     # a DDD subdomain (area) composed of 3 BCs
│   ├── bounded-contexts.md      # the decomposition record of billing into 3 BC: how its source was split; no rule
│   ├── area.md                  # the area file of billing: language and area rules shared by its bounded contexts
│   ├── invoice/spec.md          # the durable spec of invoice: its business rules, language, contract
│   ├── payment/spec.md          # the durable spec of payment
│   └── refund/spec.md           # the durable spec of refund
└── catalog/                     # a DDD subdomain (area) composed of 2 BCs
    ├── bounded-contexts.md      # the decomposition record of catalog; catalog has no area file
    ├── product/spec.md          # the durable spec of product
    └── price-list/spec.md       # the durable spec of price-list
```

Each bounded context names its area in `docs/partition.yml`. Its spec folder and its area file come from that name:

```yaml
paths:
  specs: docs/specs
  invariants: docs/specs/invariants.md

contexts:
  - id: invoice
    area: billing # reads docs/specs/billing/area.md and docs/specs/billing/invoice/spec.md
  - id: payment
    area: billing # reads docs/specs/billing/area.md and docs/specs/billing/payment/spec.md
  - id: refund
    area: billing # reads docs/specs/billing/area.md and docs/specs/billing/refund/spec.md
  - id: product
    area: catalog # catalog has no area.md, it reads docs/specs/catalog/product/spec.md
  - id: price-list
    area: catalog # catalog has no area.md, it reads docs/specs/catalog/price-list/spec.md
```

Of course, `invariants.md` is always read.

Without `area: catalog`, the durable specs of `product` and `price-list` would be expected in `docs/specs/product/spec.md` and `docs/specs/price-list/spec.md` respectively. An area is optional: it is a logical grouping, a subdomain, and needs no `area.md`. The area file is created only the first time its bounded contexts share a rule, after the owner validates it, as Step 2 shows for `billing`.

A context may set `spec:` to put its spec folder elsewhere, outside the repository for example; its area file still comes from `area`.

Four rules have to find a home:

|        | Rule                                                                  |
| ------ | --------------------------------------------------------------------- |
| Rule A | An issued invoice is never modified.                                  |
| Rule B | A customer under fraud review can neither pay nor be refunded.        |
| Rule C | Every amount is stored in minor units, with its currency.             |
| Rule D | "Cancelled" means one thing for an invoice and another for a payment. |

## The questions, in order

For each rule, ask:

1. **Is it true for every feature?** If it holds only for the feature at hand, it is an acceptance criterion and goes to the design of that feature. All four rules here are durable.
2. **Does one bounded context own it?** Then it lives in that bounded context's spec, and the others consume its result through its contract. Only a copy that another bounded context's own source states stays in its spec, reported as a duplicate, until that source is amended.
3. **Otherwise, which is the lowest level that holds it all?** One area: its area file. Several areas or layers: the invariant register, after its admission test.

The levels and their precedence are in the [hierarchy of rules](../../.apm/skills/partition-spec/references/glossary.md#the-hierarchy-of-rules).

## Step 1 — Rule A: one owner

"An issued invoice is never modified." `invoice` is the bounded context that issues invoices and enforces the rule. `payment` and `refund` only need to know whether an invoice is issued.

It is a business rule of `invoice`:

```markdown
<!-- docs/specs/billing/invoice/spec.md, Business rules -->

| BR-3 | An issued invoice is never modified. | An invoice is issued | Any change is refused | workshop, 2026-06-06 |
```

`refund` reads the status through the contract of `invoice`, and never the rule itself:

```markdown
<!-- docs/specs/billing/refund/spec.md, Contracts with neighbours -->

| invoice | consumed | the invoice API | the status of an invoice, the amount paid |
```

Nothing is copied into `payment` or `refund`. If the rule changes, one line changes.

## Step 2 — Rule B: shared within one area, no owner

"A customer under fraud review can neither pay nor be refunded." `payment` and `refund` must each refuse. Neither owns the fraud review; no bounded context of `billing` exposes it as a result the others could consume.

It is an area rule of `billing`, written once in its area file:

```markdown
<!-- docs/specs/billing/area.md, Area rules -->

| AR-1 | A customer under fraud review can neither pay nor be refunded. | A payment or a refund is asked for | It is refused | payment, refund | workshop, 2026-06-06 |
```

Each spec names it, without repeating it:

```markdown
<!-- docs/specs/billing/payment/spec.md and refund/spec.md, Applicable area rules and invariants -->

| AR-1 | a payment is refused while the customer is under fraud review |
```

It does not go to the register: it spans one area only, so it fails the second condition of the admission test. `product` and `price-list` never load it.

If later a `fraud` bounded context exposes "customer blocked: yes or no", a person names it the owner: the rule goes to its spec, and `payment` and `refund` consume the answer through its contract, as Rule A does. Until then the area file holds it. When the source of `payment` or `refund` also states the rule, that copy stays in its spec, reported as a duplicate, until its source is amended; the assistant moves nothing.

## Step 3 — Rule C: across areas

"Every amount is stored in minor units, with its currency." `invoice`, `payment` and `refund` store amounts; so does `price-list`, in the other area. No bounded context owns the way amounts are stored.

It goes through the admission test of the register:

| Condition                          | Rule C                                                  |
| ---------------------------------- | ------------------------------------------------------- |
| True for every feature             | yes                                                     |
| Spans at least two areas or layers | yes: `billing` and `catalog`                            |
| A defect when violated             | yes: an amount read in the wrong unit is a wrong amount |

All three hold. The assistant shows the line to the owner, who validates it; then it is written:

```markdown
<!-- docs/specs/invariants.md, DATA -->

INV-DATA-001 — Every amount is stored in minor units, with its currency.
```

Every spec that stores an amount names it under `Applicable area rules and invariants`.

## Step 4 — Rule D: the same word, two rules

"Cancelled" is not one rule shared by two bounded contexts. For an invoice, it means voided before payment, at no cost. For a payment, it means reversed within 24 hours. Two rules that share a word:

```markdown
<!-- docs/specs/billing/invoice/spec.md, Language -->

| Cancelled | Voided before any payment; no fee. |

<!-- docs/specs/billing/payment/spec.md, Language -->

| Cancelled | Reversed within 24 hours of the payment. |
```

Each rule stays in its own spec. The word is recorded in both `Language` tables, with its two meanings: that is what marks the boundary between the two bounded contexts. Nothing goes to the area file, and nothing merges the two rules because they look alike.

## Where each rule landed

| Rule | Lives in | Read by |
| --- | --- | --- |
| Rule A | `billing/invoice/spec.md`, `BR-3` | `invoice`; the others read its contract |
| Rule B | `billing/area.md`, `AR-1` | `invoice`, `payment`, `refund` |
| Rule C | `invariants.md`, `INV-DATA-001` | every bounded context |
| Rule D | `billing/invoice/spec.md` and `billing/payment/spec.md`, one rule each | each its own |

## What each bounded context pays

The [_Always_ gauge](../../.apm/skills/partition-spec/references/glossary.md#budget) of a bounded context counts what any of its tasks loads before reading code. Here, besides the instruction, the descriptions of the skills and its rule files:

| Bounded context                | Invariant register | Area file         | Its spec |
| ------------------------------ | ------------------ | ----------------- | -------- |
| `invoice`, `payment`, `refund` | yes                | `billing/area.md` | yes      |
| `product`, `price-list`        | yes                | none in `catalog` | yes      |

The budget script reads the `area:` of each context to find the area file it counts.

Rule B costs `catalog` nothing. Had it gone to the register, `product` and `price-list` would load a fraud rule that never concerns them.

## If two of them disagree

A rule of a lower level never contradicts one of a higher level. If a change to `payment` were about to accept a payment from a customer under fraud review, the assistant stops and flags it before writing code: either the change is a bug, or AR-1 must change, and that is the owner's decision, never an edit of AR-1 to match the code.
