# The repository map

Partition keeps the state of your project in files of your repository, never in the chat. This article walks through them, folder by folder: what each one holds, who puts a document there, when, and who reads it. It separates the two kinds plainly: what a person fills to start, and what Partition creates as the work goes. Why the method works this way is in [Why Partition](01-why-partition.md).

Installing the package writes nothing under `docs/`. Each file Partition creates appears the first time a skill needs it, copied from a template the skill ships when the file does not exist yet. From then on it is your project's: an update of the package replaces the skills, the agent and the instruction, and never touches your specs, your invariants, your plans, your rules, your `docs/partition.yml` or your C4 model.

## The tree

```text
.apm/instructions/                 Partition creates   your rules, one source for every assistant
docs/
├── partition.yml                  Partition creates   bounded contexts, paths, thresholds, layer maps
├── specs/
│   ├── invariants.md              Partition creates   what spans areas or layers
│   └── <area>/
│       ├── bounded-contexts.md    Partition creates   how a source was split, and why
│       ├── area.md                Partition creates   the language and the rules shared in the area
│       └── <bounded-context>/spec.md   Partition creates   the durable spec of one bounded context
├── contracts/                     you fill            API contracts, by default, under stable names
├── sources/                       you fill            PRDs, described contexts, workshop results, by default
├── designs/                       you fill            one per feature: what it builds
├── plans/                         Partition creates   one per feature and bounded context: its state
├── legacy/                        you fill            a spec written before Partition, read where it lives (the guide's example)
├── architecture/model.yml         Partition creates   the C4, as text
├── architecture/patterns-grid.md  Partition creates   your rulings on patterns
├── architecture/reshapes/         Partition creates   one record per split, merge, removal, move or promotion
└── budget/YYYY-MM-DD.md           Partition creates   one record per day of assessment
```

"Partition creates" never means "Partition decides". A skill writes the file, most often after showing you what it would write and waiting for your validation; the entries below say where. "You fill" means a person brings the document; the assistant reads it, and never invents what it does not say.

## The folders you can move

The folders under `paths:` in `docs/partition.yml` are yours to change. The others (`docs/partition.yml` itself, `docs/architecture/`, `docs/budget/`) have no key: they sit where the tree shows.

| Key | Default | What it holds |
| --- | --- | --- |
| `specs` | `docs/specs` | one durable spec per bounded context, by area |
| `invariants` | `<specs>/invariants.md` | what spans areas or layers |
| `designs` | `docs/designs` | one per feature: what it builds |
| `plans` | `docs/plans` | one per feature and bounded context: its state and its decisions |
| `contracts` | `docs/contracts` | where an API contract pasted or read from a URL is saved; one elsewhere in the repository is read where it lives |
| `sources` | `docs/sources` | where a source pasted or described in the chat is saved; one elsewhere, an old spec included, is read where it lives |
| `schemas` | none: declare it only if you document your persistence | the schema documents of your persistence |

The rest of this article uses the defaults.

## What you fill

These are the documents a person brings.

### `docs/sources/`: what the system is specified by

- **What it holds.** PRDs and contexts someone described, each under a stable name. The result of a boundary workshop lands here too, in whatever readable form it came back. It is the default folder, not the only place a source may live: a source is any file of the repository, whatever its folder, or a URL, and it is read where it lives. Only a source pasted or described in the chat is saved here.
- **Who puts a document there.** You, or the person who owns the document: in the guide, the product owner brings the PRD. When you paste a source in the chat instead, `partition-shape` asks you for a name, writes it here, shows it and waits for your validation: it never decomposes from the chat. After a boundary workshop, the people who held it bring its result, and the assistant saves it here before challenging it.
- **When.** Before the prompt that reads it, committed alone. The decomposition records the commit of the source, and every later change of that source is compared from it. A new version overwrites the same file and is committed alone again.
- **Who reads it.** `partition-shape`, to find the bounded contexts it describes, and again at each new version to say what moved, what breaks and whether the split still holds. A spec points to the parts of the source it owns and copies only the business rules, invariants and decisions the source states; everything else stays here.

### `docs/contracts/`: what a bounded context shows its neighbours

- **What it holds.** API contracts, under stable names. A contract is the only thing a bounded context shows to another. It is the default folder: a contract generated next to the code, or kept in a module or a shared folder, is read where it lives. Only a contract pasted in the chat, or read from a URL, is saved here.
- **Who puts a document there.** A person: in the guide, the architect. A contract pasted in the chat, or read from a URL, is written here by `partition-shape` under the name you give, and validated by you, like a source.
- **When.** Before the prompt that reads it, committed alone. A new version overwrites the same file, committed alone, for example `docs(contracts): <area> 1.4.0 -> 1.5.0`.
- **Who reads it.** `partition-shape`, when the contract is the source of bounded contexts that do not exist yet; its script reads the contract so the assistant does not load it whole. A contract given for a bounded context that already exists, decomposed from another source, is not a new source: it is recorded under `Contracts with neighbours` of that spec. The contract of a system your repository only calls is read where it lives and recorded under `Contracts with neighbours` of the bounded context that calls it; it is never decomposed. The assistant reads a neighbour through its contract only, and `partition-attack` reads the contracts a spec names.

### `docs/designs/`: what one feature builds

- **What it holds.** One design per feature: what it will build, and why. It is read once, then it is history.
- **Who puts a document there.** You, or the process tool you use: Partition does not brainstorm. In the guide, Superpowers may write the design of a feature before its plan. `partition-c4` can print a sequence diagram from the model, ready to paste into a design.
- **When.** Before the plan of the feature, when you write one.
- **Who reads it.** `partition-attack`, when you point it at the design to challenge it. At the closing of the plan, `partition-plan` reads what the design states: a design is not a level, so a statement true for every feature found only there moves to the spec, the area file or the invariant register.

### A spec written before Partition: a source, where it lives

- **What it holds.** A specification written before Partition: one large file with sections of its own, often a history of rulings at the end. It cannot be used as is: it is a source like any other. It stays where it lives, whatever the folder (the guide puts it in `docs/legacy/`, an example, not a convention); it is not moved under `docs/sources/`, and no key declares it.
- **Who puts a document there.** The person who owns it: in the guide, the business analyst. They validate it as the source: it still describes what the system must do.
- **When.** Committed alone, where it lives, before you ask the assistant to decompose it.
- **Who reads it.** `partition-shape`, as it reads any document: _"Decompose `docs/legacy/<file>.md` into bounded contexts, area `<area>`."_ The decomposition records the file at its path and the sha of its commit. A history of rulings is read ruling by ruling, each anchored by its heading and its date; a section on how code is written is reported as a candidate for a rule file; a convention a caller can observe is put to you as two readings, rule file or business rule, neither proposed. The file is never changed: no line is added at its top, no annex is written.

### Persistence schema documents (optional)

- **What it holds.** The documents that describe how your data is stored.
- **Who puts a document there.** You, and only if you document your persistence: declare `paths.schemas` then.
- **Who reads it.** `partition-shape`, as the only source of truth on persistence. When `paths.schemas` is not declared, the `Persistence` section of every spec reads "No schema documents are declared for this project".

## What Partition creates

A skill writes these documents. A person still decides what goes into them: the boundaries, the business rules, the rulings.

### `docs/partition.yml`: the configuration

- **What it holds.** The bounded contexts (each with its id, its area, its code paths and, when it points elsewhere, its spec), the form of each hexagon with its reason and its layer map, the paths above, the budget threshold and the schedule of the assessment, the target assistant and the bridge to a process tool. It follows `partition.schema.json`, shipped with `partition-budget`; the budget stops on a key the schema does not list and names each key to fix.
- **Who puts it there.** `partition-budget` creates it from its template, with you: it asks for the threshold and the schedule of the assessment, asks for no bounded context and never guesses one from your folders, so `contexts:` starts empty. When a plan is opened first, `partition-plan` creates it with the plans folder only, and the rest is filled by `partition-budget`. Later, `partition-shape` declares each new bounded context with its area, `partition-hexagon` writes the form of a hexagon with its reason, and `partition-reshape` declares the bounded context a split creates. Every key keeps its comment, so you can adjust the file by hand.
- **When.** On the first day: _"Set up Partition for this project."_
- **Who reads it.** The budget script, which checks it against the schema before it measures. `partition-plan`, for the plans folder. `partition-gate`, to find the bounded contexts whose code a change touches, and the `spec-auditor` agent, for the spec and the code of the bounded context it audits.

### `docs/specs/<area>/bounded-contexts.md`: the decomposition record

- **What it holds.** How a source was split into the bounded contexts of an area: the source, its version and the commit it was read at, the scope, who decided and how (a workshop or a proposal), the bounded contexts retained, the decisions not to split, the alternatives rejected, the points kept against a criterion, the gaps found in the source, the coverage of each unit, and the history. It holds no rule.
- **Who puts it there.** `partition-shape`, only when a source is decomposed, after you validate its writing plan. It updates the record at each new version of the source; `partition-reshape` updates it after a split or a merge.
- **When.** At the first decomposition of a source into an area, then at each new version and each reshape.
- **Who reads it.** `partition-shape`: whether the record exists, and which commit of the source it records, decide whether it decomposes for the first time or compares a new version. A point the architect kept against a criterion is not proposed again, unless a later version changes, for its units, the criterion it was kept against.

### `docs/specs/<area>/area.md`: the area file

- **What it holds.** The language and the area rules (`AR-n`) shared by the bounded contexts of one area. It is small on purpose: every bounded context of the area reads it.
- **Who puts it there.** `partition-spec`, from its template, when the first entry is validated. The entries come from a source that states a rule for several bounded contexts of the area (`partition-shape`), from what a closed plan established (`partition-plan`), or from what a split or a merge shares (`partition-reshape`). Nothing is written to it before the owner validates it. An area rule is never deduced: a person writes it, or it is copied from a source and confirmed. A person deletes the file once its last entry leaves.
- **When.** The first time a rule or a word is shared within an area. In the guide, it appears when a workshop splits one bounded context in two.
- **Who reads it.** Every bounded context of that area, and only those: it counts in the budget gauge of each. `partition-gate`, `partition-attack` and the `spec-auditor` agent read it with the spec.

### `docs/specs/<area>/<bounded-context>/spec.md`: the durable spec

- **What it holds.** The source of truth of one bounded context, in the present tense: its language, the parts of the source it owns, its business rules, the decisions its source states, its persistence, its contracts with neighbours, the area rules and invariants that apply, and its open questions. A bounded context in no area has its spec at `docs/specs/<bounded-context>/spec.md`.
- **Who puts it there.** `partition-shape` writes it from a source, pointing to the parts it owns, through the steps `partition-spec` gives for the spec of a new bounded context. Every new bounded context comes from a source: a PRD, an API contract, a spec written before Partition, or a context you describe, saved as a source first; only the one a split creates comes from `partition-reshape`. Nothing is written before you validate the plan, and a new bounded context is validated by name. When the source states no rule for it, the business rules stay under their "TO FILL" banner until a person writes them. You write or confirm the business rules and the language: copied rules wait under a "TO VALIDATE" banner, an empty section under "TO FILL", and a bounded context under a banner is not fit for design.
- **When.** When a bounded context is created. Then, every time a behaviour must change or the code and the spec disagree: the spec moves first, you validate the change, and only then does the code follow.
- **Who reads it.** Every task of its bounded context, which is why its size counts in the budget. `partition-gate`, `partition-attack` and the `spec-auditor` agent read it as the oracle of the code.

### `docs/specs/invariants.md`: the invariant register

- **What it holds.** The statements that are true for every feature, span at least two areas or layers, and are a defect when broken, one line each, `INV-{CAT}-{NNN}`.
- **Who puts it there.** `partition-spec`, from its template, when the first entry passes the admission test and the owner validates it. Candidates come from a source that states an invariant, from the closing of a plan, or from a ruling on patterns or a rule that binds the whole project. Most plans admit nothing; that is the normal outcome.
- **When.** Rarely, and never before the owner validates the line.
- **Who reads it.** Every bounded context: the budget counts it in what every session loads. `partition-gate`, `partition-attack` and the `spec-auditor` agent read it with the spec.

### `docs/plans/`: the state of the work

- **What it holds.** One plan per feature and bounded context: a header (`Status`, `Resume at`, `Last updated`), a task index, each task with its verification command and its expected result, then `## Decisions` and `## Blockers`. Once closed, it stays as the dated record of why.
- **Who puts it there.** `partition-plan` opens it from its template. The assistant writes it before every reply: what is done, where to resume, every decision, every blocker. It does not commit; you do. With `bridge: superpowers`, the plugin writes the body, in the same folder, and Partition adds its header, its index and its two sections.
- **When.** When planned work starts, at every turn, and at the closing, which runs `partition-gate` and sends what the work established to its level, each entry validated by you.
- **Who reads it.** The assistant, on _"Resume."_: the header, the task index, the task named in `Resume at` and the blockers, nothing more. A `done` plan is not read. `partition-budget` measures each plan in progress against what a resume reads.

### `docs/architecture/model.yml`: the C4, as text

- **What it holds.** The systems, containers and components, their relations, the bounded context of each container and component, and the views. `partition-c4` generates `docs/architecture/c4.drawio` from it, one page per view; what a person positions by hand in draw.io stays where they put it.
- **Who puts it there.** `partition-c4`, from its template, or from the hand-drawn `.drawio` file your team already has, read once. The kind and the parent of a box the drawing leaves open are asked, never guessed, and an element enters only when a source establishes it: the code, a decision, the owner. After a reshape or a plan that changed the architecture, the model is updated the same way.
- **When.** When you first describe the architecture, optionally on the first day; then whenever the architecture changes.
- **Who reads it.** `partition-c4`, which reads the model, never the generated draw.io file, to learn the architecture.

### `docs/architecture/patterns-grid.md`: your rulings on patterns

- **What it holds.** The project's criteria (five shipped as a starting point, which the owner edits), its rulings (where, which pattern, the ruling, one cell per criterion, the reason, the date) and its audits. "No pattern" is a ruling like the others.
- **Who puts it there.** `partition-patterns`, from its template, the first time a ruling is made. The assistant sets out the candidates and recommends one; the owner rules.
- **When.** At design time, before a pattern, an abstraction, an extension point or a layer enters the code; and at each audit, which adds a row.
- **Who reads it.** `partition-patterns`: a ruling that already covers the place is applied and cited, not reopened; an audit replays every ruling against the code.

### `docs/architecture/reshapes/`: the record of each reshape

- **What it holds.** One file per fission, merge, removal, move or promotion, `YYYY-MM-DD-<name>.md`: when it was decided, by whom and how, from where to where, what raised it, why the line goes there, the challenge of the workshop's result, the integration across the new line, and where each rule went.
- **Who puts it there.** `partition-reshape`, from its template, once the architect has decided. It fills what was decided and by whom; what the workshop left open goes to the owner as questions, not into the record.
- **When.** After the decision (on the boundary, or on a promotion); the move itself is then carried out through a plan.
- **Who reads it.** The architect, at the next boundary decision. `partition-budget`, at the scheduled assessment, to explain a gauge.

### `docs/budget/YYYY-MM-DD.md`: the assessments

- **What it holds.** One record per day of assessment: who held it, the output of the budget script pasted unedited, what changed since the last record, what the coming features need to load against what they will load, the warning signs observed, and the decision with the names of those who took it.
- **Who puts it there.** `partition-budget`, from its template. Every figure comes from the run; none is written by hand.
- **When.** The first measure, at setup, is the baseline. Then on the schedule `docs/partition.yml` sets (`budget.review`), earlier when a warning sign appears, and again after a reshape. A second assessment the same day replaces that day's record; an earlier day's record is never overwritten: the series is the trend.
- **Who reads it.** `partition-budget`, which compares with the previous record and says what moved. `partition-reshape`, when it prepares the material of a boundary workshop.

### `.apm/instructions/`: your rules

- **What it holds.** Your rules: how code is written in this project, one topic per file, `<profile>-<topic>.instructions.md`, each with a `description` and an `applyTo` that names the files it concerns. The package ships no rule, only the skeletons of a backend and a frontend profile, as questions.
- **Who puts it there.** `partition-rules`, from two sources only: the code as it is, and your answers. When it migrates rules you already have, it proposes the files and their scope and waits for your validation, then moves the text without rewriting it.
- **When.** At setup, when you migrate the rules your assistant loads in every session. Then whenever you add or change a rule, and whenever a decomposition or the closing of a plan finds a statement about how code is written: a section of a source on how code is written is reported as a candidate, and written only on your word; a convention a caller can observe is put to you as two readings, rule file or business rule, neither proposed.
- **Who reads it.** `apm install` deploys each rule to every assistant in its own format; never edit the deployed copies. The assistant then loads a rule only when a file of its scope is in play. Only the entry file of your project stays unscoped. `partition-budget` counts the rules that match the code of each bounded context in its gauge, and lists any rule without a scope as the first thing to fix.

## Go deeper

- [Step 01](https://github.com/elie29/partition/blob/main/docs/guides/a-project-step-by-step/01-configuration-and-rules.md#the-shape-after): `docs/partition.yml`, the plans folder, the rules migrated and scoped, the first budget record.
- [Step 02](https://github.com/elie29/partition/blob/main/docs/guides/a-project-step-by-step/02-first-bounded-context.md): a source saved to `docs/sources/`, the decomposition record and the first spec.
- [Step 03](https://github.com/elie29/partition/blob/main/docs/guides/a-project-step-by-step/03-architecture.md): a hand-drawn diagram becomes `model.yml`; the first ruling in the pattern grid.
- [Step 04](https://github.com/elie29/partition/blob/main/docs/guides/a-project-step-by-step/04-first-feature.md): the first contract in `docs/contracts/`, a design and a plan.
- [Step 06](https://github.com/elie29/partition/blob/main/docs/guides/a-project-step-by-step/06-fission.md#the-shape-after): a workshop result in `docs/sources/`, the first reshape record and the area file.
- [Step 16](https://github.com/elie29/partition/blob/main/docs/guides/a-project-step-by-step/16-old-spec-as-source.md): a spec written before Partition, decomposed as a source where it lives, in `docs/legacy/`, and left unchanged.
- [Step 18](https://github.com/elie29/partition/blob/main/docs/guides/a-project-step-by-step/18-assessment.md): the scheduled budget assessment and the pattern audit.
- [What your project owns](https://github.com/elie29/partition/blob/main/README.md#what-your-project-owns), in the README, and the documents of the [glossary](https://github.com/elie29/partition/blob/main/.apm/skills/partition-spec/references/glossary.md#documents).

Back to the [series](README.md).
