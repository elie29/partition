# Updating the bounded contexts after a change of the source

This procedure complements the decomposition procedure (`references/decompose.md`): that one handles an **initial decomposition**, this one a **change of the source** whose decomposition is already documented and validated.

It is written in the vocabulary of an API contract and applies as written to one, with `references/sources/openapi.md`. For any other document, LOAD `references/sources/document.md` first: it says how units are compared by anchor with `git diff`, and what to do with a source at a URL, whose changes cannot be compared.

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
| `node scripts/contract.mjs diff <contracts>/<contract> --base <sha> [--base-path <path at the base>] [--scope "<scope>"]` | Prints the semantic diff on the parsed structure: operations added, removed, renamed, moved, modified (with the changed pointers and plain facts such as "request field became required"); `components` schemas added, removed, modified, with the operations using them; orphan transitions; with `--scope`, the entering and leaving operations. It stops when the base ref does not exist, or when the contract moved since the base: it then prints the path history of the file and asks for `--base-path` |

## Inputs

The inputs are supplied by the user in their request.

| Input | Value to supply | Mandatory | Example |
| --- | --- | --- | --- |
| `source` | Path of the contract or of the document, wherever it lives in the repository, or a URL | **Yes** | `docs/contracts/shop.openapi.json` |
| `area` | Target folder under `<specs>/` (kebab-case) | **Yes** | `catalog` |
| `base` | Git ref to compare against — **leave empty by default** | No | `a1b2c3d` |
| `extend` | Scope extension: tags and/or `operationId`s to add to the recorded scope — **leave empty by default** | No | `tag:Catalogue; operationId:GET_ORDERS` |

- Source: `<contracts>/<contract>`, the contract at its path (or the document, at its path)
- Output root: `<specs>/<area>/`
- Decomposition record: `<specs>/<area>/bounded-contexts.md`
- One durable spec per bounded context: `<specs>/<area>/<bounded-context>/spec.md`
- The area file, when the source states rules shared by several bounded contexts: `<specs>/<area>/area.md`
- Comparison base: `base` when it is supplied, otherwise the sha recorded in the `Provenance` line of `<specs>/<area>/bounded-contexts.md`
- Scope: the one recorded in the `Scope` line of `bounded-contexts.md` (absent = whole contract), increased by `extend` when it is supplied

`base` exists only to **force** a base other than the recorded one: to replay a delta already applied, or to catch up several versions at once. In normal use, do not supply it: the base is carried by the documentation itself.

`extend` exists only to **extend** the recorded scope. Its syntax is that of the `scope` input of `references/decompose.md` (_Scope syntax_); it is not redefined here. A scope is not narrowed by this procedure, except by the owner's rewrite of a scope that a change of the source made stale (step 2, _Restrict the delta to the scope_). In normal use, do not supply it: the scope is carried by the documentation itself.

### Blocking preconditions

Check them **before reading the contract**. As long as a precondition fails, the execution stops: no diff, no analysis, no writing.

| Precondition | If it fails |
| --- | --- |
| `source` is supplied, as a real path of the repository (a URL: `references/sources/openapi.md` or `references/sources/document.md`) | Stop and ask for the name of the contract. Show the list of the files in `<contracts>/`. |
| `area` is supplied, as a real folder name | Stop and ask for the target folder. Never derive it from the name of the contract, from the OpenAPI title or from a tag. |
| The source exists at its path and is readable | Stop, report it, show the available files. Do not guess, even when a single file is present. |
| `<specs>/<area>/bounded-contexts.md` exists | **This is not a delta but an initial decomposition** → send the user to the decomposition procedure (`references/decompose.md`). |
| That file carries a `Provenance` line with a usable sha, or `external` for a document at a URL: then ask the owner what changed, or to save the new version as a file (`references/sources/document.md`, _Provenance and changes_) | **Base unknown, delta not computable** → send the user to the decomposition procedure (`references/decompose.md`) for a bootstrap pass that sets the baseline. Never invent a base, never take `HEAD~1` by default. |
| If `extend` is supplied: every entry respects the scope syntax | Stop, quote the invalid entry, recall the syntax. |
| If `extend` is supplied: the recorded scope is not already the whole contract | Stop: there is nothing to extend. |
| If `extend` is supplied: every `tag` and every `operationId` quoted exists in the **current** contract | Stop, quote the value that was not found, show the list of the `tags` and `operationId`s of the contract. Never retain a close value. |
| If `extend` is supplied: it adds at least one operation absent from the recorded scope | Stop and report it: the extension has no effect. |

The `inventory` command, run on the current contract with `--scope "<extend>"`, performs the syntax check and the existence check.

"Send the user to the decomposition procedure" means: stop and tell the user to run it. Never chain into it yourself. The inputs do not carry the same meaning from one procedure to the other; when sending the user there, state how they carry over:

| This procedure             | The decomposition procedure (`references/decompose.md`) |
| -------------------------- | ------------------------------------------------------- |
| `source`                   | `source`, as it is                                      |
| `area`                     | `area`, as it is                                        |
| `base` (git base)          | no equivalent — it does not carry over                  |
| `extend` (scope extension) | `scope`, same syntax                                    |

An input is **not supplied** when the user did not give it, gave it empty, or gave an indicative label (`<contract>`, `to be completed`, `TODO`, `…`).

## Mission

Compute what changed in the contract since the state the documentation comes from, restrict that delta to the scope (extended when `extend` is supplied), classify each change, decide where it lands, say whether the decomposition itself must move, then update the existing documentation **surgically**.

## Absolute rules

0. **`source` and `area` are mandatory.** The blocking preconditions are evaluated first. Never infer a value nor substitute a default one.
1. **The contract is the only source of truth.** Never invent an endpoint, a field, a type, a code. A piece of information that is absent is an **open question**.
2. **The existing decomposition is a validated decision.** This procedure may **propose** to reopen it (new bounded context, merge, removal, move of an operation), never decide alone.
3. **Never write before validation.** Step 6 is a hard stop, a boundary already decided at step 4 included.
4. **No deletion.** A bounded context emptied of its operations is _proposed for removal_, never deleted. No file is erased.
5. **No hand-written or copied section is overwritten.** See the classes of sections of step 7: derived from the source, copied from the source, semi-derived, hand-written.
6. **No change to the code, no build, no test.** Step 5 reads the code to observe an impact; it does not correct it.
7. **Never modify the source contract.** No writing in `<contracts>/`.
8. **Every gap is reported, not corrected.** A contract break, a code / spec divergence, a contradiction with an `INV-` invariant are raised to the user.
9. **`<schemas>/` is the only source of truth on persistence.** Never invent a collection, a field, a type or a constraint that is not in it. A piece of data newly introduced by the contract and without a documented place is an **open question**, never an imagined field.
10. **The `Business rules` section is never emptied nor rewritten by this procedure.** A business rule cannot be deduced from a source. A rule the source newly **states** is added word for word, marked "from source" with its anchor, and the "TO VALIDATE" banner replaces the "TO FILL" banner, or is added if the section has none. If a change of the source makes an existing rule doubtful, or changes or removes a rule that was copied from it, report it to the user; do not modify the rule: a person confirmed it. A sentence of the source that replaces a copied one is a change of that rule, reported with its new wording, never a rule added beside it: two copied rules that contradict each other never stand in one spec. When the source states no new rule, a "TO FILL" banner stays in place.
11. **The scope never widens by itself.** Only the operations in scope are analysed. The scope is extended only through `extend`, on a named validation at step 6, and never to follow a shared schema, a tag added to a neighbouring operation or a new out-of-scope operation.

## Step 1 — Resolve the base

1. Read the `Provenance` line of `<specs>/<area>/bounded-contexts.md` and extract its sha, unless `base` is supplied: it then prevails. Also read the `Scope` line: it is the **recorded scope**; an absent line means `whole contract`.
2. Record the current sha of the contract, whether it has uncommitted changes, and its version:

   ```bash
   node scripts/contract.mjs provenance <contracts>/<contract>
   ```

3. Settle the special cases **before** diffing anything:

   | Case | Conduct |
   | --- | --- |
   | Base sha = current sha, nothing uncommitted, no `extend` | **Nothing to do.** Say so and stop. Do not produce an empty delta. |
   | Base sha = current sha, nothing uncommitted, with `extend` | Empty contract delta: skip the diff of step 2 and handle only the **scope extension**. |
   | Contract modified but not committed | Diff against the base all the same, and report that the provenance will be recorded as `uncommitted`. Recommend the atomic commit of the contract first. |
   | Base sha not found in the history (history rewritten, branch deleted) | Stop. Ask for an explicit base through `base`. Do not fall back on an approximation. |
   | Base more recent than the current contract | Stop and report it: the documentation claims to come from a state later than the contract; there is an inconsistency to understand before writing. |
   | The contract cannot be read at its current path in the base, although the base exists (what a failing `git show <base>:<contracts>/<contract>` means; the `diff` command stops on it) | The contract was **moved or renamed** since. Resolve its historical path and diff against that path, not against the current path. Do not conclude that the contract is new. |

   Resolving the historical path: when the contract moved since the base, the `diff` command prints the path history of the file and asks for `--base-path`. That history gives, commit by commit, the path the file occupied. The path to pass as `--base-path` is the one in force **at the base**, which is not necessarily the current path.

4. Load the decision context: the existing specs and the area file of `<specs>/<area>/`, the schema documents under `<schemas>/` when the project declares some, the invariant register (`<invariants>`), and the project's rules on architecture and on compliance with exposed contracts (its rule files).

## Step 2 — Semantic diff, not textual

The diff is computed on the **parsed OpenAPI structure**, never on the text. A textual diff of tens of kilobytes of JSON is unreadable, sensitive to the order of the keys and to reformatting, and would drown the analysis.

```bash
node scripts/contract.mjs diff <contracts>/<contract> --base <sha> [--base-path <path at the base>] [--scope "<scope>"]
```

`<sha>` is the base resolved in step 1. `--base-path` is the path of the contract at the base; it equals the current path unless the contract moved (step 1). `--scope` takes the recorded scope; it is left out when the recorded scope is the whole contract.

A comparison of signatures (the names of the parameters and the response codes of each operation) only serves to spot the operations added, removed or renamed, not to detect a modification. An operation is **modified** as soon as anything in it differs between the base and the current contract, whichever part is touched (a parameter and whether it is required, a request or response body written inline, an enumeration, a `description`, an example), or as soon as a `components` schema it references changes. The command compares on that basis.

For each modified operation, go down to the detail of the operation alone, taken at its path at the base when the path changed: the command prints the changed pointers and plain facts. Then record: parameters (name, type, required), the request schema field by field, the response schemas per status code, the enumerations, the documented business error codes, the `description` and the examples (these last two for the R1 re-check of step 4).

Produce the inventory of the delta in four lists, each of which may be empty:

- operations **added**
- operations **removed**
- operations **modified**, with the detail of the fields touched; an operation the command reports as renamed (`operationId` changed) or moved (path changed, `operationId` unchanged) is listed here, with that fact
- `components` schemas added, removed, modified, with the list of the operations that reference them, and inline duplicated structures that appeared or disappeared. The coupling matrix is the one of step 2 of `references/decompose.md`, recomputed on each side; the `inventory` command prints the matrix of the current contract

### Restrict the delta to the scope

The diff covers **the whole contract**; the scope applies only afterwards. Evaluate the recorded scope against the base contract **and** against the current contract (with `--scope`, the command prints the entering and leaving operations), then file each operation:

| Situation of the operation | Treatment |
| --- | --- |
| In scope at the base and in the current contract | Delta analysed normally (steps 3 to 7) |
| Out of scope at the base and in the current contract | **Out of scope**: listed without analysis; only its line of the `Coverage` table is updated |
| **Entering** — absent or out of scope at the base, in scope in the current contract (new operation carrying a tag of the scope, existing operation that gains that tag) | Handled as an operation **added** at step 4 |
| **Brought by the extension** — outside the recorded scope, selected by `extend` | Handled as an operation **added** at step 4, whether or not it changed since the base |
| **Leaving** — in scope at the base, out of scope in the current contract (loss of the tag of the scope) | Handled as an operation **removed** from the bounded context at step 4, and reported loudly |

Two situations make the recorded scope itself stale. Settle them **before** step 3:

| Case | Conduct |
| --- | --- |
| A `tag` of the recorded scope no longer exists in the current contract | Stop. Show the operations that carried it and ask how to rewrite the scope. |
| An `operationId` of the recorded scope was renamed or removed | Classify it **breaking**, stop and ask how to rewrite the scope. Never follow the renaming silently. |

The stale scope is rewritten only on the owner's answer naming the new scope, never deduced; that rewrite is validated by name at step 6, like a scope extension, and written at step 7.

A `components` schema or an inline duplicated structure is analysed only if an operation in scope uses it. If an out-of-scope operation uses it too, mark it **coupling outside the scope**: it is reported, it does not widen the scope.

An **orphan** schema, in the sense of step 2 of `references/decompose.md`, is listed without analysis: its addition, its modification or its removal are never breaking. A schema that becomes an orphan, or stops being one, is carried into `Gaps detected`.

## Step 3 — Classify each change

| Nature | Cases | Consequence |
| --- | --- | --- |
| **Breaking** | operation or path removed or renamed, `operationId` renamed, response field removed, type of a field changed, request field turned from optional to required, new required request field, required parameter added, 2xx status code withdrawn, enumeration value withdrawn, `components` schema referenced by an operation in scope removed or renamed | **Loud report** + step 5 mandatory |
| **Conditionally breaking** | enumeration value **added** in a response | Breaking for a consumer that handles the enumeration exhaustively: to be reported as such, not classified additive in silence |
| **Additive** | new operation, optional request field added, response field added, error code newly documented, new `components` schema | Documentation to complete |
| **Neutral** | `summary`, `description`, example, order of the keys, `info.version` alone | No impact on the documentation beyond the provenance bump — but a `description` or an example that adds or withdraws a named third-party system, or changes the business vocabulary, can shift C3 or C5: it is taken into account by the R1 re-check of step 4 |

A change whose nature cannot be decided is not arbitrated: it is listed as an open question and raised.

## Step 4 — Route the changes, then question the decomposition

Route first: each change lands in the bounded context that owns its operation, according to the `## Coverage` table of `bounded-contexts.md`.

For the operations **added**, the entering ones and those brought by the extension included, apply the criteria **C1–C6 and the decision rules R1–R6 defined in `references/criteria.md`**. Neither are redefined here: there is only one definition of them. They are compared with the operations in scope only. A new bounded context is named according to the naming rule of that same file. Then:

| Finding | Proposal |
| --- | --- |
| The added operation does not satisfy R1 against an existing bounded context | It **joins** that bounded context — according to R3 if several fit. The attachment is justified explicitly, by name. |
| The added operation satisfies R1 **against all** the existing bounded contexts | **New bounded context** — new folder, new spec, line of justification. A strong sharing of schemas with an existing bounded context is discussed before proposing it (R4). |
| A modified operation changes root aggregate (C2) — path rewritten, `operationId` unchanged | **Move proposed**: it leaves its bounded context and follows the treatment of an added operation — attachment according to R3, or new bounded context according to R1. The decision is the user's. |
| An operation is removed | Its bounded context shrinks. Update its derived sections. |
| A bounded context loses **all** its operations | **Removal proposed**, never executed: line of justification, the decision is the user's; a banner while unanswered (operation 3). |
| Two bounded contexts no longer satisfy R1 against each other (R6) | **Merge proposed**, justified by the criteria, the decision is the user's. |

A new bounded context, a move, a removal or a merge moves a boundary: before it enters the plan of step 6, follow `references/boundary-decision.md`. An attachment does not.

### Re-check R1 on the current decomposition

The verdict of R1 between two bounded contexts depends on **all** their operations. A removal, a leaving operation, a modification (a neutral change of `description` included), a move or an attachment to one of the two bounded contexts can bring a criterion down without any operation being added to the pair.

Once the routing is done (attachments, new bounded contexts and proposed moves taken into account provisionally), re-evaluate R1 on **all the pairs** of bounded contexts, in their current composition:

- a pair that still satisfies R1 → nothing to do;
- a pair that no longer satisfies R1 → **merge proposed** (R6), the absorbing bounded context being designated according to R3;
- a bounded context without any operation → it falls under the proposed removal, not under the re-check;
- a pair, or a bounded context, listed under `Kept against the criteria` → not proposed again, unless the delta changes, for its units, the criterion it was kept against.

The rules the pair shares count as well as its data (R4): the area rules that bind both bounded contexts, and any rule found in both specs. A rule found in two specs and not in the area file is also a gap, with the question: owner bounded context, or area file.

All the pairs are re-evaluated, at each delta, without trying to isolate the bounded contexts that were "touched": the number of bounded contexts is small and a selection would let cases through. The plan of step 6 displays only the pairs whose verdict changes.

A source change that does not move the decomposition is the **normal** case, not a failure of the analysis: say so explicitly.

## Step 5 — Confront the breaks with the implemented code

Only for the changes classified **breaking** or **conditionally breaking**. The project's rules require every divergence between the code and the spec to be reported; this step produces that report.

For each break, locate what is implemented: through the project's code index if it has one, before reading sources. Search by the `operationId` or the path of the operation concerned.

Record the controller, the service and the adapter concerned, when they exist, and conclude with a finding:

- operation implemented and break not absorbed → **code / spec divergence**, to raise
- operation not yet implemented → no divergence, the break has no immediate effect
- operation implemented and already compliant with the new contract → note it, it is a break already absorbed

**Read-only.** No change to the code, no build, no test. The result is a list of findings for the user.

## Step 6 — Present the plan and stop

**Hard stop.** Read the current provenance again, as in step 1, never carried over from an earlier turn, then display, before any writing:

```text
Contract           : <contracts>/<contract>
Version            : <base version> -> <current version>
Base               : <base sha>
Current            : <current sha, or `uncommitted`>
Scope              : <recorded scope>  [+ extension: <value of extend>]

Delta (in scope / out of scope):
  Operations added       : <n> / <n>  <operationId…>
  Operations removed     : <n> / <n>  <operationId…>
  Operations modified    : <n> / <n>  <operationId…>
  Schemas touched        : <n> / <n>  <name…>
  Entering / leaving     : <n> / <n>  <operationId…>
  Brought by extension   : <n>        <operationId…>
  Couplings outside the scope : <schema → out-of-scope operationId…, or "none">

Classification:
  Breaking               : <n>  <detail…>
  Conditionally breaking : <n>  <detail…>
  Additive               : <n>
  Neutral                : <n>

Decomposition:
  Unchanged              : <yes — the normal case / no>
  Pairs re-evaluated     : <n> — of which <k> fail R1
    <bc-a> / <bc-b>      : <criteria before> → <criteria after>   ⇒ merge proposed
  Kept, not proposed     : <point> (<criterion>), kept on YYYY-MM-DD — or "none"
  Proposals              : <new bounded context / merge / removal / move — or "none">
  Decided by             : <proposal, option n | workshop, <sources>/<file>> · <names>, for each proposal

Writing plan:
  ≈ <specs>/<area>/bounded-contexts.md          (patch: coverage, history, provenance)
  ≈ <specs>/<area>/<bc-1>/spec.md               (patch: derived sections)
  + <specs>/<area>/<bc-3>/spec.md               (creation: new bounded context)
  ≈ docs/partition.yml                          (declares <bc-3>: area <area>, code paths <given, or "to ask">)
  ≈ <specs>/<area>/area.md                      (patch: rules the source newly states for several)
  ! <specs>/<area>/<bc-2>/spec.md               (removal proposed — banner only, while unanswered)
  = all the other files                         (intact)

Code / spec divergences to arbitrate:
  - …

Copied from the source (word for word, to confirm):
  - <bc>: new rule, invariant or decision the source states, with its anchor …
  - <bc>: copied rule, invariant or decision the source changed or removed (reported, not rewritten) …

Business rules to fill or called into question:
  - …

Data without a place in <schemas>/:
  - …

Decisions expected before writing:
  - …
```

Markers: `+` creation, `≈` surgical patch, `!` proposal of removal, of merge or of move, `=` intact.

Then **wait for an explicit validation**. No answer, no writing. An answer that asks for adjustments sends back to step 4. If the plan contains a proposal of a new bounded context, of a merge, of a removal or of a move of an operation, a scope extension or the rewrite of a stale scope, that proposal must be validated **by name**: a global validation of the plan does not carry it. The other way round, a named validation given at step 4, before the plan is shown, carries the proposal, never the plan: the plan is still displayed, the proposal marked `!` with its `Decided by` line, and validated.

## Step 7 — Surgical writing

After validation only, and exactly according to the validated plan.

### Classes of sections, and their treatments

| Class | Sections | Treatment |
| --- | --- | --- |
| **Derived from the source** | `Source parts owned` | Regenerated from the current source: one line per unit owned, then one line per part that is not a unit and bears on them, each with its link; nothing the source holds is copied |
| **Copied from the source** | the "from source" lines of `Business rules`, `Decisions` | **Addition only.** A rule or decision the source newly states is added word for word with its anchor; one the source changed or removed is reported, never rewritten: a person confirmed it |
| **Semi-derived** | `Persistence` | **Lines are added only.** A piece of data newly introduced by the contract receives its mapping line if `<schemas>/` documents one; otherwise it joins "Data without a documented place". The existing lines are neither rewritten nor deleted: a mapping that became false is reported. |
| **Hand-written** | `Business objective`, `Scope`, `Language`, `Business rules`, `External dependencies`, `Contracts with neighbours`, `Applicable area rules and invariants`, `Open questions` | **Addition only.** Never replaced, never rewritten, never reordered; a "TO FILL" banner is removed only when the first rule the source states replaces it with "TO VALIDATE" (absolute rule 10). A new piece of information is added to them; a piece of information that became false is reported to the user, not corrected. |

Any section that is in none of these lists is treated as hand-written. The area file is treated as a spec: the "from source" lines of its `Area rules` are copied from the source, everything else in it is hand-written.

Special case of `Business rules`. A contract change can make a rule already written **stale**: a field it names disappears, an enumeration it discriminates on changes. The finding is raised at closing; the rule stays as it is. Only a human arbitrates a business rule.

### Writing operations

1. **Patched specs** — regenerate the derived sections, add to the hand-written sections, update the `Source version` and `Provenance` lines.
2. **New bounded context** — create the folder and the complete spec from the `partition-spec` template, `assets/spec.md`, filled as step 6.b of `references/decompose.md` prescribes, and declare it as step 6.d prescribes. A rule the source newly states for several bounded contexts goes as step 6.c prescribes. When the area already has an area file, each area rule already in the area file is proposed to bind it or not, with the reason (what it stores or handles that the rule governs); its `Binds` changes only once the owner agrees.
3. **Removal or merge kept by the architect** — a proposal the architect turned down although a criterion calls for it gets no banner: its line goes to `Kept against the criteria` (operation 4).

   **Removal or merge not answered** — add a banner at the head of the spec concerned, without deleting anything. A proposed merge puts a banner on both specs:

   ```markdown
   > **Status:** removal proposed on YYYY-MM-DD — no operation of the contract is attached to it any more. Decision pending. See `../bounded-contexts.md#history`.
   ```

   ```markdown
   > **Status:** merge proposed on YYYY-MM-DD with `<other-bc>` — R1 is no longer satisfied between the two (criteria lost: <Cx…>). Decision pending. See `../bounded-contexts.md#history`.
   ```

   **Validated** by name — a merge, a removal or a move is carried out by the `partition-reshape` skill, in the specs and in the code. Stop and tell the user to run it with the validated proposal; never chain into it yourself. Not validated: the proposal stays under its banner and is listed at closing.

4. **`bounded-contexts.md`** — update `Source version`, `Provenance`, `Units covered` (`<n> / <N>`) and the whole `## Coverage` table, out-of-scope operations included with the mention "out of scope". The `Scope` line is rewritten, in `bounded-contexts.md` and in every spec, **only** if an extension was validated by name, or a stale scope rewritten on the owner's answer validated by name (step 2); it is added if it was absent. The tables `Bounded contexts retained`, `Decisions not to split` and `Alternatives rejected` are touched **only** if the decomposition moved, and only according to what was validated by name. The `Gaps detected` section is updated at each delta: the new gaps, couplings outside the scope included, are added to it; a gap that the current contract resolves is not erased, its line is marked "resolved on YYYY-MM-DD (version <x.y.z>)"; the gaps still open stay as they are. When the delta carried a decision on a boundary, the `Decided` line is replaced by it, and the `History` line of the delta names its way and who decided; `Kept against the criteria` gains a line for each proposal kept by the architect, and loses none.
5. **History** — add a line to the `## History` section of `bounded-contexts.md`, creating the section if it is absent:

   ```markdown
   ## History

   | Date       | Version       | Provenance | Nature   | Detail                      |
   | ---------- | ------------- | ---------- | -------- | --------------------------- |
   | YYYY-MM-DD | 1.4.0 → 1.5.0 | <sha>      | additive | <what changed, in one line> |
   ```

   It is the only place where the dated _why_ of a change is recorded; the specs carry only the current state.

   The `Nature` column takes the value `scope extension` for a validated extension, in addition to the nature of the contract delta where there is one (`additive, scope extension`). The `Detail` then quotes the entries added to the scope. For the rewrite of a stale scope, the `Detail` quotes the former scope and names who decided.

   A merge, a removal or a move gets its own `History` line, written by `partition-reshape` when it carries it out.

## Step 8 — Close

Closing report, at the end of the answer:

1. **Files created**, **files patched**, **files left intact** — one path per line.
2. **Contract breaks** — classified, each with its effect on the consumers.
3. **Code / spec divergences** — the findings of step 5, addressed to the user.
4. **Decomposition proposals pending** — new bounded context, merge, removal, move not yet settled, and the pairs of bounded contexts that fail R1 with the criteria lost.
   - **Proposals validated** — each merge, removal or move to carry out with `partition-reshape`.
5. **Gaps detected** — the gaps added and the gaps marked resolved in `bounded-contexts.md` by this delta.
6. **Scope** — the recorded scope after writing, the entering and leaving operations, the couplings outside the scope, each with the question: extend the scope or not.
7. **`Business rules` and `Area rules` sections to handle** — the specs and the area file whose "TO FILL" or "TO VALIDATE" banner is present, newly created ones included, which are therefore **not usable**; the rules newly copied from the source, to confirm; and the existing rules that the delta may have made stale, or whose source text changed or was removed, each with what calls it into question. None was modified. For a new bounded context in an area that has an area file, each area rule already there, proposed to bind it or not, with the reason (what the new bounded context stores or handles that the rule governs): a proposal, not a question; its `Binds` waits for the owner's agreement.
8. **Data without a documented place in `<schemas>/`** — the data newly introduced by the contract and with no match in the schema, each one addressed as a question: field to add to the schema, or data that is not persisted.
9. **`INV-` candidates** — the durable statements that this change establishes, put through the admission test of the invariant register (skill `partition-spec`, `references/invariants.md`), each with whether it passes and why; show one that passes as the line that would be written (step 3 of that reference). The normal outcome is "no candidate retained".
10. **Priority open questions** — those that block the design.

## Anti-patterns

| Do not | Do |
| --- | --- |
| Take `HEAD~1` as the base for want of a better one | Stop: base unknown, delta not computable |
| Conclude "new contract" when the contract cannot be read at its current path in the base (a failing `git show`) | Resolve the historical path: the `diff` command prints the path history; pass the path at the base as `--base-path` |
| Diff the JSON as text | Diff the parsed OpenAPI structure |
| Detect a modified operation by its signature alone (parameter names, response codes) | Compare the whole operation: bodies written inline, `required`, `description`, examples |
| Classify the removal of an orphan schema as breaking | List it without analysis |
| Regenerate the specs in full because it is simpler | Patch the derived sections, leave the hand-written ones |
| Delete the folder of a bounded context that became empty | Propose its removal; a banner while unanswered |
| Carry out a validated merge, removal or move in this procedure | Hand it to `partition-reshape`, which moves the specs and the code together |
| Create a bounded context for every added operation | Apply R1: C2 and at least one criterion among C3–C5 |
| Attach an operation as a matter of course to a bounded context whose tag it shares | C1 is a hint, never a criterion of the threshold (R2) |
| Correct documentation that became false in a hand-written section | Report it to the user |
| Copy a rule the source newly states for several bounded contexts into each spec | Copy it once: to the spec of its owner, or to the area file |
| Deduce a rule into, rewrite or empty a `Business rules` section | Leave what is there intact, add only the rules the source newly states (absolute rule 10), and report what the delta calls into question |
| Remove the "TO FILL" banner from a newly created spec | Leave it and report the spec at closing |
| Invent a field in the schema documents to house a new piece of data | Add it to "Data without a documented place" |
| Rewrite a persistence mapping line that became false | Report the gap, do not modify the line |
| Classify as additive an enumeration value added in a response | Classify it conditionally breaking |
| Correct the code during step 5 | Observe, report, stop there |
| Write, then announce | Stop at step 6 |
| Pass a merge, a removal or a move through a global validation of the plan | Require a named validation |
| Re-check R1 only for the added operations | Re-evaluate all the pairs of bounded contexts after the routing |
| Ignore a neutral change for the decomposition | A `description` can shift C3 or C5: it enters the R1 re-check |
| Leave in its bounded context an operation whose path changes root aggregate | Propose its move |
| Analyse an out-of-scope operation | List it as "out of scope" and update only its `Coverage` line |
| Widen the scope to follow a shared schema or a new out-of-scope operation | Report the coupling; extend only through `extend`, validated by name |
| Follow silently the renaming of an `operationId` of the scope | Classify it breaking, stop, ask for the scope to be rewritten |
| Narrow the recorded scope | Out of the reach of this procedure: report it to the user. Only a scope the source made stale is rewritten, on the owner's answer validated by name |
| Pass a scope extension through a global validation of the plan | Require a named validation |
