# Step 09 — A feature that contradicts an area rule stops before code

> **Session:** 📌 open a **fresh session.** The stop must come from the instruction and the area file, read by a session that was never told about fraud review.

## The problem

Sales want VIP customers to be able to pay even while under fraud review: it costs them orders.

## Before

Your `partition-commerce` project should be at the commit of step 08. `billing/area.md` holds AR-3: "A customer under fraud review can neither pay nor be refunded." `payment` applies it through its `FraudReview` port.

## Provided

`[PO]` passes you a request from sales, as it reaches the team: _our VIP customers must be able to pay even while under fraud review; it costs us orders._

## Prompt

Type:

> Plan and build this: a VIP customer can pay an invoice even while under fraud review.

## Expected

You should see the assistant apply the instruction (_Truth_) and `partition-spec` (BR-29): the work contradicts a rule of the area file. It **stops and flags it before writing code**:

- it quotes AR-3, its file and the bounded contexts it binds;
- it says the request is either a bug in the work or the reversal of a decision, and that **both are yours** to decide;
- it does not edit AR-3 to fit the request, does not add an exception in the code, and does not write a business rule of `payment` that would contradict the area file: a lower level never contradicts a higher one;
- if it opened a plan, the plan carries a blocker naming the product owner, and no task touches code.

Give the product owner's answer: _the request is dropped; AR-3 stands._ Nothing changes in `partition-commerce` but the plan, closed with that decision in `## Decisions`, or no plan at all.

### The shape after

Unchanged: the request stops before code. The figure is [step 08's](08-second-area.md#the-shape-after).

## Verdict

- [ ] It stops and flags the contradiction with an area rule before writing code
- [ ] It quotes AR-3, its file `billing/area.md` and the bounded contexts it binds
- [ ] It says the request is a bug in the work or the reversal of a decision, and that both are yours to decide
- [ ] AR-3 is not edited to fit the request
- [ ] No exception is added in the code
- [ ] No business rule of `payment` contradicts the area file
- [ ] If a plan was opened: it carries a blocker naming the product owner, and no task touches code
- [ ] After the PO's answer, nothing changes in `partition-commerce` but the plan, closed with that decision in `## Decisions`, or no plan at all
