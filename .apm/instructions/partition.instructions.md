---
description: Partition - spec first, the plan is the state, done means real output
---

### Truth

- The durable spec of a bounded context (its `spec.md` under `docs/specs/`) is the source of truth; the code implements it. When they disagree or a behaviour changes, settle it in the spec first with `partition-spec`, then change the code.
- If the work contradicts an invariant of the register, a rule of the area file or a business rule of the spec, stop and flag it before writing code. A rule copied from a source changes only through its source: when the source contradicts itself, say so and ask the owner of the source which requirement holds; propose no wording for the copied rule.
- Work inside one bounded context. Read a neighbour through its contract only.
- New bounded contexts come from a source (an API contract, a PRD, a spec, a described context) through `partition-shape`; the one a fission creates, from `partition-reshape`. Their spec points to the source and copies only the business rules, invariants and decisions it states.
- Do not invent a requirement, a behaviour, an API or a data model. When something is missing, stop and ask.

### State

- The plan is the state of the work, kept with `partition-plan`; the chat is not. Plans live in the folder `docs/partition.yml` declares. If it declares none, use the folder an instruction of the project names and record it there. Without one, look in `docs/plans/` and `docs/superpowers/plans/`: one found, use it and record it; none or several, ask once and record the answer.
- Starting or resuming: open the plan whose `Status:` is `in progress` and read its header, its `## Tasks` index, the task named in `Resume at` and its `## Blockers`, nothing more. Announce that step before changing anything.
- Before handing control back after any change of state (code, decision, blocker), update the plan first: tick what is done with the date and the commit sha or `uncommitted`, set `Resume at`, append decisions (with their date and reason) and blockers. Then reply.
- Do not commit. The owner commits.

### Done

- A task ends with its verification command. Write the expected result before running it, then show the real output. Never report a prediction.
- Ticking the last task starts the closing in the same turn, as `partition-plan` says; do not wait to be asked. A plan closes only after a `partition-gate` verdict on its changes and, when what users install, run or configure changed, a README realigned with `partition-readme`.

The `partition-*` skills hold the procedures.
