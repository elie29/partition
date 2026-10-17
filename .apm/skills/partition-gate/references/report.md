# Verdict and report

Moved here from the skill as it was written; the skill loads this file before writing a verdict.

## Rubric

Use this rubric honestly; the value of the skill is that the verdict means something.

| Verdict | Conditions |
| --- | --- |
| **SHIP** | Build/type-check pass, relevant tests pass, changed lines meaningfully covered or manually verified, no Blocker/High findings, migration and rollback safe, blast radius understood. |
| **SHIP WITH CONDITIONS** | Materially sound, but requires named mitigations before or during rollout (flag, canary, backfill window, added monitoring, follow-up fix). List each condition as a checkbox with an owner-shaped action. |
| **HOLD** | Any Blocker; or a High finding without mitigation; or contract/schema change whose consumers are unverified; or nothing could be executed so the change is fundamentally unverified. |

Also state a **confidence level** (High / Medium / Low) and the reason. Verification depth drives confidence: full suite + diff coverage on a self-contained change → High; static review of a payment integration with no runnable tests → Low, regardless of how clean the code looks.

## Report format

Produce exactly this structure, in the conversation (and as a markdown file if the user wants to attach it to a PR):

```markdown
# Regression Audit — <target>

## Verdict: <SHIP | SHIP WITH CONDITIONS | HOLD>

Confidence: <High/Medium/Low> — <one line why> <2-4 sentences: what the change does, what the deciding evidence was.>

## What changed

<Intent inferred from the diff, files/hunks that matter, blast radius.>

## Evidence

| Check         | Command | Result                                            |
| ------------- | ------- | ------------------------------------------------- |
| Build         | `...`   | pass/fail/not run — why                           |
| Tests         | `...`   | 412 passed, 0 failed, 3 skipped                   |
| Diff coverage | `...`   | 74% of changed lines (12 uncovered, listed below) |

## Findings

### [Blocker] <title> — `path/file.ts:88`

Scenario: <how it fails in production> Evidence: <diff excerpt / failing test / uncovered line> Fix: <concrete>

### [Medium] ...

## Deployment considerations

<migration safety, N−1, rollback, flags, monitoring>

## Not verified

- <explicit list: untested paths, consumers outside the repo, perf under load, ...>

## Conditions before ship (only for SHIP WITH CONDITIONS)

- [ ] ...
```

Order findings by severity. If there are no findings, say "no findings" and let the "Not verified" section do the honest work — do not pad the report with speculation.
