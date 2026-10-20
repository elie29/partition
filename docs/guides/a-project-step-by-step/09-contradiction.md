# Step 09 — A request against Rule B → stopped before code

## The situation

`billing/area.md` holds AR-3, Rule B: "A customer under fraud review can neither pay nor be refunded." `payment` applies it through its `FraudReview` port. Now sales want VIP customers to pay even while under fraud review: it costs them orders.

## What you bring

- [PO] The request from sales, as it reaches the team: _our VIP customers must be able to pay even while under fraud review; it costs us orders._
- [PO] The answer, once the assistant puts the contradiction to you: _the request is dropped; AR-3 stands._

## What you ask

In a fresh session, so that the stop comes from the instruction and the area file, read by a session that was never told about fraud review:

> Plan and build this: a VIP customer can pay an invoice even while under fraud review.

## What partition does

1. **The level above is read first.** The instruction (_Truth_) and `partition-spec` read the area rules that bind `payment` before any code: the request contradicts AR-3.
2. **It stops before code.** It quotes AR-3, its file `billing/area.md` and the bounded contexts it binds.
3. **It names the two readings.** The request is either a bug in the work or the reversal of a decision, and both are yours, the owner's, to decide.
4. **It settles nothing itself.** It does not edit AR-3 to fit the request, add an exception in the code, or write a business rule of `payment` that contradicts the area file. If it opened a plan, the plan carries a blocker naming the product owner, and no task touches code.
5. **Your answer closes it.** Nothing changes but the plan, closed with that decision in `## Decisions`, or no plan at all.

**Why it works this way.** A lower level never contradicts a higher one (BR-29): a contradiction goes to the owner and is never settled by editing the higher level. Had the PO reversed Rule B, it would have changed as any behaviour does: through its source, the billing PRD, then the area file, then the code.

## The shape after

Unchanged: the request stops before code. The figure is [step 08's](08-second-area.md#the-shape-after).
