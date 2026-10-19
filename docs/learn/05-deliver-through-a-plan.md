# Deliver through a plan

The third journey: a feature of a bounded context whose spec is fit for design, carried out through one plan that holds the state of the work, resumed from the plan alone after a break or a cleared session, and closed through a gate. Why the state lives in the plan and not in the chat is in [Why Partition](01-why-partition.md#the-state-is-in-the-plan-not-in-the-chat); where the plan lives is in [the repository map](02-repository-map.md#docsplans-the-state-of-the-work); the plans folder itself is settled once, in [Set up a project](03-set-up.md#the-plans-folder-settled-once); the spec the plan builds against comes from [Create a bounded context](04-create-a-bounded-context.md).

![Deliver through a plan. A: you design the feature with your process tool (brainstorm, design, sprint, TDD loop); Partition does not replace them, it bounds and records the work. B: the assistant opens the plan with partition-plan, in docs/plans/: a header with Status, Resume at and Last updated, a task index, and each task with its verification command and its expected result. C: one task, one verification: the expected result is written before the command runs, and the real output is shown, never a prediction. D: with partition-plan, the plan is written before every reply: done ticked with its date and commit, Resume at moved, every decision dated, every blocker named. E: you commit; the assistant never commits. Then the next task, back to C. On "Resume.", after a break or a cleared session, partition-plan reads the header, the task index, the task named in Resume at and the Blockers, nothing more. F: ticking the last task starts the closing, and if the closing did not start, "We are done, close the plan.": partition-gate audits the plan's changes, earned by execution, with a verdict of SHIP, SHIP WITH CONDITIONS or HOLD; the reasons of a HOLD become tasks, or blockers for a person, and the work goes back to C. G: with partition-spec, what lasts goes to its level: true for one context, its durable spec; shared by the contexts of one area, its area file; spanning areas or layers, the invariant register after its admission test; you validate each entry. H: with partition-readme, the README is realigned when what users install, run or configure changed, and the C4 model too; then Status is done, and the plan stays as the dated record of why. An optional reminder hook, for Claude Code, recalls these closing steps when a plan is marked done or a commit is made. A change of behaviour later goes to journey 4.](../../assets/flow-3-deliver.svg)

In the figure, a blue step is the assistant with the skill it uses; an amber step is yours.

## The situation

A bounded context has its durable spec, its business rules confirmed, its banner gone. Now a feature has to be built in it, over several sessions, by an assistant whose memory ends with each conversation. You want the work to survive a cleared session, every decision taken along the way to be written where the next session finds it, and nothing to be called done on an impression.

## What you bring

**The feature.** What it must do, from the person who owns it: in the guide, `[PO]` gives it in one sentence, _the accountant issues the invoice of a confirmed order, and anyone can read it back_.

**A spec fit for design.** The `Business rules` of the bounded context carry no banner: while one stands, the context is not fit for design. Attack the spec before you plan, and settle what the attack finds: a finding left in `Open questions` blocks every task that implements what it reaches, until the spec moves.

**The design, with your own process.** Partition does not brainstorm, design or run your sprint; it bounds and records the work. A design, when you write one, goes to `docs/designs/` before the plan, written by you or by the process tool you use: in the guide, Superpowers may write it first.

**The inputs the design asks for.** A contract the feature implements, committed alone before the prompt that reads it, as every source and contract (in the guide, `[architect]` brings it). The decisions taken while designing, from the role that owns each: in the guide, `[architect]` decides that every amount is stored in minor units with its currency. The conventions of the code, which are not business rules: in the guide, `[TL]` gives the naming of amount columns.

**The answers.** The attack and the plan raise questions the feature leaves open. Each is answered by the role that owns it: in the guide, `[PO]` for what the feature requires, `[BA]` for the meaning of a word, `[architect]` for the structure, `[TL]` for the tooling.

**Your commits.** Between turns you commit; the assistant never does.

## What you say

**Before you plan**, attack the spec against the feature, as the guide does:

> Attack the spec of `<bounded-context>` before we plan the feature: (the feature, in one sentence).

**To open the plan**:

> Plan this feature.

Give it the contract's path once committed, the decisions and conventions you bring, and answer its questions.

**To carry it out**, the whole plan or up to a point you choose, in the guide's words:

> Carry out the plan up to (a task or a milestone), then stop.

**After a break, or in a fresh session**, from the README's _Day to day_:

> Resume.

or _"Where were we?"_

The closing starts on its own with the last tick; if it did not, say, from the README's _Day to day_:

> We are done, close the plan.

**To check a change on its own**, outside the closing of a plan: _"Is this safe to ship?"_, _"Did I break anything?"_, _"Check my last commit."_

**Optional, Claude Code only**: _"Enable the Partition reminder hook."_

## What comes back

### The attack: findings into the spec

`partition-attack` reads the spec, the area file, the invariant register and the contracts the spec names; of the neighbouring bounded contexts, nothing but their contracts. It writes its findings into the spec, under `Open questions`, and changes nothing else; it proposes no implementation. In the guide, it asks which of two simultaneous confirmations of one order wins, and what the amount of a line is, in which currency. You settle each one; the spec moves before the plan builds on it. How the attack reads a spec is in [Create a bounded context](04-create-a-bounded-context.md#the-attack-before-anyone-plans).

### The plan: one file, in the plans folder

`partition-plan` opens the plan in the folder `docs/partition.yml` declares, `docs/plans/` by default, from its template. With `bridge: superpowers`, the Superpowers plugin writes the body, in that same folder, and `partition-plan` adds the header, the task index and the two closing sections on top of it. Either way, the plan has the same frame:

```markdown
# <Feature> — execution plan

> **Status:** in progress
>
> **Resume at:** Task 1 — <what to actually do next, one line>
>
> **Last updated:** YYYY-MM-DD · uncommitted

## Tasks

- [ ] Task 1 — <title>
- [ ] Task 2 — <title>
```

Then the goal, one section per task, `## Decisions` and `## Blockers`. Each task names its scope, its verification command, the **expected result, written before the command is run**, and the earlier decisions that bind it. A task is small enough that done is a real output, not an impression. The empty `>` lines are deliberate: they keep each field of the header on its own line when the Markdown is reformatted, since the header is read line by line.

`Resume at` is authoritative. It is not "the first unchecked box": it is where the work actually restarts, which may be the middle of a task, the rework of a ticked one, or a verification.

### Every turn: the plan first, then the reply

Before it hands control back after any change of state (code, a decision, a blocker), the assistant writes the plan, then replies. The reply echoes what was written; nothing that appears in the chat is missing from the plan.

- **What is done is ticked**, in the task's section and in the index, with its date and the commit, or `uncommitted` while the change is still in the working tree: `- [x] Task 3 — 2026-08-11 · c370994 — <title>`. A task is ticked in the index only when all its steps are, and only after its verification command actually ran, its real output shown next to the expected result. Never a prediction.
- **`Resume at` moves** to the real next step, and `Last updated` is refreshed.
- **Every decision taken in the conversation** goes to `## Decisions`, one line each, with its date, its reason and the alternatives that lost. A decision that binds a later task is also written into that task's section, because a resume reads that section, not `## Decisions`. A decision that lives only in the chat did not happen.
- **Every blocker** goes to `## Blockers`: what is blocked, what unblocks it, who owns it. A blocker that says a file or a command result is not yet as required is written only after the assistant read that file or ran that command in the same turn; when the repository already shows it done, the entry is deleted.

Midway through a plan, the head of the file reads like this (an illustration of the template's fields):

```markdown
> **Status:** in progress
>
> **Resume at:** Task 3 — <the next step, one line>
>
> **Last updated:** 2026-08-11 · uncommitted

## Tasks

- [x] Task 1 — 2026-08-10 · c370994 — <title>
- [x] Task 2 — 2026-08-11 · uncommitted — <title>
- [ ] Task 3 — <title>
```

Along the way, what the feature establishes goes where it belongs. In the guide, the architect's decision on amounts goes to `## Decisions` with its date, its reason and what lost (a decimal column); the naming convention of amount columns, a rule about how code is written, becomes one line of a scoped rule file through `partition-rules`, not a line of the spec.

### Resume: the plan alone, read in part

On _"Resume."_, in a session that knows nothing of the previous one, `partition-plan`:

1. Opens the plan whose `Status` is `in progress` and reads its header, its `## Tasks` index, the section of the task named in `Resume at` and `## Blockers`. Nothing more: a plan can weigh more than everything else the task needs, and a `done` plan is not read.
2. Reconciles every `uncommitted` marker. You commit between turns, so each one is presumed stale: it finds the commit that carries the task's change (`git log -- <the files the task names>`) and writes its sha in the task, the index and `Last updated`.
3. Announces the step named in `Resume at`, before changing anything.
4. Restarts there, not at the first unchecked box when the two differ.

It asks which plan to pick up only when none is in progress and several are waiting. `partition-budget` measures each plan in progress against what a resume reads, so a plan that grows heavy shows on the gauges.

### The closing: started by the last tick

When the assistant ticks the last task, it starts the closing in the same turn, without waiting to be asked:

1. **The gate.** `partition-gate` audits the plan's changes, from the commit before its first task to the working tree. It reads the durable specs of the bounded contexts the change touches, their area files and the invariant register as its oracle: a change that breaks a business rule, an area rule, an invariant or a contract is a blocker whatever the tests say, and a behaviour the spec does not describe is a finding of its own. It runs the build, the tests and the diff coverage it can, and reports every command with its real output, and what it could not verify. A verdict is earned by execution: when changed lines are neither covered by a test nor checked by hand, the verdict cannot be a clean SHIP. It changes no code and touches no history. The verdict, with its evidence, is written in the plan.
   - **SHIP**: the closing goes on.
   - **HOLD**: the plan stays `in progress`. Each reason becomes a task when the assistant can fix it, a blocker naming its owner when only a person can; `Resume at` points to the first. The closing stops until a new run gives SHIP or SHIP WITH CONDITIONS.
   - **SHIP WITH CONDITIONS**: each condition becomes a task, or a blocker naming its owner. The plan closes once they are done.
2. **What the work established.** Every statement the plan made true for good is listed, `## Decisions` first. A statement already written into a spec during the work is on the list too: its level is checked now, not assumed.
3. **Each statement to its level**, as `partition-spec` places it: the durable spec of one bounded context, the area file of one area, or the invariant register through its admission test; a statement about how code is written, to a line of a scoped rule file. The spec gets the result; the dated reason stays in the plan. Nothing is written to the area file or the register before you validate it. The assistant reports the `AR-` and `INV-` entries added or changed and the candidates rejected; zero is the normal outcome. In the guide, the decision on amounts fails the admission test and stays in the spec of its bounded context, under `Persistence`.
4. **The README and the C4 model.** When the plan changed what users install, run or configure (commands, options, configuration keys, an API), `partition-readme` realigns the README; otherwise the plan says "README unaffected". When the work changed the architecture, `partition-c4` updates the model and regenerates its diagrams.
5. **`done`.** `Status` is set to `done`. The last task's line, every task still marked `uncommitted` and `Last updated` carry the date alone: their changes land in your closing commit, which cannot name itself, and `git log -1 -- <plan>` finds it. `Resume at` reads `— (nothing; every task is checked)`.

The plan stays in the repository, the dated record of why; nothing copies it elsewhere.

### The README: derived, never a source

`partition-readme` finds the last commit that touched the README, collects what changed since, and edits only the sections those changes reach, keeping the README's language, structure and tone. Every command, path or option it writes exists as written in the project; whatever was removed from the code leaves the README. It changes the README only, never the code and never a spec. Where the README and a spec disagree on a behaviour, the spec rules: it reports the gap and does not settle it in the README.

### The reminder hook, optional

Closing is the step people forget. On Claude Code, the reminder hook prints the closing steps when a plan file is written with `Status: done`, or when a commit is about to run. It touches nothing, and it recognises a plan by a `plans/` folder in its path. It is never installed unless you ask; on Copilot, the closing rests on the always-on instruction and on `partition-plan`. How it is enabled is in [Set up a project](03-set-up.md#the-options).

## What you decide

- **The feature and its design**, with your own process. Partition records the work; it does not choose what to build.
- **Each finding of the attack and each open question**, before the tasks that implement what it reaches.
- **The decisions and the conventions** the design needs, each from the role that owns it, and the answers to the plan's questions.
- **How far the assistant goes**: the whole plan, or up to a task you name.
- **Every commit.** The assistant never commits; it writes `uncommitted`, and the next resume finds your sha.
- **Each blocker that only a person can clear**, including the reasons of a HOLD and the conditions of a SHIP WITH CONDITIONS that fall to you.
- **Each entry the closing proposes** for the area file or the invariant register.
- **Whether to enable the reminder hook**, on Claude Code.

A behaviour that has to change once the feature is delivered moves the spec first, in the next journey.

## Go deeper

- [Step 04](https://github.com/elie29/partition/blob/main/docs/guides/a-project-step-by-step/04-first-feature.md#the-shape-after): the attack before the plan, the plan with its decisions, a resume from a cleared session, and the closing through the gate, where a decision of the plan lands in the spec.
- [The state is in the plan, not in the chat](https://github.com/elie29/partition/blob/main/README.md#the-state-is-in-the-plan-not-in-the-chat), in the README.
- The skills behind this journey: [`partition-plan`](https://github.com/elie29/partition/blob/main/.apm/skills/partition-plan/SKILL.md) and its [template](https://github.com/elie29/partition/blob/main/.apm/skills/partition-plan/assets/plan.md), [`partition-gate`](https://github.com/elie29/partition/blob/main/.apm/skills/partition-gate/SKILL.md) and its [verdict rubric](https://github.com/elie29/partition/blob/main/.apm/skills/partition-gate/references/report.md), [`partition-readme`](https://github.com/elie29/partition/blob/main/.apm/skills/partition-readme/SKILL.md), [`partition-attack`](https://github.com/elie29/partition/blob/main/.apm/skills/partition-attack/SKILL.md).

Back to the [series](README.md).
