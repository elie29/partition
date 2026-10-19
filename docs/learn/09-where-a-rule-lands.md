# Where a rule lands

Every journey of this series places rules: a source decomposed, a plan closed, a new version of a source brought in, a context split or merged. This article gathers what they share: the levels a rule can live at, the test that admits one to the top level, who places a rule and who validates it, and how one rule climbs, or comes down, as the set of bounded contexts that need it changes. Why a durable spec is the truth is in [Why Partition](01-why-partition.md#the-durable-spec-is-the-truth); this article says where in the specs each truth goes.

## The levels

A durable rule has one home, at one level. The [hierarchy of rules](https://github.com/elie29/partition/blob/main/.apm/skills/partition-spec/references/glossary.md#the-hierarchy-of-rules) has four, and the plan keeps what is not yet, or never, durable:

| Level | Statement | Lives in | Binds, or is read by |
| --- | --- | --- | --- |
| Project | Invariant, `INV-{CAT}-{NNN}` | the invariant register, `docs/specs/invariants.md` by default | every area and layer it spans; every bounded context reads it |
| Area | Area rule, `AR-n` | the area file, `docs/specs/<area>/area.md` | the bounded contexts of its area, and only them |
| Bounded context | Business rule, `BR-n` | the durable spec, `docs/specs/<area>/<bounded-context>/spec.md` | one bounded context; the others consume its result through its contract |
| Feature | Acceptance criterion | the design of the feature | one feature, checked once; never durable |

Beside them, the plan of a feature holds progress, tasks, blockers and the dated reason for each choice, under `## Decisions`. A choice made while building a feature is born there; what survives the feature leaves it at the closing, and the reason stays.

Two kinds of rules stand outside the hierarchy. How code is written here is a line of a project rule file, scoped to the code it binds, however many bounded contexts it reaches: never a business rule, never an area rule. And the decision rules R1–R6 say how a source is split; they are part of the package, not of your specs.

An area is optional, and so is its area file: it is created the first time its bounded contexts share a rule or a word, once you validate that entry. The register is optional too: it is created the first time an invariant is admitted.

## The questions, in order

For each rule, the same three questions, as the `partition-spec` skill places a statement:

1. **Is it true for every feature?** If it holds only for the feature at hand, it is an acceptance criterion and goes to that feature's design. A dated choice and its reason stay in the plan.
2. **Does one bounded context own it?** Then it lives in that bounded context's spec, and the others consume its result through its contract. Nothing is copied into them; if the rule changes, one line changes. Only a copy that another bounded context's own source states stays in its spec, reported as a duplicate, until that source is amended.
3. **Otherwise, which is the lowest level that holds it all?** Shared by the bounded contexts of one area, with no owner among them: its area file. Spanning at least two areas or layers: the invariant register, after its admission test.

A statement goes to the lowest level that holds it all. A rule placed too high costs bounded contexts it never concerns; a rule placed too low is written twice.

Before writing a rule or a word to an area file, the assistant reads the area files and the specs of the other areas. A statement another area already holds spans two areas: it goes to the admission test of the register, not to an area file, and the assistant reports the file and the identifier that hold it. Nothing is moved.

A word is not a rule. A word shared by the bounded contexts of an area goes once to its area file. A word that means something else in a neighbouring bounded context is written in both specs, each with its meaning: that is what marks the boundary, and nothing merges the two because they look alike.

## The admission test

A statement enters the invariant register only if all three conditions hold:

1. It is true for every feature, not only for the feature at hand.
2. It spans at least two areas or layers. It spans layers when it binds the same layers in every hexagon of the project. A rule one bounded context owns is local to it, even when bounded contexts of other areas consume its result through its contract.
3. Violating it would be a defect, not a divergence of style.

If any of the three fails, the statement belongs elsewhere: the area file of an area, the durable spec of a bounded context, a rule file of the project, an API contract, a schema document, or the plan. Most plans admit nothing to the register: that is the normal outcome, not a failure.

The register holds the what, one line per statement, in the present tense. The dated why lives in the plan that produced it. An invariant that becomes more precise is rewritten in place and keeps its identifier; an identifier removed is never reused; an entry copied from a source keeps the source's words and is never rewritten: its change is reported to you.

## Who places a rule, and who validates it

The level is decided by the table _Where a statement belongs_ of `partition-spec`, which the other skills use: `partition-shape` when it copies the rules a source states, `partition-plan` at the closing of a plan, and `partition-reshape` in a fission or a merge. The assistant proposes the level; a person decides what is written.

| Level | Who writes the rule | Who validates it |
| --- | --- | --- |
| The plan, `## Decisions` | the assistant, before it replies, every decision taken in the conversation, with its date, its reason and the alternatives that lost | no validation of its own: it records what people decided; a decision that lives only in the chat did not happen |
| The durable spec | a person, or the assistant copying word for word a rule a source states, marked "from source" with its anchor, under a "TO VALIDATE" banner | a person confirms the rules and removes the banner; a change to a spec is shown and validated before the code follows |
| The area file | the same as a business rule: by a person, or copied from a source that states it | the owner, before anything is written: each rule and each word shown as it would be written, every column and the file it goes to |
| The invariant register | the assistant shows the line, with its category and its next identifier | the owner, before anything is written, the register itself included; every change and every removal too |

No business rule, area rule or invariant is ever deduced from a source, a field name, an example or the code. A statement seen only in the code is a question for you. A rule copied from a source changes only through its source: when the source contradicts itself, the assistant says so and asks the owner of the source which requirement holds, and proposes no wording.

The assistant writes a rule at a new level only once the owner validates it: in the guide, Rule C reaches the area file once you validate its draft, and the register once you validate its line. Some cases it reports and leaves to a person:

- **A statement another area already holds.** It spans two areas: it goes to the admission test of the register, and the file and the identifier that hold it are reported; nothing is moved.
- **The same statement at two levels.** A gap the assistant reports, never settles: it leaves the lower level on your word.
- **An area rule after a merge, a removal or a move.** One that now binds a single bounded context comes down to its spec, carried by a person; an area file left empty is deleted by a person.
- **A rule found twice.** A rule a source states that a spec already holds is reported, never moved by the assistant. When a spec of another area holds it, it is a candidate for the admission test; when it fails it, a person names the owner, and `partition-spec` writes it into that owner's `Business rules`.

## When a rule is placed

There is no separate moment for it. A rule finds its level wherever the work establishes one:

- **When a bounded context is created.** `partition-shape` copies the rules a source states; one the source states for units of several bounded contexts of one area, with no owner among them, goes once to the area file. A copied invariant enters the register only through the admission test; one that fails it becomes an area rule or a business rule. See [Create a bounded context](04-create-a-bounded-context.md#what-is-written-once-you-validate), and [a spec written before Partition](04-create-a-bounded-context.md#a-spec-written-before-partition-decomposed-as-a-source), decomposed like any other source.
- **When a plan closes.** `partition-plan` lists every statement the work established, `## Decisions` first, and sends each to its level, a statement already written into a spec during the work included: its level is checked then, not assumed. The assistant reports the `AR-` and `INV-` entries added or changed and the candidates rejected; zero is the normal outcome. See [the closing](05-deliver-through-a-plan.md#the-closing-started-by-the-last-tick).
- **When something changes.** A new version of a source brings its rules under the same placement; when a new bounded context enters an area that has an area file, each area rule is proposed to bind it or not, with the reason, and waits for your agreement. A request that contradicts a rule is stopped before code. See [a new version of a source](06-change-at-any-moment.md#a-new-version-of-a-source-partition-shape-the-delta) and [a request that contradicts a rule](06-change-at-any-moment.md#a-request-that-contradicts-a-rule-stopped-before-code).
- **When a boundary moves.** `partition-reshape` gives, in a fission, each rule both sides need one home, in the same change: the spec of the side that owns it, the area file when both sides apply it in one area, the register when they sit in two areas and the rule passes its test; never both specs. A merge brings down to the merged spec the area rules only its two halves shared. See [Reshape when it grows](07-reshape-when-it-grows.md#a-word-with-two-meanings-the-fission).

## The ladder of Rule C

The [step-by-step guide](https://github.com/elie29/partition/blob/main/docs/guides/a-project-step-by-step/README.md#the-ladder-of-rule-c) follows one rule through every level: _"Every amount is stored in minor units, with its currency."_ It climbs each time because the set of bounded contexts that need it grows.

| Step | Who needs it | It lives in | Why there | Where the series shows it |
| --- | --- | --- | --- | --- |
| 04 | the feature being built | the plan, `## Decisions` | decided by the architect while designing it, with its date, its reason and what lost (a decimal column) | [Deliver through a plan](05-deliver-through-a-plan.md#every-turn-the-plan-first-then-the-reply) |
| 04 | `invoice`, the only bounded context | `billing/invoice/spec.md`, under `Persistence` | true for every feature, but one area only: at the closing it fails the admission test and stays in the spec; the reason stays in the plan | [the closing](05-deliver-through-a-plan.md#the-closing-started-by-the-last-tick) |
| 06 | `invoice` and `payment`, no owner | `billing/area.md`, AR-2 | a fission: both sides store an amount, in one area, so it climbs word for word to the area file, created once you validate its draft | [the fission](07-reshape-when-it-grows.md#a-word-with-two-meanings-the-fission) |
| 08 | `billing` and `catalog` | `invariants.md`, `INV-DATA-001` | the catalog contract states it, and billing's area file already holds it: it spans two areas, passes the admission test, and you validate the line | [a new area, and a rule that climbs](07-reshape-when-it-grows.md#a-second-source-a-new-area-and-a-rule-that-climbs) |

At step 08 the line copies the contract's words, with its anchor:

```markdown
<!-- docs/specs/invariants.md, DATA -->

INV-DATA-001 — Every amount is stored in minor units, with its currency. (from source: <the contract>, /info/description)
```

The same statement is then at two levels. The assistant reports it and does not settle it: on your word, AR-2 leaves billing's area file, its identifier never reused, and billing's specs name `INV-DATA-001` under `Applicable area rules and invariants` instead. What AR-2 said and no other file holds is reported, and the code that cites AR-2 is listed and left unchanged until the tech lead answers.

## Rule B, the other way

_"A customer under fraud review can neither pay nor be refunded."_ Rule B goes the other way, each time because the bounded contexts that hold it change.

| Step | What happens | It lives in | The mechanism, in the series |
| --- | --- | --- | --- |
| 07 | a new version of the PRD states it for paying and for refunding, two bounded contexts of `billing`, neither owning the fraud review | `billing/area.md`, an area rule copied from the source, binding `payment` and `refund` | [a new version of a source](06-change-at-any-moment.md#a-new-version-of-a-source-partition-shape-the-delta) |
| 13 | `refund` merges into `payment`: one bounded context needs it | a business rule of `payment`, carried by a person, with its source anchor; it leaves the area file | [the merges](07-reshape-when-it-grows.md#two-merges-one-brings-an-area-rule-down-one-goes-against-the-criteria) |
| 16 | a spec written before Partition, decomposed as a source, states the same rule in a ruling, and `fraud` exposes whether a customer is blocked | reported as a candidate for the admission test, which it fails; then the spec of `fraud`, its owner, named by a person, written by `partition-spec`; `payment` consumes the answer through its contract, and keeps its own copy, reported as a duplicate until its source is amended, since a rule copied from a source changes only through its source | [a spec written before Partition](04-create-a-bounded-context.md#a-spec-written-before-partition-decomposed-as-a-source) |

At step 16 the rule spans two areas, `customer` and `billing`, yet it does not go to the register: it has an owner, and a rule with an owner lives in the owner's spec.

## What each level costs

The level is also a price. The _Always_ gauge of a bounded context counts what any of its tasks loads before reading code: every session, the invariant register, the area file of its area, its spec and the scoped rules that match its code.

- **The register** is paid by every bounded context of the project. When Rule C reached it, every gauge grew by it.
- **An area file** is paid by its own area only. While Rule B was an area rule of `billing`, it cost `catalog` nothing; had it gone to the register, every context of `catalog` would load a fraud rule that never concerns it.
- **A spec** is paid by its own bounded context only.

That is why a statement goes to the lowest level that holds it all, and why the area file and the register are kept small.

## When two levels disagree

A lower level never contradicts a higher one. When the work contradicts a business rule of the spec, a rule of the area file or an invariant of the register, the assistant stops and flags it before writing code: either the work is a bug, or the rule must change, and that is the owner's decision. It is never settled by editing the higher level to match the code. See [a request that contradicts a rule](06-change-at-any-moment.md#a-request-that-contradicts-a-rule-stopped-before-code).

## Ask the files

Where a rule lives is read from the files, not from a memory of the work. In a fresh session, the guide asks:

> For Rules A, B, C and D of `docs/guides/where-a-rule-lives.md` in the Partition repository, say where each lives in this project, and which bounded contexts load it.

On your own project, name your rules instead of the guide's. The answer comes from the specs, the area files and the register, each rule with its path. Through twenty steps, the guide checks that no rule was written twice but a copy a source states, none was deduced, none was moved by the assistant where a person had to move it, and none was settled by editing the higher level.

## Go deeper

- [Where a rule lives](https://github.com/elie29/partition/blob/main/docs/guides/where-a-rule-lives.md): four rules and the file each lands in, step by step, with what each bounded context pays.
- [The ladder of Rule C](https://github.com/elie29/partition/blob/main/docs/guides/a-project-step-by-step/README.md#the-ladder-of-rule-c), in the guide's index.
- [Step 19](https://github.com/elie29/partition/blob/main/docs/guides/a-project-step-by-step/19-where-each-rule-landed.md#the-shape-after): where each rule landed at the end of the guide, read from the files.
- [The levels](https://github.com/elie29/partition/blob/main/.apm/skills/partition-spec/references/glossary.md#the-levels) and [the hierarchy of rules](https://github.com/elie29/partition/blob/main/.apm/skills/partition-spec/references/glossary.md#the-hierarchy-of-rules), in the glossary.
- The skill behind the placement: [`partition-spec`](https://github.com/elie29/partition/blob/main/.apm/skills/partition-spec/SKILL.md), its table _Where a statement belongs_, and [the admission test of the register](https://github.com/elie29/partition/blob/main/.apm/skills/partition-spec/references/invariants.md).

Back to the [series](README.md).
