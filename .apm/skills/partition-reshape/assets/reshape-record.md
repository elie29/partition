# Reshape — <fission | merge | removal | move | promotion>: <what>

> **Decided on:** YYYY-MM-DD, by <names>, from <workshop: <path of the result under paths.sources> | proposal: option n>
>
> **From:** <where it lives now> **To:** <where it goes>
>
> **Raised by:** <the budget record `docs/budget/YYYY-MM-DD.md`, the delta of a source, an API or a feature removed>

## Why here

<The events that do not belong to the same flow, or that do. The words that change meaning across the line.>

| Term | Meaning on this side | Meaning on the other side |
| ---- | -------------------- | ------------------------- |

## Challenge

| Finding                                      | Improvement proposed | Outcome                                        |
| -------------------------------------------- | -------------------- | ---------------------------------------------- |
| <what the result says, against what, quoted> | <the change>         | <taken, or kept as is: the architect's reason> |

<For a proposal, write "Proposal: no workshop result to challenge". For a workshop with no finding, write "No finding".>

## Integration

| Crosses the boundary | Direction | Form (event, call, file) | Contract |
| -------------------- | --------- | ------------------------ | -------- |

<For a merge: the contract between the two halves, removed, and its other consumers.>

## Rules

| Rule | Was in | Goes to |
| ---- | ------ | ------- |

<Each rule both sides need, or that a merge brings down from the area file: one home each.>

## Preconditions

- [ ] Every caller reaches it through an interface, or a merged half through its contract: <where>
- [ ] One adapter implements that interface: <where>
- [ ] The contract is written and frozen: <path, version>
- [ ] For a fission, the new bounded context has its durable spec and its own language: <path>
- [ ] Each rule both sides need has one home: the owner's spec, the area file or the register: <rules>
- [ ] For a merge, the person who carries the hand-written sections over: <name>
- [ ] For a removal, nothing calls it any more: <the search and its output>

## Proof that it was a move

- Verification: `<command that lists the files changed outside the moved or merged code>`
- Expected: <only the wiring: which files>
- Real output:

## After

- [ ] C4 model updated and regenerated
- [ ] `docs/partition.yml` declares the new bounded context, with its area, or no longer declares the one that went
- [ ] Budget measured again: `docs/budget/YYYY-MM-DD.md`
