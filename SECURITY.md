# Security

## Supported versions

The latest released version receives fixes.

## Reporting a vulnerability

Do not open a public issue. Use GitHub's private vulnerability reporting on this repository (**Security** tab, **Report a vulnerability**). Say what you ran, what happened and what you expected. You will get an answer within a week.

## What the package runs on your machine

Partition installs text files: skills, one agent, one instruction. It installs no hook and no MCP server.

Scripts ship inside the skills, and each runs only when a skill tells the assistant to run it:

| Code | Reads | Writes | Calls |
| --- | --- | --- | --- |
| `budget.mjs` | the files of the project | nothing | `git log`, read-only |
| `c4-drawio.mjs` | the model file, the existing `.drawio` file | the `.drawio` file named by `--out` | nothing |
| `contract.mjs` | the contract file | nothing | `git log`, `git status`, `git show`, `git rev-parse`, `git cat-file`, read-only |
| scripts of `partition-gate` | the diff and the working tree | files in the `--out` folder, `/tmp/regression-gate` by default | `git`, read-only |

None of them opens a network connection, and none needs a dependency installed.

The reminder hook for Claude Code (`partition-plan/assets/hook/`) is optional and is not enabled by installing the package. Enabling it copies `partition-reminder.py` to `.claude/hooks/` and adds two entries to `.claude/settings.json`, with the Python 3 interpreter found on your machine; nothing else is changed, and removing the two entries disables it. Once enabled, it reads the hook input, prints one message and touches nothing.

## What to keep in mind

Skills are instructions an AI assistant follows with the permissions you gave it. Read a skill before you install it, here as anywhere else, and pin a tag (`elie29/partition#v1.0.0`) rather than a branch.
