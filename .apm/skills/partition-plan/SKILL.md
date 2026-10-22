---
name: partition-plan
description: Open, resume or close the execution plan of a feature, the only place the state of the work lives. Use when starting planned work, resuming after a break or a cleared session, and when the last task is done.
license: MIT
---

# Plan

The plan file is the state of the work; the conversation is not. A session can be cleared at any moment, not only at the end of a step, and anything that exists only in the chat is lost with it.

Plans are one file per feature, in one folder per project. A plan works inside one bounded context: a change that reaches several bounded contexts opens one plan per bounded context, and a plan relies on a neighbour's contract only once that contract is written in the neighbour's spec. When `bridge` names a tool (`superpowers`, `bmad`, another), that tool writes their body; the header, the task index and the two sections below are added on top of whatever it produces.

## Where the plans are

The folder is declared once, never guessed at each session: `docs/partition.yml` says it, `paths.plans`. Use it, whatever `bridge` says: that key only names the tool that writes the plan's body. When it declares none, or `docs/partition.yml` does not exist, LOAD `references/plans-folder.md` before opening a plan.

The user's own instructions, or another of the project, may name a different folder. What `docs/partition.yml` declares wins, then the project's instruction; say that they disagree so the owner can align them. The owner can change the folder at any time, in either place.

## Shape

Start from `assets/plan.md`. Every plan opens with this block, above the goal:

```text
> **Status:** in progress | blocked | done
>
> **Resume at:** Task {n} — {what to actually do next, one line}
>
> **Last updated:** {YYYY-MM-DD} · {commit sha, or `uncommitted`}
```

Keep the empty `>` lines: they keep each line of the header on its own line when the Markdown is reformatted, and the header is read line by line.

`Resume at` is authoritative. It is **not** "the first unchecked box": it is where work actually restarts, which may be mid-task, the rework of a checked box, or a verification.

Right after the header comes `## Tasks`: one checkbox per task, in order, `- [ ] Task {n} — {title}`. Then the goal, then one section per task headed `## Task {n} — {title}`, then `## Decisions` and `## Blockers`.

Each task names its scope, its verification command and the **expected result, written before the command is run**, one list item each, as the template shows. A task is small enough that done is a real output, not an impression.

## Resume

1. Open the plan whose `Status:` is `in progress`. Read the header, the `## Tasks` index, the section of the task named in `Resume at` and `## Blockers`, whose carried entries step 4 of the next section checks. **Do not read the rest**: a plan can weigh more than everything else the task needs. A `done` plan is not read.
2. Reconcile every `uncommitted` marker. The owner commits between turns, so each one is presumed stale: find the commit that carries the change (`git log -- <the files the task names>`) and write its sha in the task, in the index and in `Last updated`. Done when no `uncommitted` remains except on a change `git status` still shows.
3. Announce the step named in `Resume at` **before** changing anything.
4. Start there.
5. Ask which plan to pick up only when none is in progress and several are waiting.

## Before handing control back, every turn

Write the plan **first**, then reply. The reply is an echo of what was written: no state that appears in the chat may be absent from the plan.

1. Tick what is done: `- [x] Task 3 — 2026-08-11 · c370994 — <title>`, or `uncommitted` while the change is still in the working tree, in the task's section and in the index. A task is ticked in the index only when all its steps are, and only after its verification command was actually run.
2. Update `Resume at` to the real next step and refresh `Last updated`.
3. Append every decision taken in the conversation to `## Decisions`: one line, with date and reason, and the alternatives that lost. A decision that lives only in the chat did not happen. A decision that binds a later task is also written, in the same write, into the section of each task it binds: a resume reads that section, not `## Decisions`.
4. Record any blocker in `## Blockers`: what is blocked, what unblocks it, who owns it. Delete the entry when it clears. A blocker that says a file, a line or a command result of the repository is not yet as required is written only after reading that file or running that command in this turn, and an entry carried from an earlier turn is checked the same way: when the repository already shows it done, there is no blocker, and the entry is deleted. A finding left in `Open questions` of a spec is a blocker of every task that implements what it reaches, owned by the person who settles it, until the spec moves: those tasks wait, with no interim behaviour.

Never end a turn that changed state (code, decision or blocker) without this write.

## Close

When the last task is ticked, in the same turn, without waiting to be asked:

1. Run `partition-gate` on the changes of the plan: from the commit before its first task to the working tree. Write the verdict and its evidence in the plan.
   - HOLD: the plan stays `in progress`. Each reason becomes a task when you can fix it, a blocker naming its owner when only a person can; `Resume at` points to the first. Closing stops here until a new run gives SHIP or SHIP WITH CONDITIONS.
   - SHIP WITH CONDITIONS: each condition becomes a task, or a blocker naming its owner when only a person can meet it. The plan closes once they are done.
2. List every statement the work established. `## Decisions` is the first place to look. A statement already written into a spec during the work, or into a design, is on the list too: its level is checked now, not assumed.
3. Each statement goes where `partition-spec` sends it: the durable spec of one bounded context, the area file of one area, or the invariant register through its admission test (`partition-spec`, `references/invariants.md`); how code is written, to a line of a rule file scoped to the code it binds, through `partition-rules`. The spec moves, the reason stays here. A design or a plan is not a level: a statement true for every feature found only there moves.
4. Nothing is written to the area file or to the register before the owner validates it, nor a line of a rule file, shown as `partition-rules` says. Report the `AR-` and `INV-` entries added or changed and the candidates rejected. Zero is the normal outcome. A candidate rejected because a level already holds it names the file and the identifier that hold it, read now. A level that holds part of a statement does not hold it: that part is pointed to, the rest goes to its own level, and is never reported as in place.
5. When the plan changed what users install, run or configure (commands, options, configuration keys, an API), realign the README with `partition-readme`. Users include the people who build and maintain the project: a command, a script or a configuration file they run or configure, added or changed, realigns it too, even when nothing a user of the deployed system sees changed; otherwise write "README unaffected" in the plan. When the work changed the architecture, update the C4 model with `partition-c4`, then regenerate its diagrams.
6. When steps 3 to 5 wrote any file, run `partition-gate` again as in step 1, those writes included, and handle its verdict the same way. The plan closes on a verdict that covers every change of the plan.
7. Set `Status:` to `done` in the same write. The last task's line, every task still marked `uncommitted` and `Last updated` carry the date alone: their changes land in the closing commit, which cannot name itself, and a `done` plan is never resumed to reconcile them; `git log -1 -- <plan>` finds it. `Resume at` reads `— (nothing; every task is checked)`.

The plan stays in the repository. It is the dated record of why; nothing copies it elsewhere.

## Reminder hook (optional, Claude Code only)

Closing is the step people forget. `assets/hook/` holds a hook that prints a reminder when a plan is marked `done`, or when a commit is about to be created. It is not installed with the package: enable it only when the owner asks, and LOAD `references/hook.md` to do it.
