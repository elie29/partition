---
name: partition-budget
description: Measure the Context Budget of each bounded context in tokens and record the assessment. Use for the scheduled review, when the assistant rereads too much, breaks things outside its scope or reinvents a rule, and after a split.
license: MIT
compatibility: Node.js 22 or later
---

# Context Budget

The budget is the tokens the assistant must absorb for a task. It is exceeded as soon as a task makes it load more context, data or business rules than the task needs. A bounded context is a context the assistant can hold in full; this skill measures whether that is still true, and records it. It does not decide where a boundary goes: people do.

## Configuration

Gauges read `docs/partition.yml`. If it is missing, or holds only what `partition-plan` wrote (its `paths.plans` stays), fill it from `assets/partition.yml` with the owner: the threshold (`budget.always`) and the schedule of the assessment (`budget.review`). Ask no bounded context and do not guess one from the folder tree: `contexts:` stays empty until `partition-shape` declares each bounded context it retains, or `partition-reshape` a fission's. The file keeps every key the answers leave alone, at its value and with its comment, so the owner sees each key when adjusting it by hand; only the example bounded context goes.

Rewrite the template's first line for the project's target, as its second line says: it then points the editor at `assets/partition.schema.json` as installed, the only list of the keys. `budget.mjs` checks the file against that schema before it measures, and lists every key it does not know.

## Measure

Run from the root of the project (`scripts/budget.mjs` stands for that file in this skill's folder):

```bash
node scripts/budget.mjs            # Markdown report
node scripts/budget.mjs --check    # same, exit 1 when a gauge is over its threshold
node scripts/budget.mjs --json
```

Tokens are estimated as characters / 4. The figure is stable from one run to the next, which is what a trend needs; it is not what a model would bill. Quote the output as it is. Never report a gauge you did not run.

## Read the report

- **Loaded by every session** — the entry file of the assistant, the instruction of the package, every rule file without a scope, the invariant register and the descriptions of the installed skills and agents. Paid before any work starts. A rule listed here "without a scope" is the first thing to fix: see `partition-rules`. The instruction carries no scope by design: it is not a rule file.
- **Always**, per bounded context — the one gauge: the every-session total, plus the durable spec of the bounded context, plus the area file of its area, plus the scoped rules that match its code. It is what any task in that bounded context loads before reading a line of code. The code itself is not counted: no task reads all of it. Default threshold: 32 000.
- **Plans in progress** — the whole file against what a resume reads. A plan is never read whole.
- **Files touched per change** — the median over the last 30 commits against the 30 before: the first warning sign, measured.

The threshold is the project's, in `docs/partition.yml`. The first real assessment corrects the defaults.

## The assessment

It is held on a fixed schedule (`budget.review` in `docs/partition.yml`), not when symptoms appear: with the architect, the product owner or business analyst, and the team, over the next features to deliver. Between two assessments, four warning signs justify bringing the next one forward. They are triggers to look, not indicators to steer by:

- an ordinary change touches more and more files;
- the same context has to be explained again at every request;
- the assistant causes regressions outside the scope asked;
- the assistant reinvents a rule that already exists elsewhere.

The script measures the first. The three others are observed: ask the people present, and record their answer with its evidence, or "not observed".

Procedure:

1. Run the script. Paste its output, unedited, into the record of the day, `docs/budget/YYYY-MM-DD.md`, made from `assets/assessment.md`. One record per day, named by its date: a second assessment the same day replaces that day's record. The record of an earlier day is never overwritten: the series is the trend.
2. For each feature that is coming, write what it needs to load and what it will load. The question is the budget's: to deliver this, must the assistant absorb more than the feature needs? If yes, a domain is leaving its circle.
3. For each gauge over its threshold, say what makes it so: a rule without a scope, a spec that describes two things, code that grew, a plan read whole. Read the reshape records under `docs/architecture/reshapes/`: a fission, a merge, a removal or a move may explain it.
4. Present the options. You do not choose among them:
   - scope or cut a rule (`partition-rules`);
   - trim a spec of what the contract or the code already says (`partition-spec`);
   - hold a workshop on a boundary, then prepare the move (`partition-reshape`);
   - promote a component to a container, or a container to a system (`partition-reshape`);
   - nothing, with the reason.
5. Record the decision with the names of those who took it and the date of the next assessment.

Compare with the previous record when there is one, and say what moved.
