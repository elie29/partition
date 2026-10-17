# Changelog

All notable changes to this package. The format follows [Keep a Changelog](https://keepachangelog.com), and versions follow [Semantic Versioning](https://semver.org).

## [Unreleased]

First version.

### Added

- Always-on instruction: spec first, bounded contexts come from a source, the plan is the state, done means real output, ticking the last task starts the closing, a plan closes through the gate and the README. It names the skill of each step the method requires (`partition-spec`, `partition-plan`, `partition-shape`, `partition-gate`, `partition-readme`), so the assistant loads each without waiting for the user's words to match a description.
- Skills: `partition-spec`, `partition-plan`, `partition-budget`, `partition-reshape`, `partition-shape`, `partition-c4`, `partition-hexagon`, `partition-patterns`, `partition-rules`, `partition-attack`, `partition-gate`, `partition-readme`.
- Agent: `spec-auditor`.
- Scripts: `budget.mjs` (gauges per bounded context, package budget), `c4-drawio.mjs` (C4 text model to draw.io and Mermaid), `contract.mjs` (inventory and semantic diff of an OpenAPI contract).
- Decomposition from any source (an API contract, a PRD, an existing spec, a described context): specs point to the source and copy only the business rules, invariants and decisions it states.
- Three levels for a durable statement: the durable spec of one bounded context, the area file shared by the bounded contexts of one area (`AR-n`), and the invariant register for what spans areas or layers. Nothing is written to the area file or the register before the owner validates it. The budget counts the area file only for the bounded contexts of its area.
- A glossary explains each word of the method once; every other file points to it.
- Closing a plan runs `partition-gate` first, and realigns the README with `partition-readme` when users see the change.
- Optional reminder hook for Claude Code, enabled on request by `partition-plan`, with the Python 3 interpreter found on the machine.
- Repository commands: `npm test`, `npm run budget`, `npm run update-version`.
- Targets: Claude Code and GitHub Copilot.
- `partition-budget/assets/partition.schema.json`: the schema of `docs/partition.yml`, the only list of its keys. The template's first line points the editor at the schema beside it; the skill that creates `docs/partition.yml` rewrites that line to the installed copy, as the template's second line says.
- `budget.mjs` checks `docs/partition.yml` against the schema before it measures: an unknown key, a wrong type, a value outside its list or a bounded context without `id` stops it with every finding, exit 2.
- The instruction and the rule skeletons start their headings at `###`, and `partition-rules` gives a migrated rule that form: `apm compile` nests each one under its own heading in `AGENTS.md`.
