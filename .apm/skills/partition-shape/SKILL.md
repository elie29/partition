---
name: partition-shape
description: Shape the bounded contexts that do not exist yet from a source, and keep their specs in step with it - an API contract, a PRD, an existing spec, or a context described in the chat. Use when a new contract or PRD arrives, to find the bounded contexts of a system or a document, when the source changes version, or to see what a change of the source breaks.
license: MIT
compatibility: Node.js 22 or later
---

# From a source to bounded contexts

A source is what a system is specified by: an API contract, a PRD, a spec written before Partition, a context someone describes. It is read where it lives, any file of the repository or a URL. This skill reads it, decides with the owner how it splits into bounded contexts, writes one durable spec per bounded context, and later keeps those specs in step with each new version of the source. A merge, a fission, a removal or a move of a bounded context that exists is the `partition-reshape` skill's: this one only proposes it. It writes documentation only: never code, and never a change to a source it was given; a source pasted in the chat is saved once, as the owner validates it.

A spec **points to its source**, it does not copy it: it lists the parts of the source the context owns, each with a link. Only three things are copied into the spec, word for word with their anchor, because the spec must hold them: the **business rules**, the **invariants** and the **decisions** the source states.

## Which procedure

First make sure the source is a file; then look at `<specs>/<area>/bounded-contexts.md` (`<specs>` is `paths.specs` in `docs/partition.yml`, default `docs/specs`; `<area>` is the target folder the owner names).

| Situation | Do |
| --- | --- |
| The source is not a file of the repository (pasted or described in the chat) | Write it to a file under a name the owner gives: a pasted API contract to `<contracts>/<name>.json` (`paths.contracts`), any other source to `<sources>/<name>.md` (`paths.sources`, default `docs/sources`). Show it, get it validated, then continue with that file. Never decompose from the chat. A source at a URL is handled by its reader |
| The file is absent | LOAD `references/decompose.md`: initial decomposition |
| Present, with `external` as provenance (a document at a URL) | LOAD `references/sources/document.md`, _Provenance and changes_: ask the owner what changed, or to save the new version as a file |
| Present, without a `Provenance` line carrying a sha or `external` | LOAD `references/decompose.md`: it sets the baseline and leaves existing specs intact |
| Present with a sha, and the source changed since | LOAD `references/delta.md` |
| Present with a sha, and the scope asked differs from the scope recorded | Stop and ask: extend the recorded scope through the delta, or choose another target folder |
| An API contract given for a bounded context that exists, whose `bounded-contexts.md` records another source | Not a source of the decomposition: enter no procedure. It is the contract that bounded context shows, recorded in its `Contracts with neighbours` (`partition-spec`); the recorded source stays the only source, its provenance unchanged |
| The API contract of a system a bounded context only calls | Not a source: enter no procedure. It is recorded in that bounded context's `Contracts with neighbours` (`partition-spec`), read where it lives; never decomposed |

Both procedures apply the six criteria C1–C6 and the rules R1–R6 of `references/criteria.md`. There is one definition; never restate or adapt it.

## The reader of the source

| Source | LOAD |
| --- | --- |
| An API contract | `references/sources/openapi.md` |
| Any other document: a PRD, a spec written before Partition, a described context saved as a file | `references/sources/document.md` |

The reader says what a unit is (an operation, or a requirement or story under its anchor), how the scope is written, how the inventory is built and how C2, C5 and C6 are measured.

## Inputs

`source` (any file of the repository, wherever it lives, or a URL) and `area` (the target folder, kebab-case) are mandatory and are **never inferred**: not from the name of the source, not from its title or a heading, not even when a single source is present. When one is missing, stop and ask, showing what exists. `scope`, `base` (a git ref) and `extend` (a scope extension) are optional and are detailed in the procedures.

## The script

For an API contract only. The contract is often tens of kilobytes. Do not read it whole to inventory it or to compare two versions: the script does it exactly and prints only what the decision needs. Run it from the root of the project (`scripts/contract.mjs` stands for that file in this skill's folder):

```bash
node scripts/contract.mjs provenance <contract>                 # version, commit sha, uncommitted or not
node scripts/contract.mjs inventory  <contract> [--scope "…"]   # operations, coupling matrix, orphans
node scripts/contract.mjs diff       <contract> --base <sha> [--base-path <path>] [--scope "…"]
```

It reads JSON contracts. It reports facts and decides nothing. A document has no script: its reader says how to build the inventory and the diff by reading.

## What holds in both procedures

- **The source is the only source of truth.** Never invent an endpoint, a field, a requirement, an error code or a behaviour. What the source does not say is an open question.
- **A pointer, never a copy**, except the business rules, invariants and decisions the source states. A rule is copied word for word, marked "from source", under the "TO VALIDATE" banner until a person confirms it. A rule stated for several bounded contexts is copied once, where `partition-spec` sends it. An invariant goes through the admission test of the register (`partition-spec`); one that fails it becomes an area rule or a business rule, at the level that holds it.
- **Nothing is written before validation.** Each procedure has a hard stop where the writing plan is shown. No answer, no writing. A new bounded context, a merge, a removal, a move, a scope extension or the rewrite of a stale scope is validated by name; a general "go ahead" does not cover it.
- **A business rule is never deduced**, from a field name, an example or code. With none stated, the section keeps its "TO FILL" banner, and a bounded context under a banner is not fit for design or implementation: say so in the closing report.
- **The scope never widens by itself**, not to follow shared data, not for a neighbouring unit.
- **Every decision is justified** by the criteria, including the decision not to split, and **the architect takes it**: before a boundary moves, LOAD `references/boundary-decision.md` (a workshop or a proposal, then a challenge of the workshop's result).
- **A gap is reported, never corrected**: between the source, the existing specs, the project's rules, the area file and the invariant register.
- **Nothing is deleted.** A bounded context left without units is proposed for removal.
- The source keeps a **stable file name**, overwritten at each delivery and committed alone (`docs(contracts): <area> 1.4.0 -> 1.5.0`). Each spec records the version and the sha it was derived from: that sha anchors every later update.

## Afterwards

The specs come out with `Source parts owned` filled and a banner up. The owner or the business analyst confirms the copied rules, fills the missing ones, settles the open questions and the gaps, and only then does design start. Candidates for the invariant register go through its admission test (`partition-spec`); nothing is written there or in the area file without explicit validation, and "no candidate" is the normal outcome.
