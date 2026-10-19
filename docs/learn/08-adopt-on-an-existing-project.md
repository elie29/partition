# Adopt Partition on an existing project

Your repository already runs. It has years of code, contracts it serves, systems it calls, and a domain the team carries in its head and in a few documents. Adopting Partition on it happens in two phases, and the line between them is firm: first, once, you gather the sources of the repository with an AI assistant, outside the package; then Partition takes them from there, exactly as on a project that starts today. The code you have is kept: its spec leads from then on, and the code follows on the next change that touches it.

Why the method works this way is in [Why Partition](01-why-partition.md); where each document of this article goes is in [the repository map](02-repository-map.md). This article does not repeat the journeys it reuses: it says what is different when the code exists, and links to the rest.

## The situation

You want the assistant to work from one durable spec per bounded context on a repository that has none, or only an old specification nobody keeps up to date. Nobody on the team has time to write a PRD of what the code already does. You want the specs to say what is true of the domain, the boundaries to be drawn by your architect, and nothing in your code to move because a tool decided it should.

Partition is the companion of one repository with one business domain. The adoption describes this repository: what it owns and what it only calls. It does not model the estate around it, the other systems of your company or a whole ERP or CRM: [what Partition is not](01-why-partition.md#what-partition-is-not) says why.

### The two phases

|  | Before Partition, outside the package | With Partition |
| --- | --- | --- |
| When | Once, possibly before the package is installed | From the install on, as on any project |
| Who works | You and an AI assistant of your choice, in one session | The assistant with the `partition-*` skills, and you |
| What it produces | **Sources only**: the contracts the repository exposes, a description of the domain, the architecture decisions settled now, an existing diagram when there is one, and the **perimeter** | Everything Partition normally produces: `docs/partition.yml`, the specs, the area files, the invariant register, the C4 model, the rule files |
| Who validates | The owner of each source, who commits it alone | You, at each stop the skills make, as in every other journey |

The first phase is not a Partition skill. No skill of the package runs it, and the package gives no procedure for it: it is a working session you hold with an assistant to put on paper what your repository is. Partition starts reading at the second phase, from the files the first one left.

## What you bring

### Before Partition: the sources, and the perimeter

The aim of the session is the most complete picture of the repository that can be identified, written as sources Partition knows how to read. Each one goes where [the repository map](02-repository-map.md) puts it.

**The perimeter.** What this repository owns, the business it decides, and what it only calls, each other system by its name and what it is called for. It is the line that tells the assistant what belongs here. It goes into the description of the domain, as a section of its own. The Perimeter section only gives context: it is not a unit, so it is not decomposed. A system you only call is named there, and weighs in the decision only as a third party the source names; an unnamed one never counts.

**The contracts the repository exposes.** One OpenAPI file per API the code serves, as it serves it today, under a stable name. A contract you already keep is a source as it is, read where it lives: generated next to the code, in an API module or in a shared folder, it is not moved. One you write now goes, by default, to `docs/contracts/` ([the repository map](02-repository-map.md#docscontracts-what-a-bounded-context-shows-its-neighbours)). The contract of a system the repository only calls is not one of them: it is never decomposed, as [the bounded contexts](#the-bounded-contexts-from-your-sources-through-partition-shape) below says.

**A description of the domain.** A Markdown file, by default in `docs/sources/`, under a stable name ([the repository map](02-repository-map.md#docssources-what-the-system-is-specified-by)), written so that `partition-shape` can read it:

- **One requirement per behaviour, each under a stable identifier** (`REQ-1`, `REQ-2`) or a heading of its own. A part with no stable anchor is not decomposed: the assistant lists it as a gap and asks which anchor it should carry.
- **The rules your team confirms, each a sentence after `Rule:`.** A marked sentence is the whole rule, and only a rule the source states is copied into a spec. A sentence that only suggests a rule becomes an open question.
- **The business entities, each with one name.** The root aggregate of a requirement is the entity it acts on, as the source names it; two words for one entity are one entity only when the source says so.
- **The architecture decisions settled now, each with its reason.** A decision the source states, with its reason, is copied into the `Decisions` of the spec, dated by the version of the source. A choice recorded without its reason is only pointed to. No other folder holds them: a decision taken later, while building, goes to the `## Decisions` of the plan, and what it establishes to the spec at the closing.

**An existing diagram**, when your team has one: a hand-drawn `.drawio` file, kept as it is. In the guide it sits at `docs/architecture/<diagram>.drawio`, an example, not a convention.

**An existing specification**, when your team wrote one before Partition, and any other document that explains what the project does: it is not rewritten in this session, and not moved. It stays where it lives, whatever its folder. Its owner validates it as the source, saying it still describes what the system must do, and commits it alone; Partition decomposes it in the second phase like any other source ([the repository map](02-repository-map.md#a-spec-written-before-partition-a-source-where-it-lives)).

Before you commit, the owner of each source reads it, corrects it and keeps on `Rule:` only the sentences the team confirms. Then each source is committed alone, as every source of the guide is: the decomposition records the commit of a source, and every later version is compared from it.

**What the session does not write.** No `docs/partition.yml`, no spec, no area file, no invariant register, no C4 model, no rule file. Each of them is created with Partition, in the second phase, by the skill that owns it and with your validation. A document written outside the package would skip the stops where a person decides: the boundary, the business rules, the scope of a rule.

### With Partition: what you bring to each journey

The same entries as on any project, with the existing code as one more thing the people answer from:

- **For the setup**, the answers of [Set up a project](03-set-up.md#what-you-bring). The bounded contexts are not listed by hand: you name the source and the area, and the contexts come from the source. Your existing entry file (a `CLAUDE.md`, an `AGENTS.md`) is the rules you migrate.
- **For each bounded context**, the entries of [Create a bounded context](04-create-a-bounded-context.md#what-you-bring): the source and the area, the architect's choice of the way to decide the boundary, the business rules confirmed by a person. The **code path** of each new context is where its code already lives: the tech lead gives it, the assistant never guesses it from your folders.
- **For the architecture**, your diagram, and the answers it leaves open. The form of each hexagon and its layer map come from the architect, not from the folders as they are.

## What you say

### Before Partition: an example prompt

This prompt is written for this article. It is not a Partition skill and calls none; use it, or your own, with any assistant, in the repository:

> Read this repository and help me describe it, so that my team can validate the description. Change no code. Write only the files I list here, and nothing else.
>
> 1. `docs/contracts/<name>.openapi.json`: one OpenAPI file per API this code serves, as it serves it today. Where an existing contract and the code differ, list the differences; do not choose.
> 2. `docs/sources/<name>.md`: a description of the domain. Start it with `Version 1.0`. Then:
>    - a section **Perimeter**: what this repository owns, the business it decides; and what it only calls, each other system by its name, with what it calls it for;
>    - the business entities, one name each, in the words the code and the team use; when the code uses two words for one thing, say so and ask me;
>    - one requirement per behaviour the code implements, each under its own identifier, `REQ-1`, `REQ-2`, in order;
>    - each condition the code enforces, as a sentence after `Candidate rule:`, with the file and the line that enforce it on the next line; I will decide which ones are rules;
>    - the architecture decisions you can see settled, each with its reason when the code or a document gives one, otherwise as a question;
>    - every question you cannot answer from the code, one per line.
> 3. If a hand-drawn diagram of the architecture exists in the repository, tell me where; do not draw one.
>
> Do not group the requirements, and propose no structure: how the domain splits is decided later, by the architect. Invent nothing: what the code does not show is a question to me.

The `Candidate rule:` lines, drafted from the code, are for a project that no spec or other document explains. When one does, it is the source of the rules: it is decomposed as it is, and a rule is drafted from the code for none of its parts.

Then read what came back with the people who own each part: the product owner for the requirements, the architect for the contracts and the decisions. The `Candidate rule:` lines were drafted outside the package, from what the code enforces. A condition the code enforces may be a bug: the spec will lead, not the code. A line becomes a rule only on your team's word, as a rule of the domain. Turn each one your team confirms into `Rule:`; delete the others, or turn them into questions. Leave no `Candidate rule:` line in a source you commit. Then commit each source alone.

### With Partition: the same prompts as on any project

Install the package as [Set up a project](03-set-up.md#what-you-say) shows, then, in a fresh session, from the README's _The first day_:

> Set up Partition for this project.
>
> Measure the context budget.
>
> Our rules load in every session, fix that.

Then the bounded contexts, one area at a time, as the README does:

> Decompose `docs/sources/<name>.md` into bounded contexts, area `<area>`.

or, from a contract: _"Decompose `docs/contracts/<name>.openapi.json` into bounded contexts, area `<area>`."_ A source is named at its path, wherever it lives. For a specification your team wrote before Partition, as for any source:

> Decompose `docs/legacy/<file>.md` into bounded contexts, area `<area>`.

For the architecture, from the README's _Day to day_: _"Turn our draw.io into the model."_, then _"Check the architecture."_ once the hexagons have their form.

To see where the existing code and its new spec disagree, without a change in hand, from the README's _Day to day_:

> Audit `<bounded-context>` against its spec.

And when a change meets a disagreement: _"The code and the spec disagree."_

## What comes back

### Phase 1: nothing from Partition

The first phase leaves files you wrote and validated, by default in `docs/contracts/` and `docs/sources/`, beside the specs and contracts you already had, where they live; each committed alone. Installing the package afterwards writes nothing under `docs/` ([Set up a project](03-set-up.md#the-install-the-package-and-nothing-under-docs)), so your sources are never overwritten: Partition reads them when you ask, and not before.

### The setup: as on any project

`partition-budget` creates `docs/partition.yml` with you, from the template it ships. It asks for no bounded context and does not guess one from your folder tree: they come from a source, and `contexts:` stays absent or empty until `partition-shape` declares them. The first measure is the baseline. On a repository that has lived for years, the entry file your assistant loads in every session is often long: `partition-rules` lists the rules without a scope, proposes one file per topic with the files each really concerns, waits for your validation, and moves the text without rewriting it. When you ask it to start rules for a topic that has none, it answers each question from two sources only, the code as it is and your answers, quoting the file that shows a convention and asking you when the code shows two. All of it is in [Set up a project](03-set-up.md#what-comes-back).

### The bounded contexts: from your sources, through `partition-shape`

`partition-shape` reads each source you name, inventories its units, weighs each against the six written criteria and asks the architect how to decide the boundary: a workshop or a proposal. Then the hard stop: the writing plan, and a new bounded context validated by name. Once you validate, it writes one spec per bounded context, pointing to the parts of the source it owns, the rules your source states copied word for word under a **"TO VALIDATE"** banner, and the context declared in `docs/partition.yml` with its area and, once given, its code paths. A person confirms the rules; until the banner comes off, the context is not fit for design. Every detail is in [Create a bounded context](04-create-a-bounded-context.md#from-a-source-partition-shape-up-to-a-hard-stop).

Four points matter more on an existing repository:

- **The rule your team marked is copied, not trusted.** A rule is never deduced from code, a field name or an example, and `partition-shape` does not read one from your code: only what the source states is copied, never what the code does, and a person still confirms it. A rule enters your source on your team's word, as a rule of the domain; a candidate you did not confirm is not in the source as a rule, at most as a question, which becomes an open question of the spec.
- **One source per decomposition.** When you decompose an area from the description, a contract given later for a bounded context that exists is not a second source of that decomposition: it is the contract that context shows its neighbours, recorded in its `Contracts with neighbours`, and the recorded source stays the only one.
- **A system you only call is not decomposed.** Its contract is read where it lives and recorded in `Contracts with neighbours` of the bounded context that calls it.
- **Documentation only.** `partition-shape` writes documentation: never code, and never a change to a source. Your code is exactly as it was after every decomposition.

A specification your team wrote before Partition is decomposed the same way, read where it lives and never changed. Its owner has validated it as the source; the reader's preconditions and inventory report what it leaves unsettled; the architect decides the boundaries; a person confirms each copied rule. A rule another spec already holds is reported, never moved: a person names its owner. Its history of rulings, a section on how code is written and a file of invariants are read as [Create a bounded context](04-create-a-bounded-context.md#a-spec-written-before-partition-decomposed-as-a-source) says.

### The architecture: the C4 model, and the code checked against the map

`partition-c4` writes `docs/architecture/model.yml` from your hand-drawn diagram, read once, or from its template. An element enters only when a source establishes it: the code, a decision, the owner. A container guessed from a folder name is an invention, and a box whose kind or parent is left open is a question to you.

`partition-hexagon` chooses the form of each hexagon from the `Business rules` of its spec, not from the code, and the layer map is written with the owner from the project's architecture rule, never inferred from the folders. Then, asked to check, it reads the existing code against the map and reports every dependency that is not allowed, with `file:line` and the two layers, and one hexagon importing from another instead of going through a contract. It changes nothing while checking. A finding is fixed through a plan; when the code departs from the map beyond the scope of the current change, it points it out and asks before refactoring.

### The existing code: kept, and led by its spec

Once a bounded context has its spec, the spec is the source of truth and the code implements it. Nothing is rewritten to adopt Partition. The code follows the spec on the next change that touches it, through the plan of that change, delivered as in [Deliver through a plan](05-deliver-through-a-plan.md).

**Where code and spec disagree**, it is the case of step 05 of the guide: the spec moves first. `partition-spec` says which side is wrong and why: a spec incomplete, outdated or ambiguous, or the code a bug; when it cannot tell, it asks. It never edits the spec to match the code because the code is what runs. When the spec is wrong, it corrects it, shows the change and gets it validated, and only then does the code follow, through a plan; when the code is wrong, the spec stays and the code is fixed through a plan. A rule copied from your source changes only through your source. The whole case is in [Change at any moment](06-change-at-any-moment.md#the-spec-moves-first-partition-spec).

You look for those disagreements before any change: once the rules of each new bounded context are confirmed, run the `spec-auditor` agent on it. It reads the code of that bounded context against its spec, as a reader who did not write the code, and reports each gap with its evidence and which side is wrong; the spec moves first. It changes nothing.

**Where the code does not respect a boundary**, a dependency that crosses between two bounded contexts without an interface, it is a reshape, and the architect decides it. Partition never decides a boundary: before one moves, the assistant tells the architect the decision is theirs and asks the way, a workshop or a proposal. When it prepares a workshop, `partition-reshape` lists the dependencies that do not go through an interface today, with `file:line`: they are the price of the move, paid before it. A missing precondition is its own piece of work, with its own plan, before the move; each move is validated by name before it starts, and is carried out through a plan (`partition-plan`), the specs changing in the same plan as the code, and proven a move after it. The whole order is in [Reshape when it grows](07-reshape-when-it-grows.md#before-a-boundary-moves-the-architect-decides), and the move in [its plan](07-reshape-when-it-grows.md#the-move-through-a-plan-proven-a-move).

### Then: a project like any other

Once its sources are decomposed and its rules confirmed, an adopted project is where a decomposition leaves any project. Every other journey applies to it unchanged: [deliver through a plan](05-deliver-through-a-plan.md), [change at any moment](06-change-at-any-moment.md), [reshape when it grows](07-reshape-when-it-grows.md).

## What you decide

**Before Partition:**

- **The perimeter**: what the repository owns and what it only calls.
- **Each source, as written.** You read it, correct it and keep only the rules the team confirms. The assistant of that session proposes; you validate.
- **Every commit of a source**, each one alone, before the prompt that reads it.

**With Partition**, as on any project:

- **The setup answers**, the migration of your rules and the scope of each.
- **The area of each decomposition**, and **each new bounded context, by name**, at the hard stop.
- **Each old spec, as the source**: its owner validates it; a person names the owner of a rule another spec already holds.
- **The boundary**: the architect chooses the way, then the split.
- **The code path of each bounded context**: where its code already lives.
- **The business rules and the language.** The banner comes off only on a person's word.
- **The form of each hexagon and its layer map**, from the architect.

**On the existing code:**

- **Which side is wrong**, when code and spec disagree and the assistant cannot tell, and **every change of the spec**, before the code moves.
- **Every boundary the code breaks**: the architect decides the reshape, and each move is validated by name.
- **Every change of code.** Nothing changes code without your confirmation: it goes through a plan you validate.
- **Every commit.** The assistant never commits.

## Go deeper

The guide has no step for a codebase without a spec; these steps show the mechanics this article relies on.

- [Step 00](https://github.com/elie29/partition/blob/main/docs/guides/a-project-step-by-step/00-empty-folder.md): the package installed beside the rules a team wrote before Partition, and the check in a fresh session.
- [Step 01](https://github.com/elie29/partition/blob/main/docs/guides/a-project-step-by-step/01-configuration-and-rules.md#the-shape-after): `docs/partition.yml` created with you, the rules of the entry file migrated and scoped, the first budget record.
- [Step 02](https://github.com/elie29/partition/blob/main/docs/guides/a-project-step-by-step/02-first-bounded-context.md#the-shape-after): a source saved and decomposed into a bounded context, its rules confirmed by a person.
- [Step 05](https://github.com/elie29/partition/blob/main/docs/guides/a-project-step-by-step/05-spec-moves-first.md#the-shape-after): code and spec disagree; the spec moves first, then the code, through a plan.
- [Step 16](https://github.com/elie29/partition/blob/main/docs/guides/a-project-step-by-step/16-old-spec-as-source.md#the-shape-after): a specification written before Partition, decomposed as a source where it lives, and the code following one bounded context at a time.
- [Bounded contexts come from a source](https://github.com/elie29/partition/blob/main/README.md#bounded-contexts-come-from-a-source) and [The first day](https://github.com/elie29/partition/blob/main/README.md#the-first-day), in the README.
- The skills behind this article: [`partition-shape`](https://github.com/elie29/partition/blob/main/.apm/skills/partition-shape/SKILL.md) and its [reader of a document](https://github.com/elie29/partition/blob/main/.apm/skills/partition-shape/references/sources/document.md), [`partition-spec`](https://github.com/elie29/partition/blob/main/.apm/skills/partition-spec/SKILL.md), [`partition-budget`](https://github.com/elie29/partition/blob/main/.apm/skills/partition-budget/SKILL.md), [`partition-rules`](https://github.com/elie29/partition/blob/main/.apm/skills/partition-rules/SKILL.md), [`partition-c4`](https://github.com/elie29/partition/blob/main/.apm/skills/partition-c4/SKILL.md), [`partition-hexagon`](https://github.com/elie29/partition/blob/main/.apm/skills/partition-hexagon/SKILL.md), [`partition-reshape`](https://github.com/elie29/partition/blob/main/.apm/skills/partition-reshape/SKILL.md), and the [`spec-auditor`](https://github.com/elie29/partition/blob/main/.apm/agents/spec-auditor.agent.md) agent.

Back to the [series](README.md).
