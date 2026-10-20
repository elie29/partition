# Decomposing a source into bounded contexts

## Reading the source

This procedure is written in the vocabulary of an API contract: operation, `operationId`, tag, `components` schema, `scripts/contract.mjs`. For an API contract it applies as written, with `references/sources/openapi.md`. For any other document (a PRD, a spec written before Partition, a described context saved under `paths.sources`), LOAD `references/sources/document.md` first: it gives the unit, the anchor, the scope syntax and the inventory that replace them, and `<contracts>/<contract>` stands for the path of that source.

The source is **pointed to, never copied**, except the business rules, invariants and decisions it states: those are copied word for word into the spec, with their anchor (step 6.b).

## Paths

Before the preconditions, read the project's paths in `docs/partition.yml`, under `paths:`. A key that is not declared takes its default.

| Written here | Key | Default |
| --- | --- | --- |
| `<contracts>/` — default folder of contracts | `paths.contracts` | `docs/contracts` |
| `<specs>/` — specs folder | `paths.specs` | `docs/specs` |
| `<sources>/` — default folder of other sources: PRDs, described contexts | `paths.sources` | `docs/sources` |
| `<schemas>/` — schema documents | `paths.schemas` | none: a project may have no schema documents |
| `<invariants>` — invariant register | `paths.invariants` | `<specs>/invariants.md` |

When `paths.schemas` is missing, the `Persistence` section of every spec reads "No schema documents are declared for this project" and no persistence mapping is attempted. Everything this procedure says about `<schemas>/` applies to the projects that declare schema documents.

## Commands

`scripts/contract.mjs` ships with this skill and does the mechanical work deterministically. Run the commands from the root of the project: `scripts/contract.mjs` stands for that file in this skill's folder, and `<contracts>/<contract>` is the path of the contract in the project. The script reads JSON contracts only: a YAML contract is converted to JSON first, into a temporary file outside `<contracts>/` that is not committed.

| Command | What it does |
| --- | --- |
| `node scripts/contract.mjs provenance <contracts>/<contract>` | Prints `info.version`, the sha of the contract's last commit and whether the contract has uncommitted changes |
| `node scripts/contract.mjs inventory <contracts>/<contract> [--scope "<scope>"]` | Prints the exhaustive inventory of operations split in scope / out of scope (`n in scope / N in the contract`); per operation: method, path, `operationId`, tags, summary, parameters, request and response schemas per status code, documented business error codes, the terminal resource of the path and whether it is a sub-resource; then the coupling matrix (`components` schemas and inline duplicated structures with the operations using them, `coupling outside the scope` marked) and the orphan schemas. It also performs the blocking scope checks: invalid entry, unknown tag or `operationId` (with the list of existing ones), empty selection |

## Inputs

The inputs are supplied by the user in their request. `source` and `area` are **mandatory inputs**: neither has a default value, neither can be deduced. `scope` is optional.

| Input | Value to supply | Mandatory | Example |
| --- | --- | --- | --- |
| `source` | Path of the contract or of the document, wherever it lives in the repository, or a URL | **Yes** | `docs/contracts/shop.openapi.json` |
| `area` | Target folder under `<specs>/` (kebab-case) | **Yes** | `catalog` |
| `scope` | Scope: tags and/or `operationId`s to analyse — **leave empty for the whole contract** | No | `tag:Catalogue; operationId:GET_ORDERS` |

- Source: `<contracts>/<contract>`, the contract at its path (or the document, at its path)
- Output root: `<specs>/<area>/`
- Decomposition record: `<specs>/<area>/bounded-contexts.md`
- One durable spec per bounded context: `<specs>/<area>/<bounded-context>/spec.md`
- The area file, when the source states rules shared by several bounded contexts: `<specs>/<area>/area.md`
- Scope: the operations selected by `scope` when it is supplied, otherwise all the operations of the contract

### Scope syntax

`scope` is a list of entries separated by `;`, each prefixed by its nature:

- `tag:<tag name>` — selects every operation carrying that tag
- `operationId:<operationId>` — selects that operation

The selection is the **union** of the entries. Values are compared **identically** (case, spaces) with the `tags` and `operationId`s of the contract, never by proximity. An entry without a `tag:` or `operationId:` prefix is invalid.

A `scope` that is not supplied (not given, empty, or replaced by an indicative label) means **whole contract**: it is the only input whose absence has a meaning.

### Blocking preconditions

Check them **before reading anything else**. As long as a precondition fails, the execution stops: no reading of the contract, no analysis, no writing.

| Precondition | If it fails |
| --- | --- |
| `source` is supplied, as a real path of the repository (a URL: `references/sources/openapi.md` or `references/sources/document.md`) | Stop and ask for the name of the contract. Show the list of the files in `<contracts>/` so that the user chooses. |
| `area` is supplied, as a real folder name | Stop and ask for the target folder. Show the existing folders of `<specs>/`. Never derive this name from the name of the contract, from the OpenAPI title or from a tag. |
| The source exists at its path and is readable | Stop, report it, show the available files. Do not guess the file that was meant, even when a single one is present, even when a name is close. |
| If `scope` is supplied: every entry respects the scope syntax | Stop, quote the invalid entry, recall the syntax. |
| If `scope` is supplied: every `tag` and every `operationId` quoted exists in the contract | Stop, quote the value that was not found, show the list of the `tags` and `operationId`s of the contract. Never retain a close value. |
| If `scope` is supplied: the selection contains at least one operation | Stop and report it. Do not fall back on the whole contract. |

The three scope preconditions are the only ones that read the contract: they are evaluated only once the first three hold, and are limited to extracting the `tags` and `operationId`s. The `inventory` command performs these three checks and stops when one of them fails.

An input is **not supplied** when the user did not give it, gave it empty, or gave an indicative label (`<contract>`, `to be completed`, `TODO`, `…`).

Supplying only one of the two mandatory inputs is not enough: `source` and `area` are both required to start. Ask for the missing one, then stop. Do not begin the analysis with only one.

## Mission

Read the source contract, restricted to the retained scope, decide whether it must be decomposed into several bounded contexts, **justify that decision whatever it is**, then produce the corresponding functional-context documentation under the output root.

## Absolute rules

0. **`source` and `area` are mandatory.** The blocking preconditions above are evaluated first. Never infer, guess or substitute a default value for either of them.
1. **The contract is the only source of truth.** Never invent an endpoint, a parameter, a field, a type, a status code, an error code or a behaviour that is not in it. A piece of information absent from the contract is an **open question**, not an assumption to write down.
2. **Never modify the source contract.** No writing in `<contracts>/`.
3. **Never write before validation.** Step 5 is a hard stop.
4. **No line of code.** The output is functional-context documentation: no class, no package, no method signature, no projection onto an architecture (hexagonal or other).
5. **Every decision is justified.** A bounded context retained, a grouping, an attachment, an absence of decomposition: each carries its justification, backed by the criteria of `references/criteria.md`.
6. **Every gap is reported, not corrected.** A contradiction between the contract, the project's rules, an `INV-` invariant or the existing documentation is raised to the user, never settled silently.
7. **`<schemas>/` is the only source of truth on persistence.** Same regime as the contract: never invent a collection, a field, a type, a relation or a constraint that is not in it. A piece of data of the contract without a documented place is an **open question**, not a field to imagine.
8. **The `Business rules` section never fills itself.** A business rule cannot be deduced from a source. A rule the source **states** is copied word for word, marked "from source" with its anchor, under the "TO VALIDATE" banner; otherwise the section keeps its "TO FILL" banner. A human confirms or fills it before the context is usable. Deducing a rule from a field name, an error code or an example is an invention.
9. **The scope never widens by itself.** Only the selected operations are analysed. An out-of-scope operation is listed, never analysed nor attached to a bounded context, even when it shares schemas with the scope.

## Provenance and versioning of the contract

The contract carries a **stable name**: it is overwritten at each delivery, never duplicated under a versioned name. The project's rules and the generated specs quote it by path: a name that changes makes those references stale, and several files in `<contracts>/` make the compliance rule ambiguous. The history of the versions is held by git, not by the folder tree.

Only exception: two major versions of an API alive **at the same time** are two distinct contracts, and the path then carries the major version.

Direct consequence for this procedure: the generated documentation must be able to say **which exact state of the contract** it comes from. It therefore records, in addition to `info.version`, the **sha of the commit** of the contract file, obtained with:

```bash
node scripts/contract.mjs provenance <contracts>/<contract>
```

The provenance is read from git when step 1 records it and read again when step 5 displays it, never carried over from an earlier turn: the owner may have committed in between. If that read shows the contract never committed or modified since its last commit, the sha does not identify the state that was read: report it and record `uncommitted`. A read that could not be run is reported as such, never recorded as `uncommitted`. The discipline expected upstream is an **atomic commit of the contract alone**, whose message carries both versions: `docs(contracts): <area> 1.4.0 -> 1.5.0`. That sha is the anchor of every later update.

### This procedure or the delta procedure?

| Situation | Procedure to use |
| --- | --- |
| `<specs>/<area>/bounded-contexts.md` is **absent** | **This procedure** — initial decomposition |
| `bounded-contexts.md` is present **without** a provenance sha | **This procedure**, as a bootstrap: it rewrites `bounded-contexts.md` (marked `~` in the plan) to set the baseline; the existing specs stay intact. A spec to produce whose path is already occupied is not overwritten: it is listed in the plan as a gap to settle |
| `bounded-contexts.md` is present **with** a sha, and the contract has changed since | The delta procedure (`references/delta.md`) — this procedure would rewrite a decomposition that is already validated |
| `bounded-contexts.md` is present **with** a sha, and the requested scope differs from the recorded scope | **Stop and ask**: extend the recorded scope through the delta procedure (`references/delta.md`, input `extend`), or choose another target folder |
| The contract is given for a bounded context that exists, and `bounded-contexts.md` records another source | **Neither procedure**: it is not a source of the decomposition but the contract that bounded context shows, recorded in its `Contracts with neighbours` (`partition-spec`); the recorded source stays the only source, its provenance unchanged |

The recorded scope is read in the `Scope` line of `bounded-contexts.md`; an absent line means **whole contract**.

## Step 1 — Load the context

The blocking preconditions hold: `source` and `area` are supplied and the contract is readable. Otherwise, do not enter this step.

To read before any analysis:

| Source | Why |
| --- | --- |
| `<contracts>/<contract>` | The contract to decompose |
| `<specs>/<area>/` (folder tree and existing files) | A decomposition possibly already in place, documentation not to contradict |
| The schema documents under `<schemas>/`, when the project declares some | The only source of truth on persistence |
| The area file (`<specs>/<area>/area.md`), when it exists | The area rules and the language the bounded contexts of the area share |
| The area files and specs of the other areas of `<specs>/` | A rule the source states that another area already holds spans areas (6.c) |
| The invariant register (`<invariants>`) | The `INV-` invariants the decomposition must respect |
| The project's rules on architecture (its rule files) | Layer boundaries, isolation of the sub-domains |
| The project's rules on compliance with exposed contracts (its rule files) | Conformity of the exposed endpoints |

Also record the `info.version` of the contract and the sha of its last commit (see _Provenance and versioning of the contract_): these two values are written in every file produced, with the scope. If `bounded-contexts.md` already exists **with** a sha in its `Provenance` line:

| Recorded scope (`Scope` line, absent = whole contract) | Conduct |
| --- | --- |
| Identical to the requested scope | Stop and send the user to the delta procedure (`references/delta.md`) |
| Different from the requested scope | Stop, show both scopes, and ask: extension of the recorded scope through the delta procedure (`references/delta.md`, input `extend`), or another target folder. Never overwrite nor merge a decomposition validated on another scope. |

Two scopes are identical when they select the same set of operations, however they are written.

"Send the user to" another procedure means: stop and tell the user to run it. Never chain into it yourself.

## Step 2 — Inventory the operations

Build the **exhaustive** inventory of the operations of the contract, then split it in two:

- **in scope** — the operations selected by `scope`, or all of them when it is not supplied
- **out of scope** — all the others

```bash
node scripts/contract.mjs inventory <contracts>/<contract> [--scope "<scope>"]
```

No operation may be omitted: the sum of the two lists must equal the number of operations of the contract, and both totals are displayed: `n in scope / N in the contract`.

An out-of-scope operation is recorded only by its method, its path, its `operationId` and its `tags`. It is not analysed.

For each operation in scope, record:

- HTTP method and full path
- `operationId`
- `tags`
- summary / description
- path, query and header parameters
- request schema
- response schemas per status code
- documented business error codes
- visible external dependencies (third-party systems named in the descriptions or the examples)

The command prints these items, the last one excepted, with the summary and the first 400 characters of each description. Reading the full descriptions and the examples of the contract, for named third-party systems, for inter-contract references and for vocabulary, remains your job. The command also prints, for each operation, the terminal resource of its path and whether it is a sub-resource: what C2 measures.

Two cases of dependency are handled apart:

- **Unnamed dependency** — a third party mentioned without being identified ("retrieved from an external API") is recorded as it stands. It cannot satisfy C5: the criterion is settled "no" for lack of proof, and the identity of the system goes to `Open questions`.
- **Inter-contract reference** — a path quoted in a description or an example (`/payments/{paymentId}`, `/refunds`) that appears in another contract of the project is exposed by the project itself, not by a third party. Look for it in every contract of the project: the files of `<contracts>/` and the source of every other decomposition record (`<specs>/*/bounded-contexts.md`), wherever it lives. It does not count for C5; it is recorded in the `Scope` section of the spec, under "Out of scope", with the contract that exposes it. A quoted path that appears in no contract of the project goes to `Open questions`.

Also record the **coupling matrix** that serves as the measure of C6. It covers the whole contract and lists, for each shared structure, the operations that use it:

- **`components` schemas** — each one with the operations that reference it, directly or through another schema;
- **inline duplicated structures** — an object of the same shape (same properties, same types) written inline in several operations counts as a shared schema, designated by its path (e.g. `requestBody.billingAddress`, `requestBody.shippingAddress`). The project's common error envelope, when its rules define one, is a cross-cutting convention: it stays out of the matrix. Leave it out when the command lists it.

A structure used both by an operation in scope and by an out-of-scope operation is marked **coupling outside the scope**.

A `components` schema that no operation of the contract uses, neither directly nor through another schema that is used, is an **orphan**: it is listed in `Gaps detected`, without analysis nor attachment. A schema referenced only by orphans is itself an orphan.

## Step 3 — Apply the splitting criteria

Evaluate the six criteria C1–C6 on the operations in scope and apply the decision rules R1–R6, as `references/criteria.md` defines them. That file is their only definition: nothing of it is restated here.

## Step 4 — Decide

The decision is the architect's. Follow `references/boundary-decision.md`: tell what is at stake, ask the way, then build the proposal or challenge the workshop's result. Settle on the outcome the architect chose among the three of `references/criteria.md`, and name each bounded context according to its naming rule. The third outcome ends the procedure at this step: nothing is written.

## Step 5 — Present the writing plan and stop

**Hard stop.** Read the provenance again (see _Provenance and versioning of the contract_), then display, before any writing:

```text
Contract           : <contracts>/<contract>
Version            : <info.version>
Provenance         : <sha of the contract's commit, or `uncommitted`>
Scope              : <value of scope, or `whole source`>
Operations read    : <n> in scope / <N> in the contract
Out of scope       : <operationId…, or "none">
Bounded contexts   : <bc-1>, <bc-2>, … (<m> retained)
Decided            : <proposal, option n | workshop, <sources>/<file>> · <names>

Writing plan:
  + <specs>/<area>/bounded-contexts.md          (creation — `~` overwrite when bootstrapping)
  + <specs>/<area>/<bc-1>/spec.md               (creation)
  + <specs>/<area>/<bc-2>/spec.md               (creation)
  + <specs>/<area>/area.md                      (creation, when the source states rules shared by several)
  ≈ docs/partition.yml                          (declares <bc-2>: area <area>, code paths <given, or "to ask">)

Existing files kept intact:
  <specs>/<area>/<bc-1>/<other-file>.md
  …

Copied from the source (word for word, to confirm):
  <bc-1>  rules      : "<rule as stated>" (<anchor>) …, or "none stated"
          invariants : "<invariant as stated>" (<anchor>) — candidate for the admission test …
          decisions  : "<decision>", because "<reason>" (<anchor>), dated <version or date of the source> …
  <area>  rules      : "<rule as stated>" (<anchor>) — binds <bc-1>, <bc-2> …, or "none shared"

Gaps detected, to settle:
  - <specs>/<area>/<bc-n>/spec.md is occupied: not overwritten
  - "<rule as stated>" (<anchor>) is also held by <specs>/<other-area>/<file> (<identifier>): spans two areas, candidate for the admission test
  - "<choice as stated>" (<anchor>) states no reason: pointed to, not a decision; open question "<question>"
  - …
```

A choice the source records without its reason is not listed under `decisions`: it is pointed to, and listed under the gaps only when it leaves something unsettled.

Mark a creation with `+`, an overwrite with `~` and an addition to an existing file with `≈`. Only `bounded-contexts.md` is overwritten, when bootstrapping. A spec to produce whose path is already occupied is never overwritten: it is listed under the gaps. Every file already present under the output root and not listed with `~` is kept intact.

Then **wait for an explicit validation from the user**. No answer, no writing. An answer that asks for adjustments sends back to step 3; one that asks for another split, to step 4.

## Step 6 — Write

After validation only, and exactly according to the validated plan.

### 6.a — `<specs>/<area>/bounded-contexts.md`

Write the decomposition record from `assets/bounded-contexts.md`:

- the title carries `<area>`; the header lines carry `<contracts>/<contract>`, `info.version`, the date and the sha of the contract's commit (or `uncommitted`), the value of `scope` (or `whole source`) and `<n> / <N>`;
- the two paragraphs about the `Scope` line and the `Provenance` line are kept as they are;
- `Splitting criteria applied` recalls the six criteria and the decision rules R1–R6 of `references/criteria.md`;
- `Gaps detected` also holds the couplings outside the scope and the orphan schemas of step 2;
- `Coverage` has one line per operation of the contract, in scope or not;
- the `Decided` line carries the date, the names and the way, as step 5 showed it;
- `Alternatives rejected` holds the options not chosen, `Kept against the criteria` the points kept although a criterion fails (`references/boundary-decision.md`, _The record_);
- `History` stays an empty table: the delta procedure (`references/delta.md`) appends to it.

### 6.b — `<specs>/<area>/<bounded-context>/spec.md`, one per bounded context

Write the spec from the template of the `partition-spec` skill, `assets/spec.md`. Keep its five header lines: `Source` is `<contracts>/<contract>`, `Source version` is `info.version` (for a document: its version, or the date it was read), `Provenance` is the date and the sha of the source's commit (or `uncommitted`, or `external` for a URL), `Scope` is the value of `scope` (or `whole source`).

The template carries the structure of each section. When the spec comes from this procedure, the sections below are filled as follows:

| Section | What this procedure writes |
| --- | --- |
| `Business objective` | What this bounded context serves, in business language, deduced from the contract alone. |
| `Scope` | **Out of scope:** what the contract explicitly hands to another bounded context or to a third party. The inter-contract references of step 2 go here, with the contract that exposes them. |
| `Language` | Left empty. The meaning of a term is not deduced from a contract: a person writes it. |
| `Source parts owned` | One line per unit the bounded context owns: its `operationId` or anchor, a link to it in the source, one line on what it is for. Then one line per part that is not a unit and bears on those units (a part that only defines terms or gives context, or the rest of one that records decisions): its anchor, a link to it, one line on what it holds. Nothing the source holds is copied: no path, field, status code or error code, no requirement text, no definition. |
| `Business rules` | The rules the source states for this bounded context only, copied word for word, marked "from source" with their anchor, under the "TO VALIDATE" banner. None stated: the section as the template has it, with the "TO FILL" banner. Never a deduced rule (absolute rule 8). |
| `Decisions` | The decisions the source states with their reason, each with its anchor and, as its date, the version or date of the source. A choice stated without its reason is not a decision: it is pointed to, and goes to `Open questions` only when it leaves something unsettled. None: the section stays empty. |
| `Persistence` | A persistence mapping is not a copy of the source: it says where the data is stored, which the source does not hold, and names a field only to place it. When the project declares schema documents: in the reference line, name the documents of `<schemas>/` the mapping relies on; one line per request or response field that has a place, with that place as written in the schema document (the path of the field in the document, or the shared definition and its field), whether it is read or written, and a note (e.g. a code stored in lower case). **Data without a documented place:** every piece of data of the contract with no match in `<schemas>/`, listed there and carried over as an open question. Never invent a field, a collection, a type or a constraint absent from the schema. Write "No persistence" when the bounded context reads and writes no documented collection (the case of a reference list served by an external system, for example). When `paths.schemas` is missing: "No schema documents are declared for this project", and nothing else from the source; a statement a person gives later on the form of the stored data goes after that sentence (`partition-spec`). |
| `External dependencies` | The third-party systems named by the contract, and what is asked of them. "None" when the contract names none. |
| `Contracts with neighbours` | Left empty. A person writes it once the neighbours are known. |
| `Applicable area rules and invariants` | The area rules (`AR-n`) of the area file and the `INV-` entries of the invariant register (`<invariants>`) that constrain this bounded context, and the shared rules and invariants the source states, as candidates (step 7), a rule also held by another area included (6.c). "None" otherwise. |
| `Open questions` | Everything the contract does not settle and that will be needed to design. One question per line, worded so that it can be answered. This is where what would otherwise have been invented goes. |

### 6.c — `<specs>/<area>/area.md`, when the source states rules shared by several bounded contexts

A rule the source states for units of several bounded contexts goes where `partition-spec` sends it (_Where a statement belongs_): to the spec of the bounded context that owns it, or, with no owner, to the area file, written from the template of the `partition-spec` skill, `assets/area.md`. It is copied once, word for word, marked "from source" with its anchor, under the "TO VALIDATE" banner, with the bounded contexts it binds; it is never copied into each spec. An existing area file only receives the new rules (addition only).

A rule that the area file or a spec of another area already holds spans two areas: it goes to no area file. It is quoted with its anchor under `Applicable area rules and invariants` of each spec it binds, as a candidate for the admission test (step 7), and listed under the gaps with the file and the identifier that hold it. Nothing is moved in the other area.

### 6.d — `docs/partition.yml`

Declare each bounded context this procedure creates under `contexts:`: its `id` and its `area`, and its `spec` only when it is not the default `<specs>/<area>/<id>`. Its `code` paths are the owner's answer, never a guess; until they are given, the bounded context is declared without them and the question goes to the closing report. An existing declaration is left as it is. When `docs/partition.yml` does not exist, create it from the template of the `partition-budget` skill, `assets/partition.yml`, its first line rewritten for the project as its second line says.

## Step 7 — Close

Closing report, at the end of the answer:

1. **Files written** — one path per line.
2. **Files kept intact** — those that already existed under the output root.
3. **`Business rules` and `Area rules` sections to fill or to validate** — the list of the specs and the area file whose banner is still present ("TO FILL" or "TO VALIDATE", with the copied rules to confirm), with the explicit mention that these contexts **are not usable** as long as the sections are not filled and confirmed. This is the action expected from the user when this procedure ends.
4. **Data without a documented place in `<schemas>/`** — taken from the `Persistence` sections, each one addressed as a question to settle: field to add to the schema, or data that is not persisted.
5. **Gaps to settle** — taken from the `Gaps detected` section, addressed to the user. The couplings outside the scope are included, each with the question: extend the scope or not. So is every rule found in two specs of the area, or in a spec and the area file, with the question: owner bounded context, or area file. So is every rule also held by another area, with the file and the identifier that hold it. Nothing is moved.
6. **`INV-` candidates** — the durable statements that this decomposition has established, a rule also held by another area (6.c) included, put through the admission test of the invariant register (skill `partition-spec`, `references/invariants.md`). State for each whether it passes or fails, and why; show one that passes as the line that would be written (step 3 of that reference). The normal outcome is "no candidate retained".
7. **Priority open questions** — those that block the design, and the code paths of the bounded contexts declared without them.

## Anti-patterns

| Do not | Do |
| --- | --- |
| Guess `source` because a single source is present | Stop and ask for the missing input |
| Derive `area` from the name of the contract or from an OpenAPI tag | Stop and ask for the target folder |
| Retain a tag or an `operationId` close to the one requested | Stop and show the available values |
| Analyse or attach an out-of-scope operation | List it as "out of scope" in the `Coverage` table |
| Widen the scope to follow a shared schema (C6) | Report the coupling outside the scope and let the user decide |
| Overwrite a decomposition validated on another scope | Stop: extension through the delta procedure (`references/delta.md`), or another target folder |
| One bounded context per endpoint | Apply R1: C2 and at least one criterion among C3–C5 |
| Count a distinct tag in the threshold | C1 is a hint, never a criterion of the threshold (R2) |
| Make a bounded context of a sub-resource (`…/{id}/<resource>`) | If the resource before `{id}` is the terminal resource of another operation, it belongs to that aggregate: C2 fails |
| Take an addressing segment (`countries/{countryCode}`, `customers/{…}`) for the aggregate | The root aggregate is the terminal resource of the path (C2) |
| Measure C6 on the `components` schemas alone | Count the inline duplicated structures too, error envelope excluded |
| Satisfy C5 with an unnamed third party or with an endpoint of another contract of the project | Settle C5 "no", ask the question or record the reference under "Out of scope" |
| Analyse, or silently ignore, an orphan `components` schema | List it in `Gaps detected` |
| Complete a missing field "by common sense" | Put it as an open question |
| Copy a rule the source states for several bounded contexts into each spec | Copy it once: to the spec of its owner, or to the area file (6.c) |
| Guess the code paths of a new bounded context | Declare it without them and ask (6.d) |
| Deduce a business rule from a field name, an error code or an example | Leave the `Business rules` section and its banner intact |
| Remove the "TO FILL" banner from an empty `Business rules` section | Leave it, and report the spec at closing |
| Invent a field or a collection to house a piece of data of the contract | List it under "Data without a documented place" |
| Decompose by technical layer (controller / domain / gateway) | Decompose by business aggregate |
| Align the existing documentation with the contract without asking | Report the gap and wait |
| Write the files, then announce the plan | Stop at step 5 |
| Present one split as the decision | Let the architect choose the way: a workshop or a proposal (`references/boundary-decision.md`) |
| Take a workshop's result without confronting it | Challenge it, then let the architect decide each finding |
| Justify a split by "it is clearer" | Name the criteria C1–C6 that are satisfied |
| Omit the justification when there is a single bounded context | Justify the absence of decomposition with the same rigour |
