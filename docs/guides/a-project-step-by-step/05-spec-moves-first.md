# Step 05 — Code and PRD disagree → the spec moves first

## The situation

The database refuses a second invoice for one order: that is BR-1, "An invoice is issued once per order", copied from REQ-1. Yet REQ-2 of the same PRD corrects an invoice by cancelling it and issuing a new one for the same order. Step 02 parked the contradiction under `Open questions`; the accountant now needs the correction, and only the PRD can say which requirement holds.

## What you bring

- [PO] The feature: _the accountant cancels an invoice before any payment, and issues its correction._
- [architect] The contract billing 1.1.0, [`docs/contracts/billing.openapi.json`](05-provided/docs/contracts/billing.openapi.json), in [`05-provided/`](05-provided/): `cancelInvoice` added.
- [PO] When the assistant asks which requirement holds: the amended PRD 1.0.1, [`docs/sources/billing.md`](05-provided/docs/sources/billing.md). Only REQ-1 changes: _an order has at most one invoice that is not cancelled._
- [architect] How BR-1 is held now that a cancelled invoice frees its order: _still by the database: a V2 migration moves the unique key to the invoices not cancelled._

The assistant asks many other questions along the way (is a cancel a modification, what the correction carries, is `ISSUED` an invoice neither paid nor cancelled). You answer them as the role would: that's your part.

## What you ask

Commit the contract, then the PRD, each alone before the prompt that reads it: its sha is what the delta starts from.

In a fresh session, so that the assistant applies the rule of the instruction without being reminded of it:

> Plan and build this feature: the accountant cancels an invoice before any payment, and issues its correction.

Once the product owner has given PRD 1.0.1:

> The billing PRD changed: REQ-1 now says which holds. Bring the specs in step with it.

When the writing plan is shown:

> Validated, area `billing`. Write the two patches.

Then the business analyst's instruction:

> Replace BR-1 with the new rule of REQ-1. I confirm it. Trigger: an issue for an order that already has an invoice that is not cancelled. Expected effect: refused, nothing is issued; of two issues of one order at the same moment, the second is refused.

After answering the plan's questions:

> Now plan and build the feature.

## What partition does

1. **It stops before any design.** The instruction applies: a rule copied from a source changes only through its source. The assistant finds the open question of step 02 and says which side is wrong: BR-1 is faithful to REQ-1; **the source contradicts itself**. It asks the owner of the PRD which requirement holds.
2. **It touches nothing meanwhile.** It does not drop the unique constraint "because the feature needs it", proposes no wording for BR-1, writes no spec and no code. A plan that opens is `blocked` on the product owner. The contract's new `409` reads one side, but a contract does not settle what its source contradicts.
3. **The delta.** `partition-shape` diffs the PRD from the sha recorded in `bounded-contexts.md`: REQ-1 modified, the rule changed, not the entity. The decomposition is unchanged, the normal case. It shows two patches (provenance, history) and waits for your validation. BR-1 is reported as a copied rule whose source changed, not rewritten.
4. **A person rewrites it.** On the business analyst's instruction, `partition-spec` writes BR-1 — "An order has at most one invoice that is not cancelled.", from source REQ-1 — shows the change and gets it validated. The open question leaves `Open questions` in the same change; the dated reason goes to `## Decisions` of the plan.
5. **The plan, the spec first.** `partition-plan` asks what the specs leave open, and your answers settle in the spec before any code: a change of status is not a modification (BR-3). How BR-1 is held in the database is the architect's to say.
6. **The attack.** `partition-attack` finds what the answers leave open (anyone may cancel; the correction cannot be found from the cancelled invoice); the person who owns each finding answers or accepts it.
7. **The code, then the closing.** A V2 migration moves the unique key (V1 is never edited); `cancelInvoice` cancels only an issued invoice. The gate may ask for a look at the running application; nothing goes to the register; the README is realigned for the cancel operation.

**Why it works this way.** The spec is what the code is checked against, so it moves first: when code and source disagree, the assistant names the side that is wrong and stops rather than bending the rule to fit the feature. A rule copied from a source changes only through its owner's amendment, and a person writes the new text.

## The shape after

```mermaid
flowchart LR
  classDef new stroke-width:3px
  classDef gone stroke-dasharray:5 5
  src_billing[/"docs/sources/billing.md · 1.0.1"/]:::new
  contract_billing[/"billing.openapi.json · 1.1.0"/]:::new
  subgraph app_commerce["commerce-app"]
    subgraph area_billing["billing"]
      invoice["invoice · rich<br/>Rule A · Rule C: Persistence · Rule D: open question<br/>≈ — tok"]
    end
  end
  db["H2 database"]
  cardpay(["CardPay"])
  src_billing --> area_billing
  contract_billing --> invoice
  invoice -- "charges, reverses" --> cardpay
  invoice -- "SQL" --> db
```

**New:** contract 1.1.0 and `cancelInvoice`; PRD 1.0.1; BR-1 rewritten by the business analyst; a V2 migration. The bounded contexts are unchanged.

**Cost:** the work stopped on a question until the product owner said which requirement holds.
