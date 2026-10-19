# Reshape when it grows

The fifth journey: the bounded contexts exist, and the project keeps growing around them. A word starts to mean two things inside one context; a second source arrives and brings an area of its own; a new version of a source moves a unit, empties a context, or brings two too close; the team finds it always changes two contexts together; a part needs a release rhythm of its own; and, on its schedule, the budget is assessed. Each is a moment where a boundary may move, and in each the same order holds: Partition measures and prepares, the architect decides, a plan carries the move, and the move is proven a move. Why a split is paid once is in [Why Partition](01-why-partition.md#the-context-budget); how the architect decides a boundary when a source is first decomposed is in [Create a bounded context](04-create-a-bounded-context.md#from-a-source-partition-shape-up-to-a-hard-stop); how a new version of a source proposes a move is in [Change at any moment](06-change-at-any-moment.md#a-new-version-of-a-source-partition-shape-the-delta); how a plan carries work is in [Deliver through a plan](05-deliver-through-a-plan.md).

![Journey 5, split a context that grew: a split is a move, not a rewrite; people decide where the boundary goes, the assistant prepares, moves and records. A, measure: partition-budget, on its schedule ("Time for the quarterly budget review.") or sooner on a warning sign (more files per change, the same context explained again, regressions outside the scope, a rule reinvented), writes docs/budget/YYYY-MM-DD.md. B, why a gauge is over, and the options: partition-budget names the cause (a rule without a scope, a spec that describes two things, code that grew, a plan read whole) and shows the options without choosing one: scope a rule with partition-rules, trim the spec with partition-spec, hold a boundary workshop, promote, or nothing. C, you decide, with names and the date of the next review. D, prepare the decision, a workshop or a proposal: partition-reshape gathers the domain events, the words with two meanings, what each coming feature loads, and the dependencies not behind an interface with file and line; the architect picks the way: this material as it is, for a workshop, or a proposal built on it. E, you draw the boundary, in Event Storming with the architect, or validate a proposal; the decision and who took it are recorded under docs/architecture/reshapes/, and what the workshop left open comes back to you as questions. F, four preconditions, or stop: partition-reshape checks that callers go through an interface, one adapter implements it, the contract is frozen, and the new context has its own spec and language with each rule in one home, never in both specs; a missing one is its own plan, first. G, the move, through a plan: partition-reshape and partition-plan move the code behind the interface and replace the adapter; the proof that it was a move is that outside the moved code only the wiring changed, and a caller that had to change stops it. H, afterwards: partition-c4 and partition-budget update the C4 model and its views, declare the new context, and measure the budget again, so that a split made to bring a gauge down shows it did. The new context then lives through journeys 2, 3 and 4.](../../assets/flow-5-split.svg)

In the figure, a blue step is the assistant with the skill it uses; an amber step is yours.

## The situation

Your project has bounded contexts, each with its durable spec, and it grows. What reshapes it is not always a number. In the guide's project, no gauge comes near its threshold, 32 000 tokens, at any step: what reshapes it is language, new sources and workshops, not load. A word with two meanings splits a context; a second contract brings a second area; new versions of a contract move a unit and remove a context; workshops merge two pairs of contexts; a deployable's own rhythm promotes a component. The budget is still measured after every move and assessed on its schedule, and a gauge over its threshold is one more reason to look, which the guide does not reach.

`partition-reshape` lists what raises each move:

| Move | What changes | Raised by |
| --- | --- | --- |
| Fission | one bounded context becomes two | a workshop, a budget assessment |
| Merge | two bounded contexts become one | the delta of a source, a workshop, an API or a feature removed |
| Removal | a bounded context with nothing left goes | the delta of a source, an API or a feature removed |
| Move | a unit passes from one bounded context to another | the delta of a source (its root aggregate changed), a workshop |
| Promotion | a component becomes a container, a container a system | a budget assessment, a workshop |

Whatever raises it, you want the boundary to move only by the architect's decision, the move to cost a move and not a rewrite, and the specs to say where each rule lives afterwards.

The eight moments below come from the guide's steps 06, 08, 11, 13, 14, 15, 17 and 18. Each part of this article takes them in that order.

## What you bring

**When a word means two things: a fission.** The feature that brings the word's second meaning to light: in the guide, `[PO]` asks that the customer pay an invoice by card, and "Cancelled" means _voided before any payment_ of an unpaid invoice and _reversed within 24 hours_ of a paid one. Then the request for a workshop, and its result, in any readable form, from the people who held it: in the guide, `[architect, PO, BA]`, with their names written in `Decided by`; the assistant asks for them otherwise. The answer to each finding of the challenge, from the role that owns it: in the guide, `[architect]` keeps the fission against a criterion it fails, with a reason. The language of the new context, from `[BA]`. The design questions the plans ask, answered by `[architect]` and `[TL]`.

**When a second source arrives: a new area.** The source, committed alone before the prompt that reads it: in the guide, `[architect]` brings the catalog contract, which states one rule for every amount it carries, a rule billing already holds in its area file. The way of deciding the boundary, then the architect's choice and its reason. The code paths, from `[TL]`. The business rules the contract does not state, from `[BA]`. And your word on a statement found at two levels: in the guide, the area rule of billing leaves its area file once the same statement enters the invariant register.

**When a new version of a source moves a unit.** The new version, committed alone under the stable name of the old one: in the guide, `[architect]` brings catalog 1.1.0, where the price of a product is read within a price list. The way, and your validation of the move by name. The answers to the plan's questions, from `[architect]`.

**When the team changes two contexts together: a merge.** The result of the workshop, from `[architect, PO, BA]`: the move, why, what happens to the contract between the two, and the person who carries the hand-written sections of the absorbed spec over (in the guide, `[BA]`). After the merge, that person's carry-over, then the deletion of the absorbed context's folder, by hand.

**When a new version of a source empties a context: a removal.** The new version, committed alone: in the guide, catalog 2.0.0 drops the discounts, which move to another system. Your answer on the recorded scope, when a part of it no longer exists. The way, and your validation of the removal by name. The ruling on the code, from the owner: in the guide, `[PO]` says _delete it_. After the removal, the person who brings down what the area file now holds for one context alone, then deletes the emptied area file and the folder.

**When a part needs its own deployable: a promotion.** The decision, from `[architect, PO]`: in the guide, `payment` becomes a container of its own because CardPay's volumes and release rhythm differ from the rest. The contract that replaces the calls in process, written and frozen before the move, committed alone: in the guide, `[architect]` brings an internal HTTP contract that says what the two interfaces already say, and nothing more. The build, from `[TL]`. The answers on the data and on what each side records, from `[architect]` and `[TL]`.

**When the assessment is due.** The coming features, from `[architect, PO, BA]`: in the guide, invoice reminders, partial payments and product bundles. The answers of the people present to the three warning signs the script does not measure. And the decision, with the names of those who take it.

**Your commits.** Between turns you commit; the assistant never does. A source, a contract or a new version of either is committed alone, before the prompt that reads it.

## What you say

**To hold the assessment**, from the README's _Day to day_ or the guide:

> Time for the quarterly budget review.

or _"Hold the quarterly budget assessment."_

**To prepare a workshop**, naming the context and what you see in it, as the guide does:

> Prepare a boundary workshop on `<bounded-context>`: "`<word>`" means two things in it.

or, for a merge, _"Prepare a workshop on merging `<bounded-context-b>` into `<bounded-context-a>`."_ Once the workshop is held, you paste its result in the chat, give it a name when the assistant asks, and validate it.

**To carry out a move the architect decided**, you name it and validate it by name, as the guide does:

> Carry out the fission of `<bounded-context>`: `<new-bounded-context>` comes out. I validate the fission by name.

> Carry out the merge: `<bounded-context-a>` absorbs `<bounded-context-b>`. I validate the merge by name.

or, from the README's _Day to day_, _"We decided to extract billing"_, _"merge refund into payment"_. When a plan of preconditions comes first and is `done`, you resume with _"Resume the fission."_

**When a second source arrives**, as for any source:

> Find the bounded contexts of `<source>`, area `<area>`, scope `<scope>`.

**When a new version of a source proposes a move or a removal**, you bring the specs in step with it, as in [Change at any moment](06-change-at-any-moment.md):

> The `<source>` changed to `<version>`. Bring the specs in step with it.

When the assistant asks how to decide, answer _"A proposal."_ or _"A workshop."_ Once the proposal is validated by name, you ask for the move: _"Carry out the move of `<unit>` from `<bounded-context>` to `<bounded-context-to>`."_ or _"Carry out the removal of `<bounded-context>`."_

**After a merge or a removal**, once a person has done what was left to a person:

> The carry-over is done and the folder of `<bounded-context-b>` is deleted.

**To promote a component**, from a decision already taken:

> Prepare the promotion of `<bounded-context>` from a component to a container.

> Carry out the promotion of `<bounded-context>` to `<container>`. I validate it by name.

## What comes back

### The measure and the scheduled assessment: `partition-budget`

`partition-budget` measures one gauge per bounded context: what any task of it loads before reading code, that is what every session loads, the invariant register, the area file of its area, its spec and the scoped rules that match its code, against the project's threshold, 32 000 tokens by default. It quotes the script's output as it is, and never reports a gauge it did not run.

The assessment is held on a fixed schedule, `budget.review` in `docs/partition.yml` (the template says `quarterly`), not when symptoms appear: with the architect, the product owner or business analyst, and the team, over the next features to deliver. Four warning signs justify bringing it forward; they are triggers to look, not indicators to steer by:

- an ordinary change touches more and more files;
- the same context has to be explained again at every request;
- the assistant causes regressions outside the scope asked;
- the assistant reinvents a rule that already exists elsewhere.

The script measures the first. The three others are asked of the people present, and recorded with their evidence, or "not observed". Then, step by step:

1. **The output, unedited**, in the record of the day, `docs/budget/YYYY-MM-DD.md`. A second assessment the same day replaces that day's record; an earlier record is never overwritten: the series is the trend.
2. **For each coming feature**, what it needs to load against what it will load. If it must absorb more than it needs, a domain is leaving its circle.
3. **For each gauge over its threshold**, what makes it so: a rule without a scope, a spec that describes two things, code that grew, a plan read whole.
4. **The options, which the assistant does not choose**: scope or cut a rule (`partition-rules`), trim a spec of what the contract or the code already says (`partition-spec`), hold a workshop on a boundary and then prepare the move (`partition-reshape`), promote a component to a container or a container to a system (`partition-reshape`), or nothing, with the reason.
5. **The decision**, with the names of those who took it, and the date of the next assessment.

The record compares with the previous one and says what moved. In the guide, a quarter has passed: no gauge is over and none is expected at that size; one warning sign is observed with its evidence; the decision and the next date are recorded, and nothing else changes.

The same quarter, the guide reads the project from cold three more times, each in a fresh session and none changing code: _"Audit the code against the pattern grid."_ (`partition-patterns` replays each ruling and adds a row to its audits), _"Check the hexagons against their layer maps."_ (`partition-hexagon`) and _"Audit `<bounded-context>` against its spec."_ (the `spec-auditor` agent). The last two change no file.

The budget never starts a move by itself. `partition-reshape` never starts one on its own reading of a budget report: the architect decides where the line goes.

### Before a boundary moves: the architect decides

A fission, a merge, a removal and a move each move a boundary. Before one does, the assistant tells the architect the decision is theirs and asks the way, unless your request already names it:

- **A workshop.** `partition-reshape` gathers the material from the durable specs, the contracts and the last budget record of the contexts in question, and hands it over as it is, with no boundary: the domain events, in the words the specs use; the words that carry two meanings, each quoted with where it is found; what each coming feature needs to load against what it will load; the dependencies that do **not** go through an interface today, with `file:line`, which are the price of the move; the business rules and `Persistence` lines both sides would need, each with the side that would own it; for a merge, the contract between the two and every other consumer of it. Then it stops.
- **A proposal.** Two or three numbered options, each with the criteria it satisfies, the criterion it breaks, what it costs and what it brings, one recommended; the recommended one breaks no criterion. When the criteria leave a single option, it says so and why the others fall, and invents none.

A move a new version of a source proposed, and you validated by name at its hard stop, is neither asked again nor challenged again: `partition-reshape` carries it out. A promotion is not asked at all: it is not a boundary.

**The workshop's result** comes back in any readable form. It is saved under `docs/sources/`, under a name you give, shown and validated before anything else. Then it is **challenged**, point by point, against the source, the criteria, the material prepared, the invariant register, the area file and the specs. Each context the result names is checked against the criteria from the source alone; one that fails is a finding, whatever the result decides. Each finding comes with what it contradicts and an improvement; the assistant offers to take the result as it is, and the architect decides each one. "No finding" is a normal outcome. A point kept against a criterion is recorded with the criterion, the names, the date and the reason, and is not proposed again unless a later version of the source changes that criterion for its units.

**The record** of the reshape is created under `docs/architecture/reshapes/YYYY-MM-DD-<name>.md`. It says what was decided, on which date, by whom and from what (the workshop file, or the option chosen); what raised it; why here, with the words that change meaning across the line; each finding and its outcome; what crosses the boundary and under which contract; each rule and its one home; the preconditions; the proof; and what follows. What the workshop left open goes to you as questions, never into the record as guesses.

Each move is validated by name before it starts; a general "go ahead" does not cover it.

### The preconditions: all of them, or stop

For a fission, a move and a promotion:

1. Every caller reaches the part to move through an interface.
2. One adapter implements that interface.
3. The contract between the two sides is written and frozen: during the move the how can be discussed, what the contract says cannot.
4. For a fission, the new bounded context has its own durable spec and its own language. Each rule of the old spec goes to one home: the spec of the side that owns it, the other consuming its result through the contract; the area file when both sides apply it in one area; the invariant register when they sit in two areas and the rule passes its admission test. A rule is never copied into both specs, and the rules that move leave the old spec in the same change.

For a merge, every caller of either half reaches it through its contract or an interface, and a person is named to carry the hand-written sections of the absorbed spec over. For a removal, nothing calls the context any more, shown by a search of its contract and its code, and the units it owned were removed, left the scope or moved.

A missing precondition is its own piece of work, with its own plan, before the move. In the guide's fission, none is met at first: paying calls the aggregate directly, with `file:line`. Once you validate the fission by name, the assistant opens the plan of the preconditions itself.

### The move: through a plan, proven a move

The move goes through a plan (`partition-plan`), one step per task, and the specs change in the same plan as the code.

- **Fission, move, promotion.** The code moves behind the interface; the interface and its callers stay where they are. The adapter is replaced by the one that speaks the frozen contract. The moved code compiles and its tests pass, shown by the real output of the verification command next to the expected result.
- **Merge.** The code of the absorbed half comes behind the interfaces of the absorbing one. The contract between them and its adapters go; each call across it becomes a call inside the context.
- **Removal.** The spec is frozen first. The code is deleted only after the owner rules on it, in a step of its own.

Then the proof. The expected result is written first: outside the moved or merged code, only the wiring changes. The command that lists the files changed runs, and its real output is shown. A caller that had to change means a dependency did not go through the interface: the assistant stops and says so.

Afterwards, the C4 model is updated and its views regenerated (`partition-c4`); `docs/partition.yml` declares the bounded context a fission creates, with its area; and the budget is measured again, with the record of the day: a reshape made to bring a gauge down shows that it did. From then on the contexts know each other through their contracts only.

**No spec is deleted by the assistant.** A spec that loses its context is frozen under a banner; its folder stays until a person deletes it, once what it holds by hand has a new home; the context stays declared in `docs/partition.yml` until then. Nothing written by hand is copied by the assistant: a person carries it over.

### A word with two meanings: the fission

In the guide, "Cancelled" has meant two things in `invoice` since its spec was written. The material names the domain events (an invoice issued, cancelled, paid; a payment made, cancelled), quotes "Cancelled" where each meaning is found, and lists the dependencies outside an interface. Your request names a workshop: the way is not asked, and no boundary is proposed.

The workshop decides that `payment` comes out. The challenge finds that `payment` has its own language and its own external dependency, but no root aggregate of its own in the source; the architect keeps the fission against that criterion, and the record says so with the reason. Then two plans: the preconditions (the area file created for the rules both sides need, the interface between the two written and frozen, the spec of `payment` with its own "Cancelled" and the rules of paying moved with their numbers), then the move. The word now sits in two specs, each with its meaning: that is the boundary.

### A second source: a new area, and a rule that climbs

A second source in a new area is decomposed by `partition-shape`, as in [Create a bounded context](04-create-a-bounded-context.md): in the guide, the catalog contract gives two contexts, `product` and `price-list`, chosen from a proposal.

What is new is what the two areas share. The contract states that every amount is stored in minor units, with its currency, and billing's area file already holds that rule. A statement both areas hold spans them, so it goes to the admission test of the invariant register: true for every feature, spanning at least two areas or layers, a defect when violated. All three hold. The assistant shows you the line with its category and its identifier, and writes nothing until you validate it:

```markdown
INV-DATA-001 — Every amount is stored in minor units, with its currency. (from source: <the contract>, /info/description)
```

The same statement at two levels is a gap the assistant reports, never settles: on your word, the area rule leaves billing's area file, and billing's specs name the invariant instead.

The measure that follows shows what it costs: the register loads in every session, so every gauge grows by it, while an area file is paid only by its own area.

### A unit moves

In the guide, catalog 1.1.0 reads the price of a product within a price list. The delta of `partition-shape` classifies the rewritten path as breaking, reports that the code does not answer it, and, since the operation's root aggregate changed, proposes a move from `product` to `price-list`. Asked the way, you choose a proposal; the criteria leave a single option, and the assistant says so. You validate the move by name at the hard stop.

`partition-reshape` then carries it out without asking the way again: the record, the preconditions (the operation reached through its generated interface, one adapter, the contract frozen), one plan. The unit leaves one spec's derived sections and joins the other's; a rule only that unit carried moves with it, by a person. The call that crossed between the two contexts goes; the C4 model loses the relation; the budget is measured again.

### Two merges: one brings an area rule down, one goes against the criteria

In the guide, a workshop finds that a refund is always the reverse of a payment: the team changes both together. `payment` absorbs `refund`. The absorbing spec's derived sections are regenerated on the union of the units, its `Persistence` receives what it lacks, and **no business rule of the absorbed context is transferred by the assistant**. A banner says what a person still has to carry over:

```markdown
> **Status:** absorbed `refund` on YYYY-MM-DD. The hand-written sections of `../refund/spec.md` (objective, scope, language, business rules, dependencies, contracts with neighbours, invariants, questions) are to be carried over here by a human.
```

The absorbed spec is kept and frozen, its folder kept. The area rule only the two halves shared comes down to the merged spec, carried by a person, and leaves the area file. The contract between the two goes; the other contracts stay.

A second workshop finds that a price is never managed apart from its product: `product` absorbs `price-list`. This time the challenge reports a finding: the two still satisfy the criteria for being apart, and the merge reverses an earlier decision. You keep the merge; it is recorded against the criteria with the names, the date and the reason. No area rule comes down, since the only one binds a third context too, and the register does not change: a merge inside one area never moves a line of the register.

### A context with nothing left: the removal

In the guide, catalog 2.0.0 moves the discounts to another system. Before classifying anything, the delta finds that a part of the recorded scope no longer exists: it stops and asks how to rewrite the scope. Then the removal is **proposed, never executed**; the criteria leave a single option, and you validate it by name.

`partition-reshape` checks that nothing calls the context any more, with the search and its real output. The spec is frozen first, its hand-written sections intact, to be archived or reassigned by a person. The code is deleted only after the owner rules on it, in a task of its own; a new migration drops its table, and no merged migration is edited. What the area file now holds for one context alone is listed to come down, by a person; an area file left empty is deleted by a person, and its area then loads none.

### A part with its own rhythm: the promotion

In the guide, `payment` becomes a deployable of its own. A promotion is not a boundary: the bounded contexts do not change, so the way is not asked. The material lists the dependencies outside an interface (none, after the earlier moves) and the contracts that cross the line. With the internal contract frozen, the preconditions are met.

The plan moves the code into the new deployable, behind its interfaces, and replaces the adapters on each side by ones that speak the frozen contract; the interfaces and their callers do not change. The proof shows that outside the moved code only the wiring and the adapters changed. `partition-c4` records the element changing kind and parent, from a component to a container, and its relations becoming HTTP. The spec does not move: it keeps one home, read by both deployables. The budget is measured again: a promotion made to bring a gauge down shows that it did, or says it was made for another reason.

## What you decide

- **When to look**: the schedule of the assessment, and bringing it forward on a warning sign. You answer the signs the script does not measure.
- **Which option the assessment retains**, with the names of those who decide and the date of the next one. The assistant presents them; it never chooses.
- **Every boundary that moves**: the way (a workshop or a proposal), then the decision, the architect's. Each finding of a challenge, and each point kept against a criterion, with its reason.
- **Each move, by name**: a fission, a merge, a removal, a move or a promotion. A general "go ahead" does not carry it.
- **Each line of the invariant register**, and each statement found at two levels.
- **The design choices each plan asks**, from the role that owns each.
- **What only a person does**: carrying the hand-written sections of a spec over, bringing an area rule or word down to the spec that alone needs it, deleting a frozen spec's folder or an emptied area file, and ruling on the deletion of code.
- **Every commit.**

## Go deeper

- [Step 06](https://github.com/elie29/partition/blob/main/docs/guides/a-project-step-by-step/06-fission.md#the-shape-after): "Cancelled" means two things, a workshop, the challenge, the preconditions and the fission of `payment`.
- [Step 08](https://github.com/elie29/partition/blob/main/docs/guides/a-project-step-by-step/08-second-area.md#the-shape-after): a second source and a second area; a rule shared by two areas enters the invariant register.
- [Step 11](https://github.com/elie29/partition/blob/main/docs/guides/a-project-step-by-step/11-move.md#the-shape-after): a new version of a contract moves a unit between two contexts.
- [Step 13](https://github.com/elie29/partition/blob/main/docs/guides/a-project-step-by-step/13-merge-with-area-file.md#the-shape-after): a merge in an area with an area file; the shared rule comes down.
- [Step 14](https://github.com/elie29/partition/blob/main/docs/guides/a-project-step-by-step/14-merge-without-area-file.md#the-shape-after): a merge kept against the criteria; no area rule comes down.
- [Step 15](https://github.com/elie29/partition/blob/main/docs/guides/a-project-step-by-step/15-removal.md#the-shape-after): a new version of a contract empties a context; frozen first, code deleted on the owner's word.
- [Step 17](https://github.com/elie29/partition/blob/main/docs/guides/a-project-step-by-step/17-promotion.md#the-shape-after): a component becomes a deployable of its own.
- [Step 18](https://github.com/elie29/partition/blob/main/docs/guides/a-project-step-by-step/18-assessment.md): the scheduled assessment, the pattern audit, the hexagon check and the spec auditor.
- [Split a context that grew](https://github.com/elie29/partition/blob/main/README.md#5-split-a-context-that-grew), in the README.
- The skills behind this journey: [`partition-budget`](https://github.com/elie29/partition/blob/main/.apm/skills/partition-budget/SKILL.md), [`partition-reshape`](https://github.com/elie29/partition/blob/main/.apm/skills/partition-reshape/SKILL.md) and [what it writes in the specs](https://github.com/elie29/partition/blob/main/.apm/skills/partition-reshape/references/specs.md), [how a boundary is decided](https://github.com/elie29/partition/blob/main/.apm/skills/partition-shape/references/boundary-decision.md), and [`partition-c4`](https://github.com/elie29/partition/blob/main/.apm/skills/partition-c4/SKILL.md).

Back to the [series](README.md).
