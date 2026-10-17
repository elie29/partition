# Taking over an existing spec

For a specification written before Partition: one large file, sections of its own, often a history of rulings at the end. Nothing here runs unless the owner asks, and nothing is deleted.

## 1. Read and map, write nothing

Read the existing file. Produce a table: each of its sections, the section of `assets/spec.md` it maps to, or `area file`, `register candidate`, `rule file`, `plan`, `stays as is`. Use the table "Where a statement belongs" of the skill. Add what the template asks and the file does not have (`Language`, `Business rules`, `Contracts with neighbours`, `Open questions`).

A section on how code is written maps to `rule file`, even when it binds every bounded context of an area: it becomes lines of a rule file through the `partition-rules` skill, scoped to the code paths of the bounded contexts it binds, never an area rule or a business rule.

Count the bounded contexts the file really describes, and the area each belongs to. One file covering several bounded contexts becomes one spec per bounded context; where the boundary is unclear, that is a question for the owner, not a split you decide.

A file of invariants, whatever its name, is a register, not a spec. Run each of its entries through the admission test (`references/invariants.md`): an entry local to one area is proposed for its area file, one local to one bounded context for its spec.

## 2. Present the plan and stop

Show the mapping, the files that would be created, the files left untouched, and every statement you could not place. Wait for an explicit validation.

## 3. Write

- Create each spec at its path (`SKILL.md`, _Durable spec_) from the template and move the mapped content into it, keeping the author's wording. Rewrite nothing for style.
- A history of rulings or a decision log is **not** copied into the spec. Keep it where it is, under a heading that says it is frozen (`## Annex — decision history (frozen)`), so its references stay resolvable. From now on the dated reason of a choice goes in the plan that produces it.
- Rulings that state a durable truth are candidates for the area file or the invariant register, at the level that holds them. Run each through the admission test (`references/invariants.md`) and report which pass. Write none without validation.
- A ruling whose rule one bounded context owns is proposed for the `Business rules` of that spec, sourced to the ruling and to the validation that named its owner; it is local to its owner (`references/invariants.md`, admission test). A copy of it in another spec that came from a source is reported: it changes only through its source.
- Leave the old file in place, with one line at its top pointing to the new specs. Removing it is the owner's decision.
- Declare the bounded contexts in `docs/partition.yml`, each with its area.

## 4. Report

Files written, files left intact, statements without a home, area file and register candidates and their verdict, and the `Business rules` and `Area rules` sections whose banner is still up.
