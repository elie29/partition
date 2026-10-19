# Glossary

The words of Partition, each explained here and nowhere else. One term, one meaning. Each entry lists its synonyms: read them as the term, never write them in its place. A project's business vocabulary is not here: it lives in the `Language` section of each durable spec and area file.

## The levels

```text
Project                                    required
└── Area (a subdomain)                     optional   <specs>/<area>/
    └── Bounded context                    required   <specs>/<area>/<bounded-context>/spec.md
        └── Hexagon                        required   one or more per bounded context
            └── Layer                      required   inbound, application, domain (rich only), outbound
```

A bounded context in no area skips the area level: its spec is `<specs>/<bounded-context>/spec.md`.

**Project** — The repository that installs Partition, with its own specs, plans and code. _Required._

**Area** — A part of the business that groups several bounded contexts, in the folder `<specs>/<area>/`. It holds the decomposition record of its source and its area file. In DDD terms, an area is a **subdomain** (core, supporting or generic). _Optional:_ a bounded context may belong to no area. _Synonyms:_ subdomain. _Not:_ a bounded context, which it contains; a layer.

**Bounded context** — A part of the system with its own model and its own language: one durable spec, its code, its contract. It holds one hexagon or more. _Required:_ declared in `docs/partition.yml`, with its area when it has one. _Synonyms:_ BC, context; write "bounded context". _Not:_ an area, which groups several; the Context Budget.

**Neighbour** — Another bounded context, known only through its contract.

**Root aggregate** — The business object a unit of a source acts on. Criterion C2 asks each bounded context for one of its own; the reader of each kind of source says how it is found (`partition-shape`).

## The hierarchy of rules

| Level           | Statement                    | Lives in               | Binds                                    |
| --------------- | ---------------------------- | ---------------------- | ---------------------------------------- |
| Project         | Invariant, `INV-{CAT}-{NNN}` | the invariant register | every area and layer it spans            |
| Area            | Area rule, `AR-n`            | the area file          | the bounded contexts of its area         |
| Bounded context | Business rule, `BR-n`        | the durable spec       | one bounded context                      |
| Feature         | Acceptance criterion         | the design             | one feature, checked once; never durable |

A statement goes to the lowest level that holds it all. A lower level never contradicts a higher one: a contradiction stops the work and goes to the owner, and it is never settled by editing the higher level.

Two kinds of rules stand outside this hierarchy: rule files, which say how code is written, and the decision rules R1–R6, which say how a source is split.

## Documents

**Durable spec** — The source of truth of one bounded context, `spec.md`; the code implements it. _Durable_ means true for every feature, not for one. Present tense, no history. _Required:_ one per bounded context. _Synonyms:_ spec. _Not:_ the invariant register; the design of a feature.

**Invariant register** — The project's single file of invariants (`paths.invariants` in `docs/partition.yml`, default `docs/specs/invariants.md`). It holds only what spans at least two areas or layers. Every bounded context reads it. _Optional:_ created the first time an invariant is admitted. _Synonyms:_ register. _Not:_ the durable spec of a bounded context.

**Area file** — `<specs>/<area>/area.md`: the language and the area rules shared by the bounded contexts of one area. Only the bounded contexts of that area read it. In DDD terms, a **shared kernel**: keep it small; it changes only with the agreement of the bounded contexts it binds. _Optional:_ created the first time a rule or a word is shared. _Not:_ the decomposition record.

**Decomposition record** — `<specs>/<area>/bounded-contexts.md`: how a source was split into the bounded contexts of an area (criteria applied, bounded contexts retained, coverage, history). It holds no rule. _Optional:_ written the first time a source is decomposed into its area (`partition-shape`).

**Source** — The document, wherever it lives in the repository or at a URL, that bounded contexts are derived from: an API contract, a PRD, a spec written before Partition, or a described context saved as a file. Pointed to, never copied, except for the business rules, invariants and decisions it states. _Not:_ "source of truth", which is the durable spec; source code.

**Unit** — The smallest part of a source the splitting criteria judge: an operation of an API contract, or a requirement or story of a document, or one of its sections when it identifies none. A part that only records decisions, defines terms or gives context is not a unit.

**Anchor** — The stable name of a unit in its source: an `operationId`, an identifier such as `REQ-12`, or the slug of a heading. A statement outside any unit is anchored by its place in the source, in the form the reader of that source gives (for an API contract, the JSON Pointer of the description that states it; for a document, the identifier or heading that holds it). A dated item under a heading, such as an entry of a ruling history, is anchored by that heading and its date; a date repeated under one heading is not a stable anchor. An anchor is written whole wherever it is quoted.

**Provenance** — The version and the commit sha of the source a durable spec was derived from.

**Contract** — The only thing a bounded context shows to another. For an API, the contract file is **required**.

**Design** — What one feature will build, and why. Read once, then historical. _Synonyms:_ feature specification.

**Plan** — The state of execution of one feature, and the dated record of why. The only place either lives.

**Derived document** — A README, a generated diagram: rebuilt from a source, never a source itself.

**Template** — A file shipped in a skill's `assets/`, copied into a project only when the instance is missing.

**Instance** — A file created once from a template and then owned by the project. An update of the package never touches it.

## Rules, decisions, scope

**Business rule** — A statement true for one bounded context, `BR-n` in its durable spec, with its trigger, its expected effect and its source. Written by a person, or copied word for word from a source that states it and confirmed by a person; never deduced. _Synonyms:_ "policy" in Event Storming is close: a rule with its trigger. _Not:_ a rule file; a decision rule.

**Area rule** — A business rule shared by the bounded contexts of one area, `AR-n` in its area file, with the same form and banners as a business rule.

**Invariant** — A statement of the invariant register, `INV-{CAT}-{NNN}`, one line, verifiable; a defect when violated.

**Admission test** — The three conditions a statement must meet to enter the invariant register: `references/invariants.md`. A statement spans layers when it binds the same layers in every hexagon of the project, as the rule that dependencies point inward does: it is an invariant. A statement about two layers of one bounded context stays in its durable spec; a convention about one layer goes to a rule file.

**Acceptance criterion** — Something one feature must do. Checked once. Never enters a durable spec.

**Banner** — The warning at the head of a `Business rules` or `Area rules` section: "TO FILL" while it is empty, "TO VALIDATE" while it holds only rules copied from a source. While a banner stands, the bounded context is not fit for design.

**Rule file** — A convention of the project the assistant must follow, scoped to the files it concerns. Owned by the project (`partition-rules`). _Synonyms:_ rule; write "rule file". _Not:_ a business rule.

**Splitting criteria C1–C6, decision rules R1–R6** — How a source is split into bounded contexts: `partition-shape`, `references/criteria.md`.

**Kept against the criteria** — A point of a decomposition the architect kept although a criterion fails, recorded in `bounded-contexts.md` with the criterion, the names, the date and the reason. A later delta does not propose it again unless it changes that criterion for the units of the point (`partition-shape`, `references/boundary-decision.md`).

**Source decision** — A decision a source states, copied with its reason into the `Decisions` section of a durable spec.

**Plan decision** — A decision taken while building, with its date, its reason and the alternatives that lost, in the `## Decisions` section of the plan that took it.

**Decomposition scope** — The units of a source a decomposition analyses (`scope`, `extend`).

**Rule scope** — The files a rule file applies to.

**Scope** (section of a durable spec) — What the bounded context covers, and what it hands to a neighbour or a third party.

## Budget

**Context Budget** — The tokens the assistant must absorb for a task. Exceeded when a task loads more than it needs.

**_Always_ gauge** — The token estimate the budget script (`partition-budget`) prints for each bounded context: what any task of it loads before reading code. That is the project's entry file, the instruction, the descriptions of the skills and agents, the rule files that apply, the invariant register, the area file and the durable spec. It is compared to the _Always_ threshold. _Synonyms:_ gauge.

**_Always_ threshold** — The most tokens the model is allowed to handle before reading code, set by the owner in the key `budget.always` of `docs/partition.yml` (32 000 by default). It measures what the model can hold, not the size of a bounded context: one value per project, and every bounded context is held to it, however large its domain. _Synonyms:_ threshold, limit, max. _Not:_ the size of a bounded context; a value per bounded context or per area.

## Architecture

**Hexagon** — A ports-and-adapters unit inside a bounded context. _Thin_: no domain layer. _Rich_: a domain model. Its form and its layer map are chosen with `partition-hexagon`. _Required:_ one or more per bounded context. _Synonyms:_ ports and adapters, clean architecture, onion architecture.

**Port** — An interface of the hexagon: what it offers on the inbound side, what it needs on the outbound side. The hexagon defines its ports; the outside adapts to them.

**Adapter** — The implementation of a port, outside the domain: a controller, a gateway, a repository.

**Layer** — One ring of a hexagon. Each hexagon names its layers in its layer map (`docs/partition.yml`); the usual rings, from the outside in:

| Layer | Holds | Also called |
| --- | --- | --- |
| inbound | the adapters that call the hexagon: controllers, message listeners, a command line | driving, primary, left side, API, client side, entry |
| application | the use cases and their ports | use cases |
| domain | rich hexagons only: aggregates, entities, value objects, domain services | entities |
| outbound | the adapters the hexagon calls: persistence, messaging, third-party systems | driven, secondary, right side, SPI, gateway, infrastructure, exit |

Dependencies point inward: an adapter knows the application; the application and the domain know no adapter. _Required:_ every hexagon has layers; the domain layer exists only in a rich hexagon. _Not:_ an area or a bounded context, which cut the business; a layer cuts the code of one hexagon.

**Promotion** — A component becoming a container, or a container a system, without rewriting its callers (`partition-reshape`, `partition-c4`).

**Shape** — Deriving a bounded context that does not exist yet from a source (`partition-shape`).

**Reshape** — Changing bounded contexts that exist: a fission (one becomes two), a merge (two become one), a removal, or the move of a unit from one to another (`partition-reshape`). _Synonyms:_ split, for a fission.

## The package and the people

**Owner** — The person who decides for the project: draws the boundaries, or names the architect who does, confirms the business rules, validates the entries of the invariant register and of the area files, commits.

**Architect** — The person who decides where a boundary goes: the owner, or the one the owner names for it. The assistant proposes or challenges when asked; it never decides (`partition-shape`, `references/boundary-decision.md`).

**Feature** — An increment of delivery, with one design and one plan.

**Primitive** — What APM deploys: the instruction, the skills, the agent.

**Instruction** — The always-on file of the package, read by every session.

**Skill** — A procedure loaded when its description matches the work. Its `SKILL.md` is read then; its `references/` only when it points to them; its `assets/` are templates.

**Agent** — A reviewer run apart from the conversation: `spec-auditor`.
