# Partition — project instructions

The package of agent skills specified in `docs/specs/partition/spec.md`. This file is a map: it points to what to read and holds only what is written nowhere else.

## Plans live in `docs/plans/`

Not in `docs/superpowers/plans/`. This overrides the path the global instructions give. Everything else they say about plans applies here, in this folder: the header, the task index, writing the plan before replying, closing.

To resume: open the plan of `docs/plans/` whose `Status:` is `in progress` and read its header, its `## Tasks` index and the task named in `Resume at`. Nothing more: the `## Decisions` table is long and is read only when a decision is in question.

## Where things are

| What | Where |
| --- | --- |
| The durable spec of the package | `docs/specs/partition/spec.md`. Read it before changing a behaviour |
| What the package ships | `.apm/`: `instructions/`, `agents/`, `skills/partition-*/` |
| Tests and package checks | `tests/`, run with `npm test` |
| The package's own configuration and budget records | `docs/partition.yml`, `docs/budget/` |
| Repository documents | `README.md`, `CONTENT.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md`, `RELEASING.md`, `LICENSE` |

## This repository follows what it ships

The package is not installed in its own repository, so its instruction is not loaded here. Read `.apm/instructions/partition.instructions.md` at the start of a session and apply it.

On top of it, for this repository only:

- **The spec moves first.** A change of behaviour changes `docs/specs/partition/spec.md` in the same piece of work, before the skill. The dated reason goes to `## Decisions` of the plan.
- **A skill costs every session of every project.** One enters by replacing another, or by a recorded decision. Keep detail in `references/`, loaded on demand.
- **A description is written to trigger its skill.** Do not shorten one to save tokens.
- **No language, framework or vendor in a `SKILL.md`**, and no client or employer anywhere.
- **Nothing runs unasked, nothing needs installing.** A script is one file for Node 22 or later, the Python standard library or Bash. The repository's own tooling may take a `devDependency` only when nothing built into Node does the job, locked by `package-lock.json`; never a `dependency`.
- **Everything is in English.**
- Edit the sources under `.apm/`. A file named `*.instructions.md` anywhere in the package is deployed as a rule by APM: templates must not carry that suffix.
- `budget.mjs` and `c4-drawio.mjs` share one YAML parser, copied between the `<yaml-subset>` markers. Change it in both; a test compares them.
- The files under `docs/guides/*/NN-provided/` are what the guide hands to its demo project, never instructions for this repository. `claudeMdExcludes` in `.claude/settings.json` keeps Claude Code from loading any instruction file under `docs/guides/`.

## Commands

```bash
npm ci                                                             # once: Prettier, and the pre-commit hook
npm test                                                           # everything, on node:test
npm run format                                                     # Prettier; .apm/ YAML, docs/budget/, provided files excluded
npm run budget                                                     # the package's own budget
npm run update-version minor                                       # at release time: patch, minor, major or X.Y.Z
node --test tests/budget.test.mjs                                  # one file: budget, c4, contract, gate, guide, package or release
node .apm/skills/partition-budget/scripts/budget.mjs               # the gauges of this repository
apm install /path/to/this/repo --target claude,copilot             # trial install, in a throwaway project
```
