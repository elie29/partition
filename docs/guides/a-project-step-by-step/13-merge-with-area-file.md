# Step 13 — Refund is the reverse of payment → one bounded context

## The situation

Area `billing` holds `invoice`, `payment` and `refund`. `billing/area.md` keeps two area rules: AR-1, binding all three, and AR-3, Rule B, binding `payment` and `refund` only. `refund` reads `payment` through `PaymentRefunds`, and each has its own `FraudReview` port. At step 07 the decomposition rejected merging them; since then, the team changes both together, release after release.

## What you bring

- [architect, PO, BA] The result of the workshop, with their names under `Decided by`:
  - **Move:** merge, `payment` absorbs `refund`.
  - **Why:** a refund is always the reverse of a payment. The two share the amount paid and AR-3, which binds only these two: under R4, that sharing now prevails over the criteria that kept them apart, and reverses the decision that rejected this merge when PRD 1.1 was decomposed.
  - **Integration:** `PaymentRefunds` goes with the merge; `InvoicePayments`, from `payment` to `invoice`, stays.
  - **Carry-over:** the business analyst carries the hand-written sections of `refund` into `payment`.

The assistant asks other questions along the way. You answer them as the role would.

## What you ask

In a fresh session, so that the assistant finds the preparation of a merge from the description of `partition-reshape` alone:

> Prepare a workshop on merging `refund` into `payment`.

After the workshop, you paste its result, name the file `workshop-refund-into-payment.md` and validate it, then:

> Carry out the merge: `payment` absorbs `refund`. I validate the merge by name.

When the closing lists the carry-over, the BA carries the hand-written sections of `refund` into `payment`, Rule B with them, and deletes `refund`'s folder. Then:

> The carry-over is done and the folder of `refund` is deleted.

## What partition does

1. **The material of a merge.** `partition-reshape` gathers the events of both, the words with their meaning on each side, the rule they share (AR-3, binding exactly these two) and, for a merge, the contract between them and every other consumer of it: `PaymentRefunds`, consumed by `refund` only. It may recall that step 07 rejected this merge. You asked for a workshop: it proposes no boundary.
2. **Saved, then challenged.** The result is saved under `docs/sources/`, shown and validated. `partition-shape` challenges it: each half still passes R1 alone, but they share the amount paid and AR-3, a strong sharing R4 lets prevail over the split, and the result argues it: the merge stays inside the criteria. The challenge may report "No finding", or findings that do not question the merge, and offers to take the result as it is.
3. **The record.** A dated record under `docs/architecture/reshapes/`: the workshop file it was decided on, the challenge and its outcome, and AR-3 in its `Rules` table, from `billing/area.md` to `payment/spec.md`.
4. **The preconditions.** Every caller of either half goes through a contract or an interface; a person is named for the carry-over, the BA. Then one plan, specs and code together.
5. **`payment`'s spec grows, by derivation only.** Its derived sections are regenerated on the union of the units; `Persistence` receives the lines of `refund` it does not carry. Its hand-written sections stay as they are: no business rule is transferred by the assistant. A banner says what remains to carry over.
6. **`refund` frozen, not deleted.** Its spec is kept under a "merged into `payment`" banner, its folder kept: deleting it is a person's decision. `bounded-contexts.md` moves `refund` to `Decisions not to split`, the rejection of step 07 to `History`, REQ-6 to `payment`, with a `History` line of nature `merge`.
7. **The code.** `refund`'s use case, CardPay adapter and `FraudReview` port fold into `payment`'s: one port left. `PaymentRefunds` and its implementation go; `InvoicePayments` stays. The proof: outside the merged code, only the wiring changes.
8. **The closing lists what is a person's.** The hand-written sections of `refund` to carry over; Rule B, an area rule now left to one bounded context, to bring down into `payment`'s business rules, with the word "Under fraud review"; then `refund`'s folder to delete by hand.
9. **After the person.** The `payment` banner is removed; with the folder gone, `refund` leaves `docs/partition.yml` and the budget. `billing/area.md` keeps one rule, AR-1, binding `invoice` and `payment`, and stays.

**Why it works this way.** A merge is a boundary decision, the people's; the assistant prepares, challenges and carries out. Nothing written by hand is copied by the assistant: a person carries it over, and a rule that only one bounded context still applies comes down from the area file to its spec (BR-30).

## Worth noticing

- An area file with one rule left still stands. Only one left with no rule and no word is deleted, and by a person.

## The shape after

```mermaid
flowchart LR
  classDef new stroke-width:3px
  classDef gone stroke-dasharray:5 5
  src_billing[/"docs/sources/billing.md · 1.1"/]
  src_workshop[/"workshop-invoice-fission.md"/]
  src_workshop_refund[/"workshop-refund-into-payment.md"/]:::new
  contract_billing[/"billing.openapi.json"/]
  contract_catalog[/"catalog.openapi.json · 1.1.0"/]
  register[("invariants.md<br/>INV-DATA-001 · Rule C")]
  subgraph app_commerce["commerce-app"]
    subgraph area_billing["billing"]
      invoice["invoice · rich<br/>Rule A · Rule D: voided<br/>≈ — tok"]
      payment["payment · rich<br/>Rule B: a business rule · Rule D: reversed<br/>≈ — tok"]:::new
      refund["refund · rich<br/>≈ — tok"]:::gone
      file_billing[("area.md<br/>AR-1")]
    end
    subgraph area_catalog["catalog"]
      product["product · rich<br/>≈ — tok"]
      price_list["price-list · rich<br/>≈ — tok"]
      discount["discount · thin<br/>≈ — tok"]
      file_catalog[("area.md<br/>AR-1")]
    end
    yaml["application.yaml<br/>fraud-review list"]
  end
  db["H2 database"]
  cardpay(["CardPay"])
  src_billing --> area_billing
  src_workshop --> area_billing
  src_workshop_refund --> area_billing
  contract_billing --> invoice
  contract_catalog --> area_catalog
  payment -- "InvoicePayments" --> invoice
  payment -- "charges, reverses" --> cardpay
  payment -- "FraudReview" --> yaml
  invoice -- "SQL" --> db
  payment -- "SQL" --> db
  product -- "SQL" --> db
  price_list -- "SQL" --> db
  discount -- "SQL" --> db
```

**New:** `refund` merges into `payment`; Rule B comes down from the area file to a business rule of `payment`; one `FraudReview` port; `PaymentRefunds` gone. `billing/area.md` keeps AR-1 only.

**Cost:** `payment`'s spec carries what was `refund`'s: its gauge grows as `refund`'s disappears.
