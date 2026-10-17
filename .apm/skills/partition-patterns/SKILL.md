---
name: partition-patterns
description: Rule on a design pattern with the project's own grid, or audit the code against that grid. Use before introducing a pattern, an abstraction or a new layer, when two designs compete, and for a pattern or design review.
license: MIT
---

# Pattern grid

Code respects the SOLID principles and uses established design patterns where they fit the problem. A pattern is picked because the code needs it now, and it is named when it is applied. No pattern makes up for a fragile foundation, and a pattern nobody needed is something more for every later task to read.

The project keeps its rulings in one grid, `docs/architecture/patterns-grid.md`. Create it from `assets/patterns-grid.md` the first time a ruling is made. The criteria are the project's: the five shipped ones (need now, effect on the budget, cost of change, testability, security) are a starting point the owner edits.

## At design time: rule before writing

When a design is about to introduce a pattern, an abstraction, an extension point or a layer:

1. Read the grid. If a ruling already covers this place and this pattern, apply it and cite its number. Do not reopen it without something new.
2. Otherwise, state the problem in one sentence, without naming a pattern.
3. Set out the candidates, and always include **no pattern**: the plain code, written out.
4. Answer every criterion of the grid for each candidate, with facts from this code base: the two cases that exist today, the files a change touches with and without it, what a test needs to start. "More flexible" and "cleaner" are not answers.
5. Recommend one and say what would change your mind. The owner rules.
6. Add the ruling to the grid: where, pattern, ruling, one cell per criterion, reason, date. `no pattern` is a ruling like the others, and is recorded so the question is not asked again next month.
7. Put the dated reason and the candidates that lost in `## Decisions` of the plan.

A ruling that binds the whole project and whose breach would be a defect is a candidate for the invariant register: run it through the admission test (`partition-spec`).

## Audit: replay the grid

1. Take the rulings one by one, or those of the bounded context asked.
2. For each: find where it applies and check the code does what was ruled. `adopted` and absent, `rejected` and present, `conditional` outside its condition, `no pattern` and an abstraction grown anyway: each is a deviation.
3. Look also for patterns present in the code and absent from the grid: they were never ruled on. List them as questions, not as faults.
4. Report per ruling: conform, or the deviation with `file:line`. No finding without a line.
5. Add a row to `## Audits` of the grid: date, rulings replayed, conform, deviations.

Change nothing while auditing. A deviation is either code to realign or a ruling to revise; the owner says which, and when the departure goes beyond the scope of the current change you ask before refactoring.

## What to refuse

- A pattern justified by a case that does not exist yet.
- An interface with one implementation and no boundary to protect. A port in front of an adapter is not one of these: it has a boundary.
- A ruling without a reason, or a reason that is the pattern's name.
