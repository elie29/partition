# Feeding the invariant register

The register (`<invariants>`, `paths.invariants` in `docs/partition.yml`, default `<specs>/invariants.md`) is the project's single register of durable truths: statements that must hold whatever the feature. There is no separate decision log. The introduction of the register itself holds the entry format and the list of categories: read it before writing into it.

## Admission test (all three must hold)

An entry belongs in the register only if:

1. It is true for every feature, not only for the feature at hand.
2. It spans at least two areas or layers. A statement spans layers when it binds the same layers in every hexagon of the project. A statement local to one area goes to its area file; local to one bounded context, to its durable spec. A rule one bounded context owns is local to it, even when bounded contexts of other areas consume its result through its contract.
3. Violating it would be a defect, not a divergence of style.

If any of the three fails, the statement is placed by its object, as `SKILL.md` says (_Where a statement belongs_).

## What the register does not carry

The register holds the **what**, in the present tense, one line per statement. The dated **why** lives in the `## Decisions` section of the plan that produced it and in the history of the register file. Never turn the register into a chronological journal.

If the register ends with a frozen annex (the archive of a former decision log, kept so that old references stay resolvable), that annex is read-only: never rewrite it, never append to it.

## Procedure: at the end of a plan, and before a commit

1. List the statements the work actually established. The `## Decisions` section of the plan is the first place to look, then the specs, contracts and sources the work produced. Code alone never establishes one: a statement seen only in the code is a question for the owner.
2. Run each statement through the admission test. Most plans produce **zero** entries: that is the normal outcome, not a failure.
3. For each statement that passes, show the owner the line you would write, with its category and its identifier: the next `{NNN}` of its category, found by reading the highest existing number of that category. Write it only once the owner validates it, in the section of that category. A validation given to a line shown without its category and its identifier is no validation: show the line again, and write nothing, not even the register.
4. Before proposing, scan the existing entries of the same category: if the statement refines an existing invariant, propose to **rewrite that line** instead of adding a near-duplicate, unless that line was copied from a source.
5. Report in your answer which `INV-` identifiers were added or modified, and which candidates the admission test rejected.

## An entry copied from a source

An invariant a source states keeps the source's words and ends with `(from source: <anchor>)`. It is never rewritten, not even to make it more precise: when the source changes or removes it, report the change to the owner.

## Modifying or removing an invariant

- An invariant that becomes **more precise**: rewrite the line in place, keep its identifier.
- An invariant that becomes **false**: rewrite the line in place and record the reversal, with its date and reason, in the `## Decisions` section of the plan in progress.
- An entry copied from a source is the exception to both: it is never rewritten, its change is reported (above).
- Every change and every removal require **explicit validation by the owner**. Identifiers are permanent references; a removed one is not reassigned.
- Never invent an invariant to fill a gap. If a statement seems durable but is not established by a decision, a contract, a source or a spec, ask the owner instead of writing it.

## Contradiction found

If new work contradicts a line of the register, **stop and flag it to the owner** before writing code. A contradiction is either a bug in the work or the reversal of a decision. Both need the owner, and neither is resolved by editing the invariant to match the code.
