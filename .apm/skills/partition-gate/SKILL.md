---
name: partition-gate
description: Deep regression audit of a commit, staged change, working tree, PR or diff range, ending in an evidence-backed production-readiness verdict (SHIP / SHIP WITH CONDITIONS / HOLD). Use this skill whenever the user asks whether a change is safe to ship, deploy, merge or release, whether their last commit or modification introduced a regression, whether something is "production ready", or says things like "check my last commit", "did I break anything", "review this diff", "is this safe to deploy", "go/no-go on this PR", "audit these changes before release". Use it even when the request sounds casual or narrow, and even when no tests exist — in that case the skill's job is to say so loudly rather than to guess.
license: MIT
---

# Regression Gate

A production-readiness audit for a specific change. The deliverable is a verdict a team can act on, with the evidence that earned it and an explicit list of what was _not_ verified.

## The one rule that matters

**A verdict is earned by execution, not by reading.** Static review of a diff finds suspicious code; it cannot establish that behavior is unchanged. So:

- If build / type-check / tests / diff-coverage were run, report exactly what ran and what came back.
- If they could not run (no toolchain, no network, no fixtures, ambiguous repo), the verdict caps at **HOLD (unverified)** or **SHIP WITH CONDITIONS** — never a clean SHIP.
- Never write "no regressions found" when the real finding is "no regressions _detectable by inspection_".
- Never invent test names, coverage numbers, timings, or command output. Every number in the report must come from a command actually executed in this session.

Users act on this verdict. A false "safe" is far more costly than an honest "I could only verify 60% of this."

## Phase 0 — Resolve the target

Determine precisely what is under review before touching anything else:

| User says | Target |
| --- | --- |
| "my last commit" | `HEAD` (diff `HEAD~1..HEAD`) |
| "my changes" / "what I just did" | working tree + staged (`git diff HEAD`), plus untracked files |
| "this PR" / "my branch" | `$(git merge-base <default> HEAD)..HEAD`, where `<default>` is the remote's default branch: `git symbolic-ref --short refs/remotes/origin/HEAD` |
| a hash / tag / range | that range |
| the closing of a plan (`partition-plan`) | from the commit before its first task to the working tree (`git diff <that commit>`), plus untracked files |
| no git repo | ask for the two versions, or review the supplied file(s) and cap confidence |

Confirm the target in one line at the top of the report (`Target: HEAD 3f2a1c9 "fix cart total rounding" — 7 files, +214/−58`). If the working tree is dirty while auditing a commit, say so: the tests you run do not reflect the commit alone.

## Phase 1 — Collect evidence

```bash
scripts/collect_change_context.sh --rev HEAD --out /tmp/rg          # a commit
scripts/collect_change_context.sh --worktree --out /tmp/rg         # uncommitted work
scripts/collect_change_context.sh --range main..HEAD --out /tmp/rg # a branch/PR
scripts/collect_change_context.sh --range <base> --out /tmp/rg     # <base> to the working tree: a plan
```

It writes `diff.patch`, `files.txt`, `stat.txt` and prints a triage summary: sensitive paths touched (auth, payments, migrations, infra, CI, lockfiles), deleted/renamed files, dependency manifest changes, prod-vs-test change ratio, and heuristic flags (swallowed exceptions, debug leftovers, hardcoded credentials, disabled checks).

Then:

```bash
scripts/detect_test_tampering.sh <the target flag above>    # tests deleted, skipped, or weakened
```

Treat every heuristic flag as a _lead to confirm by reading the code_, not as a finding. Report only what you have confirmed in the diff.

Read the full `diff.patch`. For any non-trivial hunk, open the surrounding file — a diff hides the invariants of the code it lands in.

## Phase 2 — Blast radius

For each changed function, method, class, endpoint, table, column, env var, config key and exported symbol, find the callers:

```bash
git grep -n "symbolName" -- . ':!*test*' ':!*spec*'
git log --oneline -5 -- <changed-file>     # what this file historically breaks
```

Classify each changed symbol:

- **Internal** — single call site, contained.
- **Cross-module** — consumed elsewhere in the repo; check every call site's assumptions.
- **Contract** — public API, exported package symbol, DB schema, event/queue payload, config key, CLI flag, or anything another deployable unit depends on. Contract changes are the #1 source of production regressions that pass CI, because the other side of the contract is not in this repo. Enumerate the consumers you can see and name the ones you cannot.

State the blast radius explicitly. "Changed `formatMoney`, used in 34 places across billing, invoices and the PDF renderer" is more useful than any amount of prose.

## Phase 3 — Regression analysis

**Start with the durable spec.** In `docs/partition.yml`, find the bounded contexts whose `code` paths the change touches. Read the `Business rules` and `Contracts with neighbours` of their durable specs, the area files of their areas, and the invariant register. They are the oracle a diff does not carry:

- a change that breaks a business rule, an area rule, an invariant or a contract is a **Blocker**, whatever the tests say: a green suite only proves what the tests check;
- a behaviour change the spec does not describe is a finding of its own: the spec moves first;
- a change that touches several bounded contexts, or a contract between two, says so at the top of the report.

If the project has no `docs/partition.yml`, say the audit ran without a spec and carry it into "Not verified".

Walk the change against the taxonomy in **`references/regression-taxonomy.md`** — read it now. It covers behavioral/logic, contract & compatibility, data & persistence, concurrency, performance & resource, error handling, security, config/deploy, frontend-specific, and async/jobs/integrations regression classes, each with the "what it looks like in a diff" signature, then how to judge the tests as evidence.

Skip classes that plainly do not apply, and say which ones you skipped and why. A report that silently omits the concurrency section reads the same whether you checked it or not.

For each finding produce: **severity** (Blocker / High / Medium / Low), **location** (`file:line`), **the concrete failure scenario** ("two requests hitting checkout within the same second both pass the stock check, oversell by one"), and **the fix or the verification that would rule it out**. A finding with no plausible failure scenario is noise — cut it.

## Phase 4 — Dynamic verification

Read **`references/verification-playbook.md`** for stack detection and command selection. In short, in this order, stopping to report anything that fails:

1. **Build / compile / type-check** — cheapest, catches contract breakage instantly.
2. **Lint** on changed files only.
3. **Targeted tests** — the suites covering the blast radius from Phase 2.
4. **Full suite** if it is affordable; note runtime if you skip it.
5. **Diff coverage** — the decisive metric. Which changed lines are executed by any test?

```bash
<python> scripts/diff_coverage.py --coverage <report> <the target flag above>
# the report formats it reads are listed in its --help
```

`<python>` is the first of `python3 --version`, `python --version`, `py -3 --version` that prints `Python 3.`. None does: record diff coverage as not verified.

6. **Regression comparison where feasible** — run the suite in a worktree at the base of the target, then with the change, and diff the results. A test that was already failing before the change is not this change's regression, and saying so protects the author.
7. **Manual probe** for anything tests do not cover — a script, a curl, a REPL check of the exact function that changed, especially boundary values (0, negative, null, empty, max, unicode, DST, timezone, concurrent).

Record every command and its outcome. If a step is impossible (no deps installed, no DB, network restricted), record _that_, and carry it into the "not verified" list.

## Phase 5 — Deployability

Ship-safety is more than correctness. Read **`references/database-and-migrations.md`** if the change touches schema, data, or long-running/stateful behavior. Assess:

- **Migration safety** — locking, table rewrites, backfills on large tables, index creation that blocks writes, non-nullable columns without defaults, destructive DDL, and whether the migration is reversible.
- **N−1 compatibility** — during a rolling deploy, old code and new code run at the same time against the same database and the same queues. Does old code survive the new schema? Does new code survive old messages/rows? Expand-contract or bust.
- **Rollback** — can this be reverted by redeploying the previous artifact, or has it crossed a one-way door (data migrated in place, external side effects, published events, third-party writes)?
- **Blast containment** — feature flag, canary, gradual rollout, kill switch.
- **Observability** — if this regresses in production, what fires? Is there a log, metric, or alert that would catch the specific failure modes found in Phase 3?
- **Operational cost** — new N+1 query, new external call in a hot path, new unbounded retry, new memory retention.

## Phase 6 — Verdict

**SHIP**, **SHIP WITH CONDITIONS** or **HOLD**, with a confidence level. Before writing it, LOAD `references/report.md`: it holds the rubric each verdict must meet and the exact structure of the report.

## Working style

- **Investigate before concluding.** Reading three files to understand an invariant beats guessing about it in prose.
- **No severity inflation.** If everything is High, nothing is. Reserve Blocker for "this breaks production or corrupts data".
- **Be specific about lines.** `file:line` always; the author should be able to jump straight there.
- **Respect the author.** The tone is a senior engineer reviewing a colleague's work: direct about risk, never sneering, and explicit when the change is genuinely good.
- **Never modify the code under audit** unless the user asks. This skill diagnoses; fixing is a separate, consented step.
- **Read-only on git history.** No commits, amends, rebases, resets or pushes as part of an audit.
