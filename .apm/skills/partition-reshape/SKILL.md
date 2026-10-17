---
name: partition-reshape
description: Reshape bounded contexts that exist - split one in two, merge two, remove one, move a unit between them - or promote a component to a container or a system. Use to prepare a boundary workshop, when an API, a feature or a change of the source leaves a bounded context empty or two of them too close, and once a boundary has been decided, to carry out the move.
license: MIT
---

# Reshaping: a move, not a rewrite

A reshape is paid once if it was prepared: every dependency behind an interface and an adapter, the architecture described in C4. A component can then become a container, and a container a system, without rewriting those who call it; two bounded contexts can become one, or one two, without rewriting the rest.

Where the boundary goes is decided by people, in Event Storming with the architect: the Big Picture workshop groups the domain events and delimits the bounded contexts; then Process Modelling designs the processes of each, or Software Design brings out the aggregates, validates the split and picks the type of integration. The team then builds the boundary into the code. You prepare, you propose or challenge when the architect asks, you carry out and you record. The architect decides where the line goes (`partition-shape`, `references/boundary-decision.md`); you never start a move on your own reading of a budget report.

A bounded context that does not exist yet is shaped from its source by `partition-shape`. This skill changes the ones that exist.

## The moves

| Move | What changes | Raised by |
| --- | --- | --- |
| Fission | one bounded context becomes two | a workshop, a budget assessment |
| Merge | two bounded contexts become one | the delta of a source (R6), a workshop, an API or a feature removed |
| Removal | a bounded context with nothing left goes | the delta of a source, an API or a feature removed |
| Move | a unit passes from one bounded context to another | the delta of a source (its root aggregate changed), a workshop |
| Promotion | a component becomes a container, a container a system | a budget assessment, a workshop |

Each move is validated by name before it starts; a general "go ahead" does not cover it.

## Before the decision: prepare the material

From the durable specs, the contracts and the last budget record of the bounded contexts in question:

1. List the domain events the specs and the contracts name, in the words they use.
2. List the words that carry two meanings inside a bounded context, or one meaning across two. A same word that changes meaning almost always marks a boundary: quote both uses with where each is found.
3. List what each coming feature needs to load against what it will load (from `docs/budget/`).
4. List the dependencies that do **not** go through an interface today, with `file:line`. They are the price of the move, to be paid before it.
5. List the business rules and the `Persistence` lines that both sides would need, each with the side that would own it, or "both" when each side must apply it itself.
6. For a merge, the contract between the two, and every other consumer of it.

Then ask the architect the way, as `partition-shape` says in `references/boundary-decision.md`: a workshop, with this material handed over as it is, or a proposal built on it. A promotion is not asked: it is not a boundary. When the request already names a workshop, hand the material over and stop; when it names a proposal, build the options. When the decision was already validated by name through `partition-shape` (a proposal of a delta), neither ask the way again nor challenge it again: carry it out.

## After the decision: the record

A workshop's result is saved under `paths.sources` and challenged first (`partition-shape`, `references/boundary-decision.md`). Each finding and its outcome go to the record's `## Challenge`.

Create `docs/architecture/reshapes/YYYY-MM-DD-<name>.md` from `assets/reshape-record.md`. Fill what was decided and by whom. What the workshop left open goes to the owner as questions, not into the record as guesses.

## Preconditions (all of them, or stop)

For a fission, a move and a promotion:

1. Every caller reaches the part to move through an interface.
2. One adapter implements that interface.
3. The contract between the two sides is written and frozen. During the move, the how can be discussed; what the contract says cannot.
4. For a fission, the new bounded context has its own durable spec and its own language (`partition-spec`). Each rule of the old spec goes where `partition-spec` sends it (_Where a statement belongs_): to the spec of the side that owns it, the other consuming its result through the contract; to the area file when both sides apply it in one area; to the invariant register when they sit in two areas and the rule passes its admission test. A rule is never copied into both specs. The rules that move leave the old spec in the same change.

For a merge: every caller of either half reaches it through its contract or an interface, and a person is named to carry the hand-written sections of the absorbed spec over. For a removal: nothing calls the bounded context any more, shown by a search of its contract and its code; the units it owned were removed, left the scope or moved.

A missing precondition is its own piece of work, with its own plan, before the move.

## Carry out

Through a plan (`partition-plan`), one step per task. The specs change as `references/specs.md` says, in the same plan as the code.

- **Fission, promotion, move.** Move the code behind the interface; the interface and its callers stay where they are. Replace the adapter by the one that speaks the frozen contract. Give the new bounded context what a bounded context owns: its spec, its rules with their scope. The moved code compiles and its tests pass: the real output of the verification command, next to the expected result (BR-15).
- **Merge.** Bring the code of the absorbed half behind the interfaces of the absorbing one. Remove the contract between them and its adapters; each call across it becomes a call inside the bounded context. The area rules only the two halves shared come down to the merged spec, and leave the area file.
- **Removal.** The spec is frozen first. The code is deleted only after the owner rules on it, in a step of its own.
- **Merge and removal.** The absorbed or ended bounded context stays declared in `docs/partition.yml`, with its area, as long as its spec folder exists; its entry is taken out once a person has deleted the folder.

Then prove it was a move. Write the expected result first: outside the moved or merged code, only the wiring changes. Run the command that lists the files changed and show its real output. A caller that had to change means a dependency did not go through the interface: stop and say so.

## Afterwards

- Update the C4 model and regenerate the views (`partition-c4`): the element changes kind and parent.
- Declare in `docs/partition.yml` the bounded context a fission creates, with its area.
- Measure again (`partition-budget`) and write the record of the day: a reshape made to bring a gauge down shows that it did.
- From now on the bounded contexts that remain know each other through their contracts only.
