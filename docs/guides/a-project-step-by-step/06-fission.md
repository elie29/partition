# Step 06 — Paying, and "Cancelled" means two things → `payment` splits out

## The situation

`invoice` issues, reads, cancels and corrects invoices; nothing pays yet. Since step 02 its spec has carried an open question: "Cancelled" means one thing before a payment and another after it. Now the customer must pay by card, and paying is where the two meanings collide.

## What you bring

- [PO] The feature: _the customer pays an issued invoice by card_ (REQ-4). CardPay is not reachable from the demo: a port, with a fake adapter.
- [architect] The contract billing 1.2.0, [`docs/contracts/billing.openapi.json`](06-provided/docs/contracts/billing.openapi.json), in [`06-provided/`](06-provided/): one operation, `payInvoice`, under a tag of its own, `Payment`.
- [architect, PO, BA] The result of a boundary workshop, with their names under `Decided by`: `invoice` becomes `invoice` and `payment`, both in area `billing`; REQ-4 and REQ-5 go to `payment`; `payment` calls `invoice` in process through `InvoicePayments`, an interface frozen for the move; the `Persistence` line of `invoice` on amounts and the bound of BR-12 are needed by both sides, so they go to the area file.
- [architect] The answer to the challenge: _keep the fission as it is: "Cancelled" carries two meanings, and the PRD will name the payment._
- [BA] The language of `payment`: _Cancelled_ is "reversed within 24 hours of the payment".

The assistant asks many other questions along the way (what a payment records, who wins a pay and a cancel at the same moment). You answer them as the role would: that's your part.

## What you ask

> Plan and build this feature: the customer pays an issued invoice by card, through CardPay.

Once it is built, in a fresh session, so that the assistant examines code it did not just write:

> Prepare a boundary workshop on `invoice`: "Cancelled" means two things in it.

After the workshop, you paste its result, answer the challenge, then:

> Carry out the fission of `invoice`: `payment` comes out. I validate the fission by name.

## What partition does

1. **An ordinary plan first.** `partition-plan` builds paying inside `invoice`. What a payment holds goes to the spec; that the card token never appears in a log is how code is shaped, so it is shown to you as a rule-file line before it is written.
2. **The material, not a boundary.** `partition-reshape` reads the spec, the contract and the last budget record. It lists the domain events, quotes "Cancelled" where each meaning is found, and names, with `file:line`, the dependencies that do not go through an interface: paying and cancelling share one aggregate, one port, one row. Your request names a workshop, so it hands the material over and stops, proposing no boundary.
3. **The result saved, then challenged.** It saves the workshop's result under `docs/sources/` and waits for your validation; a missing name is asked, never guessed. Then `partition-shape` challenges it: `payment` has its own language and its own external system, but no root aggregate in the source: REQ-4 and REQ-5 both act on the invoice. It proposes one context, or the result as it is: the architect decides.
4. **The record.** A dated record under `docs/architecture/reshapes/`: who decided, the finding and why it was overruled, each rule and its home.
5. **The preconditions.** None is met (paying calls the aggregate directly, `InvoicePayments` does not exist), so the move waits. Your validation by name lets the move start once they are met; the precondition plan comes first, and the move plan carries it out.
6. **The precondition plan.** `InvoicePayments` written and frozen in `invoice` before anything relies on it. `billing/area.md` is created, each line shown before it is written: AR-1 the bound, AR-2 the amount line, word for word. `payment` gets its own spec; the rules of paying move to it, numbers kept, and leave `invoice`'s spec in the same change. "Cancelled" sits in both `Language` tables, each with its meaning.
7. **The move plan.** The code moves to `payment`'s packages, behind `InvoicePayments`. The proof: the expected result written first, then the real list of files changed outside `payment`. A caller of `invoice` that had to change stops the move.
8. **Afterwards.** `partition-c4` adds the component and its call; `docs/partition.yml` declares `payment`; `partition-budget` measures both contexts.

**Why it works this way.** People decide where a boundary goes; the assistant prepares, challenges and carries out. A move starts only once every caller goes through an interface, so only the wiring changes. And a rule is never copied into both specs: what both sides of one area apply lives once, in the area file.

## Worth noticing

- The challenge fails `payment` on a criterion, and the fission goes ahead anyway: it is recorded as kept against the criteria, with the names, the date and the reason. The next reader sees an overruled finding, not a forgotten one.

## The shape after

```mermaid
flowchart LR
  classDef new stroke-width:3px
  classDef gone stroke-dasharray:5 5
  src_billing[/"docs/sources/billing.md · 1.0.1"/]
  src_workshop[/"workshop-invoice-fission.md"/]:::new
  contract_billing[/"billing.openapi.json · 1.2.0"/]:::new
  subgraph app_commerce["commerce-app"]
    subgraph area_billing["billing"]
      invoice["invoice · rich<br/>Rule A · Rule D: voided<br/>≈ — tok"]:::new
      payment["payment · rich<br/>Rule D: reversed<br/>≈ — tok"]:::new
      file_billing[("area.md<br/>AR-1 · AR-2: Rule C")]:::new
    end
  end
  db["H2 database"]
  cardpay(["CardPay"])
  src_billing --> area_billing
  src_workshop --> area_billing
  contract_billing --> invoice
  payment -- "InvoicePayments" --> invoice
  payment -- "charges, reverses" --> cardpay
  invoice -- "SQL" --> db
  payment -- "SQL" --> db
```

**New:** `payment`, split out by the workshop; `billing/area.md`, where Rule C now lives as AR-2; the call `InvoicePayments`; CardPay, called from `payment`.

**Cost:** `invoice` and `payment` meet only through `InvoicePayments`, and both load the area file.
