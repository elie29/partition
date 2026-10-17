# Context Budget — assessment of YYYY-MM-DD

> **Held with:** <architect, product owner or business analyst, team — names>
>
> **Next assessment:** YYYY-MM-DD
>
> **Brought forward by a warning sign:** no | <which>

<Paste the output of budget.mjs here, unedited. Its sections start at `##` and follow this title.>

## Change since the last record

<The record it is compared with, by its date, and what moved: each gauge that changed, and why.>

## What is coming

| Feature to deliver | Bounded context | What it needs to load | What it will load |
| ------------------ | --------------- | --------------------- | ----------------- |

## Warning signs since the last assessment

| Sign                                                         | Observed          | Evidence                    |
| ------------------------------------------------------------ | ----------------- | --------------------------- |
| An ordinary change touches more and more files               | <from the gauges> | <median now, median before> |
| The same context has to be explained again at every request  | yes / no          | <where>                     |
| The assistant causes regressions outside the scope asked     | yes / no          | <commit, incident>          |
| The assistant reinvents a rule that already exists elsewhere | yes / no          | <file:line of both>         |

## Finding

<For each context over a threshold, or about to be: what makes the load exceed the need.>

## Options

<Every option, whatever the gauges; none chosen here.>

- Scope or cut a rule (`partition-rules`): <what, or "none to propose">
- Trim a spec of what the contract or the code already says (`partition-spec`): <what, or "none to propose">
- Hold a workshop on a boundary, then prepare the move (`partition-reshape`): <what, or "none to propose">
- Promote a component to a container, or a container to a system (`partition-reshape`): <what, or "none to propose">
- Nothing: <the reason>

## Decision

<Taken by the people named above, not by the assistant: scope or cut a rule / trim a spec / hold a workshop on a boundary / promote a component / nothing. One line each, with its owner and date.>
