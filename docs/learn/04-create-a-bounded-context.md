# Create a bounded context

The second journey: from what your system is specified by to one durable spec per bounded context, with its business rules confirmed by a person, its architecture written as text, and its spec attacked before anyone plans against it. It covers a PRD, an API contract, a context you describe, and a spec your team wrote before Partition, each a source that enters the same way. Why bounded contexts come from a source is in [Why Partition](01-why-partition.md#bounded-contexts-come-from-a-source); where each document of this article lives is in [the repository map](02-repository-map.md); the configuration it adds to is the one of [Set up a project](03-set-up.md).

![Create a bounded context, always from a source, a context you describe included. When a document describes it (an API contract, a PRD, a spec written before Partition): A, you name the source, read where it lives, any file of the repository or a URL; a source pasted in the chat, or a contract at a URL, is saved first, validated by you and committed alone. When there is no document behind it, described in the chat: A, you describe the context, saved as a source under docs/sources/, validated by you and committed alone; it joins the same path at B. Then: B, the assistant decomposes it with partition-shape, from the source and the area you name, weighing every unit against the six criteria, and the architect picks the way, a workshop or a proposal; C, a hard stop where you validate the split, each new context by name; D, partition-shape writes one spec per context, pointing to its source, with the rules, invariants and decisions the source states copied under "TO VALIDATE"; E, you confirm and fill the business rules, and until the banner comes off the context is not fit for design; F, partition-attack attacks the spec before planning and writes its findings into it; G, partition-hexagon and partition-c4 choose its form and its container in the C4 model. Then design and deliver, in journey 3.](../../assets/flow-2-create.svg)

In the figure, a blue step is the assistant with the skill it uses; an amber step is yours.

## The situation

Partition is installed and configured, and your repository has no durable spec yet, or not for the part you are about to build. Somewhere there is a document that says what the system must do: a PRD from the product owner, an API contract, a team's notes, or a long specification written before Partition. You want the assistant to work from one spec per bounded context, true now, without it inventing a rule or drawing a boundary for you.

## What you bring

**A source, as a file, committed alone.** A source is what the system is specified by: an API contract, a PRD, a spec written before Partition, or a context someone describes. It is read where it lives: any file of the repository, whatever its folder, or a URL. A source you write for Partition goes, by default, to `docs/sources/`, a contract to `docs/contracts/`, each under a stable name that every new version overwrites ([the repository map](02-repository-map.md#docssources-what-the-system-is-specified-by) says who puts what there). In the guide, `[PO]` brings the PRD. Commit the source alone, before the prompt that reads it: the decomposition records the commit of the source, and every later version is compared from it. A source decomposed uncommitted is recorded as `uncommitted`, and its next version has no base to be compared from.

You may paste the source in the chat instead. The assistant then never decomposes from the chat: it asks you for a file name, writes the source to `docs/sources/` (a contract to `docs/contracts/`), shows it and waits for your validation. Commit it alone before you go on. A contract you give by its URL is saved the same way first; a document at a URL is read where it is, recorded with its version or the date it was read.

**A context with no document behind it, described.** When nothing is written yet, you describe the context in the chat. The assistant saves your description as a source under `docs/sources/`, under a name you give, shows it and waits for your validation; you commit it alone, and it is decomposed like any other source.

**The area.** The folder under `docs/specs/` the bounded contexts go into, such as `billing`. It is mandatory and never inferred: not from the name of the source, its title or a heading, not even when one source is all there is. When you do not name it, the assistant asks, showing the areas that exist.

**The architect's choice of how to decide the boundary.** Before a boundary is shown as a decision, the assistant asks the architect which way: a workshop, or a proposal. In the guide, `[architect]` answers _a proposal_.

**The code path of each new bounded context.** The assistant asks; it never guesses one from your folders. In the guide, `[TL]` gives it. Until it is given, the context is declared without it and the question stays open.

**The confirmation of the business rules, and the language.** A person confirms each rule the source states, writes the missing ones, and gives the meaning of each word, one meaning per word. In the guide, `[BA]` does it. When the source contradicts itself, the owner of the source says which requirement holds: in the guide, `[PO]`.

**For the architecture, when you describe it now.** The team's hand-drawn `.drawio` file if there is one, and the answers it leaves open: what each box is (a system, a container, a component) and what it belongs to. The form of each hexagon and its layer map, with the reason. In the guide, `[architect]` brings all three.

**For a spec written before Partition: the file, where it lives, committed alone.** A specification your team wrote before Partition, wherever it lives (the guide puts it in `docs/legacy/`, an example, not a convention), committed alone before you ask. It is not moved under `docs/sources/`. The person who owns it validates it as the source: it still describes what the system must do. In the guide, `[BA]`. How many bounded contexts it describes is the architect's decision, as for any source.

## What you say

**From a source already in the repository**, name the source and the area, as the README does:

> Decompose `docs/sources/<name>.md` into bounded contexts, area `<area>`.

**From a source pasted in the chat**, as the guide does, after pasting it:

> Here is our PRD. Find its bounded contexts.

Answer its questions: the file name, the area. Once the source is saved, commit it alone, then say _"Go on."_ When it asks how to decide the boundary, answer _"A proposal."_ or _"A workshop."_. Validate the writing plan by name: _"Create the bounded context `<name>`."_

**To confirm the rules**, once you have read them, in the guide's words:

> I confirm BR-1 to BR-6 as written; there is no other rule. Here is the language of `<bounded-context>`: (your table of terms and meanings).

**To describe the architecture**, one piece of planned work, as the guide does:

> Open a plan for the architecture baseline: the C4 model from `docs/architecture/<diagram>.drawio`, the hexagon of `<bounded-context>`.

or one request at a time, from the README's _Day to day_: _"Turn our draw.io into the model."_, _"Add a container."_

**Before you plan**, from the README's _Day to day_:

> Attack this spec before we plan.

**From a spec written before Partition**, as from any source, at its path, as the guide does:

> Decompose `docs/legacy/<file>.md`, area `<area>`.

**For a context with no document behind it**, describe it in the chat and ask for its bounded contexts, as for a pasted source: `partition-shape` answers, and the steps are below.

## What comes back

### From a source: `partition-shape`, up to a hard stop

`partition-shape` reads the source restricted to its scope (the whole source unless you name one) and inventories its **units**: an operation of an API contract, or a requirement or story of a document under its anchor, or a section when the document identifies none. A part that only records decisions, defines terms or gives context is not a unit. For a contract, a script reads the file and prints only what the decision needs, so the assistant does not load tens of kilobytes; a document is read.

Each unit is weighed against the six written criteria. A bounded context is retained only when it has a root aggregate of its own and one more reason: its own language, its own life cycle, or its own named external dependencies. Shared data or shared business rules argue against a split. Three outcomes are legitimate: several bounded contexts, a single one, or a source too ambiguous to decide, in which case the assistant lists the ambiguities, asks, and writes nothing. A decision not to split is justified as explicitly as a split.

**The architect decides the boundary.** Before it shows a decision, the assistant tells you what is at stake (the units, the candidate aggregates, the zones the criteria leave open), says that the decision is the architect's, and asks which way you want, unless your request already named it:

- **A workshop.** It hands over the material and stops, writing nothing: the domain events the source names, the words that carry two meanings, the candidate aggregates and the units acting on each, the data and rules the candidates share. The result of your workshop comes back in any readable form; it is saved under `docs/sources/`, validated by you, then challenged point by point against the source, the criteria and the existing specs. Each finding comes with what it contradicts and an improvement; the architect takes or refuses each one.
- **A proposal.** Two or three numbered options side by side, each with the criteria it satisfies, the criterion it breaks, what it costs and what it brings, and one recommended. The recommended option breaks no criterion; an option that keeps a point against one may be shown, never recommended. When the criteria leave a single split, it says so and why the others fall; it never invents an option to make up a number.

A point the architect keeps against a criterion is recorded with the criterion, the names, the date and the reason, and is not proposed again unless a later version of the source changes, for the units of that point, the criterion it was kept against.

Then the **hard stop**: the writing plan, before anything is written. In the guide, it reads:

```text
Source             : docs/sources/billing.md
Version            : 1.0
Provenance         : <sha of "docs(sources): billing 1.0">
Scope              : whole source
Units read         : 5 in scope / 5 in the source
Out of scope       : none
Bounded contexts   : invoice (1 retained)
Decided            : proposal, option 1 · you, as [architect]

Writing plan:
  + docs/specs/billing/bounded-contexts.md
  + docs/specs/billing/invoice/spec.md
  ≈ docs/partition.yml                      (declares invoice: area billing, code paths to ask)

Copied from the source (word for word, to confirm):
  invoice  rules      : "An invoice is issued once per order" (REQ-1), ...
```

It waits for an explicit validation. A new bounded context is validated by name; a general "go ahead" does not cover it. With a proposal, its name is the assistant's, from the naming rule of the criteria: you keep it or choose another when you decide the boundary. An answer that asks for another split sends it back to the decision.

### What is written, once you validate

- **`docs/specs/<area>/bounded-contexts.md`**, the decomposition record: the source, its version, the commit it was read at, the scope, who decided and how, the bounded contexts retained, the decisions not to split, the alternatives rejected, the points kept against a criterion, the gaps found in the source, one coverage line per unit, and an empty history that each new version of the source appends to.
- **`docs/specs/<area>/<bounded-context>/spec.md`**, one per bounded context, from the spec template, with its header naming the source, its version, its provenance and its scope. The spec **points to its source**: `Source parts owned` lists the units it owns, each a link to its anchor, with no requirement text, field or error code copied. Only three things are copied, word for word with their anchor: the business rules, the invariants and the decisions the source states. The rules sit under a **"TO VALIDATE"** banner; in the guide:

  | #    | Rule                                 | Source             |
  | ---- | ------------------------------------ | ------------------ |
  | BR-1 | An invoice is issued once per order. | from source: REQ-1 |
  | BR-3 | An issued invoice is never modified. | from source: REQ-2 |

  `Language` and `Contracts with neighbours` are left empty: a person writes them. What the source does not settle goes to `Open questions`, one per line, worded so it can be answered. When the project declares no schema documents, `Persistence` says so.

- **`docs/specs/<area>/area.md`**, only when the source states a rule for units of several bounded contexts with no owner among them: the rule is copied once, there, under its banner, never into each spec.
- **`docs/partition.yml`** declares each new bounded context with its area, and its code paths once you give them.

A rule the source states is never rewritten, and no rule is ever deduced: not from a field name, an example or the code. With none stated, `Business rules` keeps its **"TO FILL"** banner. A contradiction inside the source is not settled by the assistant: it asks the owner of the source which requirement holds and proposes no wording. A contradiction with what the repository already holds is reported to you as a gap, never settled. The closing report lists the files written, the sections whose banner is still up, with the explicit mention that these bounded contexts **are not usable** yet, the gaps to settle, the candidates for the invariant register with their verdict ("no candidate retained" is the normal outcome), and the open questions that block the design.

### A context you describe: saved as a source first

When no document describes the context, `partition-shape` still creates it, from a source: your description. It asks you for a name, writes the description under `docs/sources/`, shows it and waits for your validation, then decomposes it as above, up to the same hard stop. `partition-spec` writes the spec of each context `partition-shape` retains; it never starts a bounded context on its own. When your description states no rule, `Business rules` keeps its "TO FILL" banner until a person writes them. The architect still decides where the boundary goes; the assistant never decides one.

### The language: one meaning per word

When you give the language, `partition-spec` writes each word with one meaning. A word you give two meanings inside one bounded context is not written: the assistant asks which meaning holds there and whether the other belongs to another bounded context, recalls that a word meaning something else in a neighbour marks a boundary, and records the question under `Open questions` until a person settles it. In the guide, "Cancelled" means "voided before any payment" for one invoice and "reversed within 24 hours" for another: the question stays open, and a later workshop answers it with a split.

### The rules confirmed, and the banner removed

When you confirm the copied rules and fill the missing ones, the banner comes off. Until then the bounded context is not fit for design or implementation, and the assistant says so: asked for the form of the hexagon while the banner stands, `partition-hexagon` says the form cannot be chosen, and gives no reading of the copied rules.

### The architecture: the C4 model as text, and the form of each hexagon

`partition-c4` keeps the architecture in one text file, `docs/architecture/model.yml`: systems, containers, components, their relations and their views. When it does not exist, it starts from the template, or from your hand-drawn `.drawio` file, read once, from its boxes, nesting and arrows. A box whose kind or parent the drawing leaves open is a question to you, never a guess, and an element enters only when a source establishes it: the code, a decision, the owner. It then validates the model and generates `docs/architecture/c4.drawio`, one page per view, and shows you both outputs. Your hand-drawn file stays untouched; from then on the model is the source, and the generated file is changed by hand only to move, resize or reroute, which the next generation keeps. Each container and component carries its bounded context; a relation between two bounded contexts is a contract, written in `Contracts with neighbours` of both specs.

With the banner gone, `partition-hexagon` chooses the form of each hexagon with you, reading the `Business rules` of the spec, not the code: **thin** (no domain layer, ports and adapters in full) or **rich** (a domain model that depends on nothing). In the guide, a status that moves under conditions, with forbidden transitions, makes `invoice` rich. The form, its reason and the layer map go under the bounded context in `docs/partition.yml`; a form with no reason is refused, and the layer map is the architect's, never inferred from the folders. When the project has no check that fails the build on a forbidden dependency, it proposes one with the tool of your ecosystem, generated from the map, and lets you choose.

### The attack: before anyone plans

`partition-attack` reads the spec as a reader who did not write it and wants it to fail now rather than in production. It reads the spec, the area file, the invariant register and the contracts the spec names, nothing else of the neighbours. It builds the sequences of events that break each rule, looks at the other entry points that must enforce it, the access, the data, the session, the inputs, the contract, the budget and the words, and says which attacks it skipped and why. Its findings, most severe first, each a scenario you can replay with its impact and the sentence that is missing, go **into the spec**, under `Open questions`; it changes nothing else and proposes no implementation. You settle each finding; then the spec moves, then the code. A finding left open blocks every task that implements what it reaches.

### A spec written before Partition: decomposed as a source

A specification your team wrote before Partition cannot be used as is: it is a source like any other, and it takes the path above. `partition-shape` reads it where it lives, with its reader of a document, and never changes it: no line is added at its top, no annex is written. The decomposition records its path and the sha of its commit, so a later version of the old spec is followed by the delta, as any source is.

It is assessed by the decomposition itself, and the assistant decides none of it:

- **Its owner validates it as the source**: it still describes what the system must do. In the guide, `[BA]`.
- **The reader's preconditions and inventory do the rest.** A part with no stable anchor is listed in `Gaps detected` and analysed only once its owner gives it one, in the source. What the spec leaves unsettled goes to `Gaps detected` or `Open questions`.
- **The architect decides the boundaries**, through a workshop or a proposal, as for any source, not the old file's sections.
- **A person confirms each copied rule**, under its "TO VALIDATE" banner.

Three kinds of part an old spec often holds are read as the reader says, none copied whole:

- **A history of rulings**, ruling by ruling, each anchored by its heading and its date. A ruling that states a rule is a business rule the source states, copied "from source" under the "TO VALIDATE" banner; a ruling with its reason is a decision the source states, copied to `Decisions`; a ruling that states a rule and gives its reason goes to both, each anchored to the same ruling; any other ruling is pointed to. A date repeated under one heading is not a stable anchor.
- **A section on how code is written** is not a unit and not a business rule: it is reported as a candidate for a rule file, which `partition-rules` writes on your word, scoped to the code it binds; never an area rule.
- **A file of invariants** is read entry by entry, each through the admission test of the register.

**A rule another spec already holds** is reported, never moved by the assistant. When a spec of another area holds it, it spans two areas: it is quoted with its anchor under `Applicable area rules and invariants` of the new spec, as a candidate for the admission test, and listed among the gaps with the file and the identifier that hold it. When it fails the test, a person names its owner; then `partition-spec` writes it into the owner's `Business rules`, sourced to the ruling and to that validation, and the others consume its result through the owner's contract. A copy that another spec took from its own source stays there, reported as a duplicate, until that source is amended: a rule copied from a source changes only through its source.

**In an existing codebase**, once the rules of a new bounded context are confirmed, run the `spec-auditor` agent on it: it reports where the code and the spec disagree and which side is wrong, and the spec moves first ([Change at any moment](06-change-at-any-moment.md#the-spec-moves-first-partition-spec)).

After the decomposition of an old spec, as of any source, what remains is a person's confirmation of the business rules before any plan, the attack, and the form of each hexagon. The decomposition writes documents only: the code follows later, one bounded context at a time, each through a plan of its own.

## What you decide

- **The source and the area.** You name both; the assistant never infers either. You validate a pasted source before anything is derived from it, and you commit each source alone.
- **The boundary.** The architect chooses the way (a workshop or a proposal), then the split: an option, a combination, or none. A point kept against a criterion is the architect's, recorded with the names and the reason.
- **Each new bounded context, by name**, at the hard stop. "Go ahead" does not create one.
- **The code paths** of each bounded context.
- **The business rules and the language.** You confirm each copied rule as written or not, write the missing ones, and settle the words with two meanings. The banner comes off only on your word.
- **The gaps and the contradictions of the source.** The owner of the source says which requirement holds; a copied rule changes only when the source does.
- **The architecture**: what each box is, the form of each hexagon with its reason, its layer map, and whether to add a build check.
- **Each finding of the attack**, and each open question, before the plan that implements what it reaches.
- **For a spec written before Partition**: its owner validates it as the source; a person names the owner of a rule found twice, and says whether a section on how code is written becomes a rule. The file stays as it is.
- **Every commit.** The assistant never commits.

Then the bounded context is fit for design, and its work goes through a plan, in the next journey.

## Go deeper

- [Step 02](https://github.com/elie29/partition/blob/main/docs/guides/a-project-step-by-step/02-first-bounded-context.md#the-shape-after): a PRD pasted in the chat, saved first, decomposed into one bounded context, its rules confirmed, a word with two meanings left open.
- [Step 03](https://github.com/elie29/partition/blob/main/docs/guides/a-project-step-by-step/03-architecture.md#the-shape-after): a hand-drawn diagram becomes the C4 model, the form of the hexagon and its layer map.
- [Step 16](https://github.com/elie29/partition/blob/main/docs/guides/a-project-step-by-step/16-old-spec-as-source.md#the-shape-after): a spec written before Partition, decomposed as a source where it lives into two bounded contexts, and one owner for a rule found twice, named by a person.
- [Bounded contexts come from a source](https://github.com/elie29/partition/blob/main/README.md#bounded-contexts-come-from-a-source), in the README.
- The skills behind this journey: [`partition-shape`](https://github.com/elie29/partition/blob/main/.apm/skills/partition-shape/SKILL.md) and how it [decides a boundary](https://github.com/elie29/partition/blob/main/.apm/skills/partition-shape/references/boundary-decision.md) with [the criteria](https://github.com/elie29/partition/blob/main/.apm/skills/partition-shape/references/criteria.md), [`partition-spec`](https://github.com/elie29/partition/blob/main/.apm/skills/partition-spec/SKILL.md), [`partition-attack`](https://github.com/elie29/partition/blob/main/.apm/skills/partition-attack/SKILL.md), [`partition-c4`](https://github.com/elie29/partition/blob/main/.apm/skills/partition-c4/SKILL.md), [`partition-hexagon`](https://github.com/elie29/partition/blob/main/.apm/skills/partition-hexagon/SKILL.md).

Back to the [series](README.md).
