# What is in the Partition repository

The repository holds two distinct things: what APM deploys into the projects that install the package (the `.apm/` folder), and what only serves to maintain the package itself (everything else).

## What goes to the users: `.apm/`

| Content | In Claude Code | In GitHub Copilot |
| --- | --- | --- |
| `instructions/partition.instructions.md` | `.claude/rules/partition.md` | `.github/instructions/`, then `AGENTS.md` after `apm compile` |
| `agents/spec-auditor.agent.md` | `.claude/agents/` | `.github/agents/` |
| `skills/partition-*/` (12 folders) | `.claude/skills/` | `.agents/skills/` |

Each skill folder carries `LICENSE`, a copy of the root one, and says `license: MIT` in its frontmatter: APM deploys the folder without the root file, and the MIT notice goes with every copy. No session reads it.

Being deployed is not the same as being loaded. There are three levels.

### Loaded by every session (about 1 700 tokens)

- The instruction (partition.md): spec first, bounded contexts come from a source, the plan is the state, done means real output, a plan closes through the gate and the README, stop on a contradiction.
- The name and the description of the 12 skills and of the agent.

### Loaded only when the skill is used

- The body of the `SKILL.md`.
- Its `references/`, read only when the skill points to them: the glossary of the method's words, the procedures for decomposing a source and for following its versions, one reader per kind of source, the criteria C1–C6 and the rules R1–R6, the admission test of the invariant register, the format of the C4 model, the build-time architecture checks, the rubric and the format of the regression verdict.
- Its `assets/`, copied into the project only when the file does not exist yet: the templates of the durable spec, the area file, the invariant register, the plan, `partition.yml` and its schema, the budget record, the pattern grid, the C4 model, the decomposition record and the reshape record, and the twelve rule skeletons (backend and frontend).

### Never read, only executed

- `budget.mjs`: the Context Budget gauge of each bounded context, and the package's own budget.
- `c4-drawio.mjs`: the C4 text model to draw.io, and to Mermaid for a dynamic view.
- `contract.mjs`: inventory, coupling matrix and semantic diff of an OpenAPI contract.
- The three scripts of `partition-gate`: change context, detection of weakened tests, diff coverage.
- The reminder hook: copied with `partition-plan`, inactive until someone asks to enable it.

### The 12 skills

| Skill | Role |
| --- | --- |
| `partition-attack` | Adversarial review of a spec or a design before implementation |
| `partition-budget` | Measures the Context Budget per bounded context and records the assessment |
| `partition-c4` | The C4 as text; generates the draw.io views and the sequence diagrams; turns a hand-drawn draw.io file into the model |
| `partition-shape` | Decomposes a source (API contract, PRD, spec written before Partition, described context), read where it lives, into the bounded contexts that point to it, then follows its versions |
| `partition-gate` | Regression audit of a change: SHIP, SHIP WITH CONDITIONS or HOLD, earned by execution |
| `partition-hexagon` | Thin or rich hexagon; checks dependency direction against the project's layer map |
| `partition-patterns` | The project's pattern grid, at design time and as an audit |
| `partition-plan` | The plan is the state: header, task index, partial resume, closing through the gate, the spec and the README |
| `partition-readme` | Realigns a README with the code |
| `partition-rules` | Creates, scopes and migrates the project's rules, backend and frontend |
| `partition-spec` | Writes the durable spec of a bounded context `partition-shape` retained or a fission created, and changes it, the spec first; places a statement at its level and feeds the invariant register through its admission test |
| `partition-reshape` | Reshapes the bounded contexts that exist: fission, merge, removal, move; promotes a component |

And one agent, `spec-auditor`: a reader who did not write the code, auditing the code of one bounded context against its spec.

## What stays in the repository

| Content | What it is for |
| --- | --- |
| `apm.yml` | The manifest: APM reads it to install; it is not copied into the user's project |
| `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md`, `LICENSE` | The front page and the rules of the repository on GitHub |
| `RELEASING.md` | How the maintainer releases a version: the number, the steps, the tag |
| `CONTENT.md` | This page: what the repository holds, what is deployed and what is loaded |
| `assets/` | The hero image, the loop and the journey diagrams of the README, and the figures of the series in `docs/learn/` |
| `docs/specs/partition/spec.md` | The durable spec of the package |
| `docs/plans/` | The plans of the package, and their decisions; the folder appears with the first plan |
| `docs/guides/` | Walk-throughs for readers of the repository: where a rule lives, and a project step by step |
| `docs/learn/` | The getting-started series, published on GitHub Pages by `.github/workflows/pages.yml` |
| `docs/designs/` | The designs of the package's own changes: the input of a plan |
| `docs/budget/`, `docs/partition.yml` | The package's budget, measured on itself |
| `tests/` | The tests and package checks, run with `npm test` |
| `scripts/update-version.mjs` | Sets the version in the four places that carry it, at release time |
| `package.json`, `package-lock.json` | The repository commands, and Prettier, its one locked `devDependency` |
| `.githooks/` | The pre-commit hook: formats the staged files, then runs the tests |
| `.nvmrc` | The Node.js version the repository is developed on |
| `.github/` | The CI, the issue and pull request templates for the package |
| `.claude/CLAUDE.md` | The instructions for working on the package with Claude Code |

None of this reaches a user: in the trial install, only the files that come from `.apm/` were deployed.

The archive of a GitHub release ("Source code", zip and tar.gz) is slimmer than the repository. It holds `.apm/`, `apm.yml`, `LICENSE`, `README.md`, this page, `assets/`, `CHANGELOG.md` and `SECURITY.md`; `.gitattributes` marks everything else `export-ignore`. A file added at the root or in a new folder fails `npm test` until it is either kept or added there.

## What the user creates afterwards

From the templates, the user creates their own files: their specs, their `docs/partition.yml`, their rules in `.apm/instructions/`, their plans, their C4 model, their pattern grid, their budget records. These belong to the user, and an update of the package never touches them.

Most of them are not typed by hand. The assistant creates each one from its template through a skill and fills it; the person decides what goes in it. A few things are only ever a person's, and a few are generated.

### Written by hand

- The source: the API contract, the PRD, the spec written before Partition, under a stable name, read where it lives in the repository; a context described in the chat is saved as one.
- The business rules of each spec: written by a person, or copied from the source and confirmed by one.
- The answers to the questions of the rule skeletons, when the code does not show the convention.
- The form of each hexagon.
- Every validation: the split plan, an invariant admitted, a line of a rule file, a rewritten scope, a ruling on a pattern, the decisions of a workshop.
- The layout a person sets in the C4 diagrams in draw.io, kept across regenerations; what nobody changed, the script places again.
- The design of a feature, or the process tool that writes it.
- The commits.

### Populated through the assistant

| File | Skill |
| --- | --- |
| `docs/partition.yml` | the first skill that needs it creates it from its template (`partition-plan` with the plans folder alone); `partition-budget` fills the rest with the owner: the threshold and the schedule of the assessment; the owner may adjust any key by hand; `contexts:` starts empty, and `partition-shape` declares each bounded context it retains, asking for its code paths (`partition-reshape` a fission's) |
| Specs: `docs/specs/<area>/<bounded-context>/spec.md` | `partition-shape`, from a source, through the steps of `partition-spec`; `partition-reshape` for a fission; `partition-spec` for every change |
| The area file: `docs/specs/<area>/area.md` | `partition-spec`; `partition-shape` when a source states rules shared by several bounded contexts |
| The decomposition record: `bounded-contexts.md` | `partition-shape`, once the owner validated the plan (bounded-contexts in plural); `partition-reshape` updates it after a reshape |
| A source pasted or described in the chat | `partition-shape` saves it to a file, the owner validates it |
| The invariant register: `invariants.md` | `partition-spec`, through the admission test |
| The rules: `.apm/instructions/` | `partition-rules`, from the code and the owner's answers; each line shown with its file and scope, written once the owner validates it |
| The plans | `partition-plan`; with `bridge: superpowers`, the plugin writes the body |
| The C4 model: `docs/architecture/model.yml` | `partition-c4`; once from a hand-drawn `.drawio` file, the owner answering what the drawing leaves open |
| The pattern grid | `partition-patterns`, recording the owner's ruling |
| The reshape and promotion records | `partition-reshape` |
| The budget records | `partition-budget` |
| The findings on a spec or a design | `partition-attack` |

### Generated, never edited by hand

- The C4 diagrams, `docs/architecture/*.drawio`, by `c4-drawio.mjs`.
- `Source parts owned` in each spec, by `partition-shape`.
- The gauges in each budget record, by `budget.mjs`, pasted unedited.
