# Change at any moment

The fourth journey: a bounded context that exists, with its durable spec and its code, meets a change. A behaviour has to change, or the code and the spec disagree; the source the context came from moves to a new version; a request arrives that a rule forbids; the scope recorded for a source has to grow; a rule enters the spec that the form of the code cannot hold. Each is a moment you will meet, at any point of a project's life, and in each the spec comes before the code. Why the spec is the truth is in [Why Partition](01-why-partition.md#the-durable-spec-is-the-truth); how a context is created from a source is in [Create a bounded context](04-create-a-bounded-context.md); how the code follows, through a plan, is in [Deliver through a plan](05-deliver-through-a-plan.md).

![Journey 4, change a bounded context: the spec moves first, then the code; never the spec edited to match the code because the code is what runs. Two ways in. First way, a behaviour has to change, or the code and the spec disagree: the assistant, with partition-spec, says which side is wrong and why (the spec incomplete, outdated or ambiguous, or the code a bug; when it cannot tell, it asks); it corrects the spec and shows it, and when a rule or an invariant is contradicted it stops before any code; a rule copied from a source changes only through its source; you validate the new spec; when the code is wrong instead, the spec stays and the code is fixed through a plan. Second way, the source moved to a new version: you commit the new version alone, under the same file name, overwritten; partition-shape reports what moved and what breaks, a diff of meaning from the recorded commit, each change breaking, additive or neutral, and the breaks set against the code; it checks whether the split still holds, where a unit joins a context or a new context, a move, a merge or a removal is proposed, never made; a hard stop where you validate each move by name, and no answer means no writing; then partition-shape updates the specs surgically, the derived sections regenerated, the hand-written ones kept, the new version and its commit recorded. In both cases the code follows through a plan with partition-plan, the dated reason in the Decisions of the plan and only the result in the spec, delivered as in journey 3.](../../assets/flow-4-change.svg)

In the figure, a blue step is the assistant with the skill it uses; an amber step is yours.

## The situation

A bounded context is built and delivered. Then something moves: a feature needs a behaviour the spec forbids, the product owner ships a new version of the PRD, sales ask for an exception to a rule, the scope you first decomposed has to grow, or a new business rule gives a thin module a state to protect. You want the change to land in the spec before it lands in the code, the rules people confirmed to change only through people, and the boundaries the architect drew to move only by the architect's decision.

The five moments below come from the guide's steps 05, 07, 09, 10 and 12. Each part of this article takes them in that order.

## What you bring

**When a behaviour has to change, or the code and the spec disagree.** The feature or the behaviour, from the person who owns it: in the guide, `[PO]` asks that the accountant cancel an invoice and issue its correction, which the database refuses because a rule copied from the PRD says an invoice is issued once per order. When the rule in the way was copied from a source, only the owner of that source can say which requirement holds: in the guide, `[PO]` amends the PRD, and you commit the new version alone, under the same file name. A person then rewrites the copied rule, with its trigger and its expected effect: in the guide, `[BA]`. A contract the feature implements is committed alone before the prompt that reads it, as every contract (in the guide, `[architect]` brings a new version with a cancel operation). The design questions the plan raises are answered by the role that owns each: in the guide, `[architect]` decides how the rule is held in the database.

**When a source moves to a new version.** The new version, as a file, committed alone under the stable name of the old one, which it overwrites: in the guide, `[PO]` brings PRD 1.1, with a new requirement and a rule added to an old one; a contract version brought by `[architect]` is committed the same way. If the change moves a boundary, the architect's choice of the way (a workshop or a proposal), then the decision and its reason: in the guide, `[architect]` retains a new bounded context against the option the proposal recommended. The code path of a new bounded context, from `[TL]`. The confirmation of every rule the new version states, from a person: in the guide, `[BA]`. And the answers to what the source leaves open: in the guide, `[PO]` says how billing learns that a customer is under fraud review, when the assistant asks instead of inventing a table or an API.

**When a request contradicts a rule.** The request, as it reaches the team: in the guide, `[PO]` passes on a request from sales that VIP customers may pay while under fraud review, which an area rule forbids. Then the answer of the person who owns the rule.

**When the scope extends.** The part of the source to add to the recorded scope: in the guide, the discount operations of the catalog contract, left out at the first decomposition. As for any new bounded context: the architect's way and decision, the code path from `[TL]`, the business rules from `[BA]`, and the form of the hexagon with its reason from `[architect]`.

**When a context changes form.** The new business rule, from a person: in the guide, `[BA]` gives _a product can be retired; a retired product is never reactivated_, to a module that was thin because its only rule checked an input. The feature that needs it, from `[PO]`.

**Your commits.** Between turns you commit; the assistant never does. In the guide, the spec is committed alone, before the code that follows it.

## What you say

**When a behaviour has to change, or the code and the spec disagree**, from the README's _Day to day_:

> This behaviour has to change.

or _"The code and the spec disagree."_ The disagreement may also show up inside a feature: in the guide, you only ask for the feature, and the stop comes from the assistant:

> Plan and build this feature: (the feature, in one sentence).

Once the owner of the source has amended it and you have committed it, the source has a new version (the next moment). Then the person who owns the rule rewrites it, in the guide's words:

> Replace BR-n with the new rule of REQ-n. I confirm it. Trigger: (what starts it). Expected effect: (what it does).

To look for disagreements without a change in hand, from the README's _Day to day_: _"Audit `<bounded-context>` against its spec."_ The `spec-auditor` agent reads the code of one bounded context against its spec, changes nothing and reports.

**When a source moves to a new version**, once it is committed alone, as the guide does:

> The `<source>` changed to `<version>`. Bring the specs in step with it.

or, from the README's _Day to day_, _"The contract moved to 1.5.0."_ or _"What does this change of the source break?"_ When the writing plan is shown, validate it, and each proposal by name:

> Validated. I validate the new bounded context `<name>` by name.

**When a request contradicts a rule**, nothing special: you ask for the work, as the guide does, and the stop comes from the assistant:

> Plan and build this: (the request).

**When the scope extends**, you may name the wider scope as if decomposing anew, as the guide does on purpose:

> Find the bounded contexts of `<source>`, area `<area>`, scope `<the recorded scope; the part to add>`.

When the assistant asks, answer:

> Extend the recorded scope with `<the part to add>`.

**When a context changes form**, you give the rule first, then the feature, in two prompts, as the guide does:

> Add this business rule to `<bounded-context>`: (the rule).
>
> Plan and build (the behaviour that needs it).

## What comes back

### The spec moves first: `partition-spec`

When a behaviour must change, or the code and the spec disagree, the always-on instruction sends the assistant to `partition-spec` before any code, even in a fresh session that was never told the rule. It:

1. **Says which side is wrong, and why.** A spec can be incomplete, outdated or ambiguous; the code can be a bug. When it cannot tell, it asks. It never edits the spec to match the code because the code is what runs.
2. **Corrects the spec, shows the change and gets it validated**, when the spec is the wrong side. When the code is wrong instead, the spec stays and the code is fixed through a plan.
3. **Only then realigns the code**, through the plan of the feature, delivered as in [journey 3](05-deliver-through-a-plan.md).
4. **Puts the dated reason in `## Decisions` of the plan.** The spec keeps the result, not the story.

**A rule copied from a source changes only through its source.** When the source contradicts itself, the assistant says so, asks the owner of the source which requirement holds, and proposes no wording for the copied rule. In the guide, the rule "An invoice is issued once per order" was copied word for word from REQ-1, and REQ-2 of the same PRD asks for a correction that issues a second invoice for the same order. The assistant says the spec is not wrong against its source: the source contradicts itself. It does not drop the unique constraint because the feature needs it, and it writes no spec and no code. A plan may open: it then holds the question as a blocker owned by the product owner, and `Resume at` waits on it.

Once the source is amended and its new version delivered (next moment), a person rewrites the rule. The assistant writes it on that person's instruction, shows it and gets it validated:

| #    | Rule                                                    | Source             |
| ---- | ------------------------------------------------------- | ------------------ |
| BR-1 | An order has at most one invoice that is not cancelled. | from source: REQ-1 |

An open question that the change answers leaves `Open questions` in the change that writes its answer, that answer being your word. Then the plan opens, or resumes, with the reason of the new rule in its `## Decisions`; the answers the plan's questions bring are settled in the spec first, and the code follows. A design choice the rule needs is asked, not chosen: in the guide, the assistant asks the architect how the rule is held in the database.

### A new version of a source: `partition-shape`, the delta

You commit the new version alone, under the same name. `partition-shape` finds the decomposition record of the area with the commit it was derived from, sees the source changed since, and runs the delta. It writes documentation only: never code, and never a change to the source.

- **What moved.** A diff of meaning from the recorded commit, restricted to the recorded scope. A stale recorded scope (a tag or operationId removed or renamed) stops the delta before anything else. Each change is classified before it is routed: **breaking** when it withdraws or tightens what was asked, **additive** when it only adds, **neutral** when only its wording changes. A breaking change is reported loudly, and the code is searched for it, read-only: an operation implemented that does not absorb the break is a code / spec divergence, raised to you, not fixed. In the guide, a rule added to paying takes it away from a customer under fraud review: breaking, and the code does not apply it yet.
- **Does the split still hold.** Each change lands in the bounded context that owns its unit. A new unit is weighed against the six criteria, as at the first decomposition: it joins a context, or a new bounded context is proposed. Every pair of contexts is then checked again; a pair that no longer stands apart is proposed for a merge, a context left without units is proposed for removal, a unit that changed its aggregate is proposed for a move. A point the architect kept against a criterion is not proposed again, unless the change touches the criterion it was kept against. A new context, a merge, a removal or a move moves a boundary: the assistant first tells the architect the decision is theirs and asks the way, a workshop or a proposal, as in [Create a bounded context](04-create-a-bounded-context.md#from-a-source-partition-shape-up-to-a-hard-stop). A change that does not move the decomposition is the normal case, and the assistant says so.
- **The hard stop.** The writing plan, before anything is written. For example, for an amended PRD:

  ```text
  Source             : docs/sources/billing.md
  Version            : 1.0 -> 1.0.1
  Base               : <sha of billing 1.0>
  Current            : <sha of billing 1.0.1>
  Scope              : whole source

  Delta:
    Units modified         : 1   REQ-1
  Classification:            the rule of REQ-1 changed
  Decomposition:
    Unchanged              : yes — the normal case
  Writing plan:
    ≈ docs/specs/billing/bounded-contexts.md      (patch: provenance, gaps, history)
    ≈ docs/specs/billing/invoice/spec.md          (patch: header lines, open question)
    = all the other files                         (intact)
  Copied from the source (word for word, to confirm):
    - invoice: BR-1, copied from REQ-1, changed by the source — reported, not rewritten
  ```

  It waits for an explicit validation; no answer, no writing. A new bounded context, a merge, a removal, a move, a scope extension or the rewrite of a stale scope is validated by name: a general "go ahead" does not carry it. A named choice carries the proposal; the writing plan is still shown.

- **The specs, updated surgically.** The derived sections are regenerated; the hand-written ones are added to, never replaced, reordered or emptied; the version and the commit of the source are recorded, and the history of the decomposition gains a line. A rule the new version **states** is copied word for word with its anchor, under the "TO VALIDATE" banner, until a person confirms it. A copied rule the source **changed or removed** is reported with its new wording, never rewritten: a person confirmed it, and a person rewrites it. A rule the source states for units of several bounded contexts of one area, with no owner among them, goes once to the area file, never into each spec; when a new context enters an area that has an area file, each area rule already there is proposed to bind it or not, with the reason, and its `Binds` waits for your agreement.
- **The closing report.** The files created, patched and left intact; the breaks and the code / spec divergences; the proposals still pending; the gaps; the specs and the area file whose banner stands, named **not usable** until a person confirms their rules; the candidates for the invariant register, with "no candidate retained" as the normal outcome; and the open questions that block the design.

A merge, a removal or a move you validate is not carried out here: the assistant tells you to run `partition-reshape` with the validated proposal, the [fifth journey](07-reshape-when-it-grows.md), and never chains into it. A source recorded from a URL cannot be compared: the assistant asks you what changed, or to save the new version as a file.

Then the code follows, through a plan. In the guide, the plan of the refund asks how billing learns that a customer is under review, rather than inventing a table or an API.

### A request that contradicts a rule: stopped before code

The always-on instruction and `partition-spec` hold it: when the work contradicts a business rule of the spec, a rule of the area file or an invariant of the register, the assistant **stops and flags it before writing code**. A statement lives at the lowest level that holds it all, and a lower level never contradicts a higher one. In the guide, a fresh session that was never told about fraud review:

- quotes the rule, the file that holds it and the bounded contexts it binds;
- says the request is either a bug in the work or the reversal of a decision, and that both are yours to decide;
- does not edit the rule to fit the request, adds no exception in the code, and writes no business rule of a context that would contradict the area file;
- if it opened a plan, gives it a blocker naming the product owner, and no task touches code.

In the guide, the product owner drops the request and the rule stands. Nothing changes in the project but the plan, closed with that decision in its `## Decisions`, or no plan at all.

When the owner reverses the rule instead, it changes as any behaviour does, the spec first. A rule copied from a source changes through its source: its owner amends the source, and the delta of `partition-shape` carries the change. A rule a person wrote changes through `partition-spec`, the owner validating the change. Only then does the code follow, through a plan.

### The scope extends: asked, never widened by itself

The scope recorded for a source never widens by itself: not to follow shared data, not for a neighbouring unit. When you ask for a decomposition with a scope that differs from the one recorded, `partition-shape` **stops and asks**: extend the recorded scope through the delta, or choose another target folder. It never overwrites, nor merges, a decomposition validated on another scope.

You choose the extension. The delta runs with it; when the source itself has not changed since the recorded commit, only the extension is handled. The units it brings are weighed against the criteria like any new unit; a new bounded context goes through the architect's way and decision, as above. At the hard stop, the extension and each new context are validated by name. Once written, the recorded scope reads the wider value, the coverage counts the new units, and a gap the extension resolves is marked resolved, with its date, never erased. A new context whose source states no rule keeps its "TO FILL" banner until a person writes them; an area rule already there is proposed to bind it, as for a new version.

From there it is a new bounded context like any other: the rules written by a person, the form of its hexagon chosen with its reason (in the guide, thin, which still keeps its ports: a use case never calls the database directly), then a plan.

### A context changes form: thin to rich, through the plan

First the spec. `partition-spec` writes the rule a person gives, with its source (the person and the date), shows it and gets it validated. No code changes in this step; you commit the spec alone.

Then the feature. `partition-hexagon` reads the new rule against its table: a status that moves under conditions, with a transition that is forbidden, calls for a **rich** form, a domain model. The change of form is:

1. **A decision**, recorded with its reason in `## Decisions` of the plan, and in `docs/partition.yml`: the hexagon becomes `form: rich`, its reason rewritten, a domain layer added to its layer map with what may depend on it.
2. **Carried out by the first tasks of the plan of the behaviour that needs it**, not by a plan of its own. Those tasks move the code the domain takes into a domain layer that depends on nothing outside it, and prove the move before anything is built on it: the expected result written first, no behaviour added or changed, the real output of the verification command, and the check of the layer map finding no dependency of the domain layer on anything outside it.

It is a change of form, not a promotion. The assistant does not add a "small check" in a use case of a thin module instead: a domain layer is not grown by accretion. In the guide, a build check written from the layer map needs no new rule: the generic rule checks the new layer.

## What you decide

- **Which side is wrong**, when the assistant cannot tell, and **every change of the spec**, which you validate before the code moves.
- **Which requirement holds**, when a source contradicts itself: the owner of the source decides and amends it. A copied rule is rewritten by a person, never worded by the assistant.
- **Each new version of a source**, committed alone under its stable name, and each writing plan the delta shows.
- **Every boundary that moves**: the way (a workshop or a proposal), then the decision, the architect's. Each new bounded context, merge, removal, move, scope extension and rewrite of a stale scope, by name; a named choice carries the proposal, the writing plan still shown.
- **Each rule a new version states**, confirmed or not, and each area rule proposed to bind a new context.
- **A request that contradicts a rule**: a bug in the work, or the reversal of a decision. Both are yours; the assistant does not settle either. A reversed rule changes through its source when it was copied from one, through `partition-spec` when a person wrote it.
- **The form of a hexagon**, with its reason, when a new rule calls for a change.
- **The design choices each plan asks**, from the role that owns each, and **every commit**.

A context that keeps growing through these changes is measured and split once, in the [fifth journey](07-reshape-when-it-grows.md).

## Go deeper

- [Step 05](https://github.com/elie29/partition/blob/main/docs/guides/a-project-step-by-step/05-spec-moves-first.md#the-shape-after): code and spec disagree, the source contradicts itself, the owner of the PRD settles it, a person rewrites the rule, then the plan and the code.
- [Step 07](https://github.com/elie29/partition/blob/main/docs/guides/a-project-step-by-step/07-new-bounded-context.md#the-shape-after): a new version of the PRD, a breaking change reported, a new bounded context retained by the architect, a rule shared by two contexts sent to the area file.
- [Step 09](https://github.com/elie29/partition/blob/main/docs/guides/a-project-step-by-step/09-contradiction.md): a request that contradicts an area rule, stopped before code.
- [Step 10](https://github.com/elie29/partition/blob/main/docs/guides/a-project-step-by-step/10-scope-extension.md#the-shape-after): the scope of a contract extended, a new thin bounded context.
- [Step 12](https://github.com/elie29/partition/blob/main/docs/guides/a-project-step-by-step/12-thin-to-rich.md#the-shape-after): a status rule enters a thin module, which becomes rich through the first tasks of its plan.
- [The durable spec is the truth](https://github.com/elie29/partition/blob/main/README.md#the-durable-spec-is-the-truth), in the README.
- The skills behind this journey: [`partition-spec`](https://github.com/elie29/partition/blob/main/.apm/skills/partition-spec/SKILL.md), [`partition-shape`](https://github.com/elie29/partition/blob/main/.apm/skills/partition-shape/SKILL.md) and its [delta](https://github.com/elie29/partition/blob/main/.apm/skills/partition-shape/references/delta.md), [`partition-hexagon`](https://github.com/elie29/partition/blob/main/.apm/skills/partition-hexagon/SKILL.md), [`partition-plan`](https://github.com/elie29/partition/blob/main/.apm/skills/partition-plan/SKILL.md), and the [`spec-auditor`](https://github.com/elie29/partition/blob/main/.apm/agents/spec-auditor.agent.md) agent.

Back to the [series](README.md).
