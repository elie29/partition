# Changelog

All notable changes to this package. The format follows [Keep a Changelog](https://keepachangelog.com), and versions follow [Semantic Versioning](https://semver.org).

## [Unreleased]

### Changed

- The getting-started site lists the series in a left sidebar, the current article marked.

## [1.0.0] - 2026-10-22

First version.

### Added

- Always-on instruction: spec first, bounded contexts come from a source, the plan is the state, done means real output, ticking the last task starts the closing, a plan closes through the gate and the README. It names the skill of each step the method requires (`partition-spec`, `partition-plan`, `partition-shape`, `partition-gate`, `partition-readme`), so the assistant loads each without waiting for the user's words to match a description.
- Skills: `partition-spec`, `partition-plan`, `partition-budget`, `partition-reshape`, `partition-shape`, `partition-c4`, `partition-hexagon`, `partition-patterns`, `partition-rules`, `partition-attack`, `partition-gate`, `partition-readme`.
- Agent: `spec-auditor`.
- Scripts: `budget.mjs` (gauges per bounded context, package budget), `c4-drawio.mjs` (C4 text model to draw.io and Mermaid), `contract.mjs` (inventory and semantic diff of an OpenAPI contract), and the three scripts of `partition-gate` (change context, detection of weakened tests, diff coverage).
- Decomposition from any source (an API contract, a PRD, a spec written before Partition, a described context), read where it lives, any file of the repository or a URL (a pasted or described source, or a contract read from a URL, is saved first): specs point to the source and copy only the business rules, invariants and decisions it states. A spec written before Partition is decomposed like any other source, never taken over as is; its rulings are read as the decisions and rules it states. Every new bounded context outside a reshape is created by `partition-shape` from a source; `partition-spec` writes and changes the spec, and never starts a bounded context.
- Three levels for a durable statement: the durable spec of one bounded context, the area file shared by the bounded contexts of one area (`AR-n`), and the invariant register for what spans areas or layers. Nothing is written to the area file or the register before the owner validates it, nor a line of a rule file, shown with its file and scope. The budget counts the area file only for the bounded contexts of its area.
- A statement that fails the admission test is placed by its object: what a bounded context holds or shows goes to its spec or its area file, the form of its stored data to `Persistence` even without schema documents; how its code is shaped, its logs and other side channels included, goes to a rule file through `partition-rules`.
- A convention a caller can observe is put to the owner as two readings, a rule file or a business rule, neither proposed.
- A recorded scope made stale by a change of the source stops the delta; it is rewritten only on the owner's answer, validated by name, the former scope kept in the History.
- A change across several bounded contexts opens one plan per bounded context.
- Plans live in the folder `docs/partition.yml` declares (`paths.plans`), else the one an instruction of the project names, else `docs/plans/` when it exists; otherwise the assistant asks once and records the answer. `bridge` names the tool that writes a plan's body (`superpowers`, `bmad`, another), for the reader only: it never changes the folder.
- A glossary explains each word of the method once; every other file points to it.
- Closing a plan runs `partition-gate` first, and realigns the README with `partition-readme` when what users install, run or configure changed, the people who build and maintain the project included.
- Optional reminder hook for Claude Code, enabled on request by `partition-plan`, with the Python 3 interpreter found on the machine.
- A getting-started series of nine articles under `docs/learn/`, and the GitHub Pages workflow that publishes it from the public repository.
- Repository commands: `npm test`, `npm run budget`, `npm run update-version`.
- Targets: Claude Code and GitHub Copilot.
- `partition-budget/assets/partition.schema.json`: the schema of `docs/partition.yml`, the only list of its keys. The template's first line points the editor at the schema beside it; the skill that creates `docs/partition.yml` rewrites that line to the installed copy, as the template's second line says.
- `budget.mjs` checks `docs/partition.yml` against the schema before it measures: an unknown key, a wrong type, a value outside its list or a bounded context without `id` stops it with every finding, exit 2.
- The instruction and the rule skeletons start their headings at `###`, and `partition-rules` gives a migrated rule that form: `apm compile` nests each one under its own heading in `AGENTS.md`.
