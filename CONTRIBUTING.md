# Contributing to Partition

Thank you for wanting to improve Partition. This page says what a contribution must answer, and what will be sent back.

## What Partition is for

Partition helps an engineer keep an AI assistant correct as a project grows. It does that by bounding what the assistant must read and by keeping the specification true. It does not try to replace the engineer's judgement: where a boundary goes, what a business rule says and whether a change ships are decided by people.

Every contribution is weighed against one question:

> Does this make the assistant read less, or be right more often, in a project that is not yours?

## Welcome

- A skill that is wrong, vague or contradicts another one, fixed.
- A procedure made shorter without losing a rule.
- A script made more exact, with a test that failed before.
- A case the scripts do not handle, with a test.
- Documentation that was false, corrected.

## Not welcome

- A skill for one language, one framework or one vendor. Partition is stack-neutral; such a skill belongs in a package of its own.
- Project rules shipped as "good defaults". A generic rule produces generic code.
- Anything that decides in place of a person: a boundary, a business rule, a verdict without execution.
- Anything that runs without being asked, or that a project installing the package must install too.
- A rewrite for style.

## Before you start

| You want to                                                | Do                                           |
| ---------------------------------------------------------- | -------------------------------------------- |
| Fix a typo, a broken link, a small bug with an obvious fix | Open a pull request                          |
| Change what a skill tells the assistant to do              | Open an issue first and wait for an answer   |
| Add a skill, an agent or a script                          | Open an issue first: see "A new skill" below |

Search the open and closed issues before opening one. An issue opens from a form, **Bug report** or **Skill or behaviour proposal**; blank issues are off. A vulnerability goes through [SECURITY.md](SECURITY.md).

## The rules of this repository

They are the rules Partition gives to the projects that install it.

1. **The spec moves first.** [`docs/specs/partition/spec.md`](docs/specs/partition/spec.md) is the source of truth of this package. A change of behaviour changes the spec in the same pull request, before the skill. The spec carries no provenance or status markers: a rule enters it only once the owner has validated it; its origin and reason go to `## Decisions` of the plan.
2. **The package keeps its own budget.** The always-loaded surface stays under 2 000 tokens and each `SKILL.md` under 3 000. `npm test` checks both. Detail goes to `references/`, loaded on demand.
3. **Nothing runs unasked, nothing needs installing.** No hook primitive, no MCP server, no dependency in what the package ships. A script is one file for Node 22 or later, the Python standard library or Bash. The repository's own tooling may take a `devDependency` only when nothing built into Node does the job. Open an issue first and say why; once accepted, it is locked by `package-lock.json`, which `npm test` requires.
4. **No stack in a skill.** A `SKILL.md` names no language, framework or vendor. Per-ecosystem material goes to `references/`.
5. **Everything is in English.**
6. **Done means real output.** A pull request says which command proves the change and pastes what it printed.

### A new skill

Each skill costs every session of every project that installs the package, used or not. So a skill enters by replacing another one, or by a decision recorded in the plan and reflected in the spec. The issue must say:

- what an engineer says when they need it, in their own words;
- what the assistant does wrong today without it;
- which existing skill it could be part of, and why that is not enough.

## Pull requests

- **One thing per pull request**: one skill, one script, one fix.
- **Small.** Aim for under 300 changed lines; above 600, split it. Generated or moved text does not count, but say so.
- **Tests.** A script change comes with a test that failed before it. Run `npm ci` once (Node 22 or later): it installs Prettier and points git at `.githooks/`, whose pre-commit hook formats the staged files and runs `npm test`. A file staged in part stops the commit: stage it whole or stash the rest. `npm run format` formats everything Prettier covers, Markdown included; the YAML under `.apm/` and the budget records under `docs/budget/` are left as written.
- **AI-assisted contributions are welcome, unreviewed ones are not.** You must have read and understood every line you submit, and be able to say why each rule in a skill is there. Raw model output, bulk reformatting and unsolicited rewrites are closed without review.
- Fork, branch from `main`, open the pull request against `main`.

### Commit messages

[Conventional Commits](https://www.conventionalcommits.org), subject in the imperative, 72 characters at most:

```text
feat(partition-budget): count the invariant register in the always gauge
fix(c4-drawio): keep a hand-set route when a relation is renamed
docs(readme): correct the Copilot install path
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`.

## Writing for an assistant

A skill is read by a model, in the middle of someone's work.

- **The description is what triggers the skill.** Say what it does, then when to use it, with the words an engineer would actually type. A vague description collides with its neighbours.
- **Say why.** A rule with its reason is applied to the cases you did not foresee; a bare order is not.
- **Imperative, present tense, one idea per sentence.**
- **A hard stop is a hard stop.** Where a person must validate, say what is shown to them and that nothing is written before they answer.
- **Never tell the assistant to invent.** What is not established is an open question for the owner.
- **Check every path you cite.** The tests fail on a reference to a file that is not in the skill.

## A good pull request

| Good                                 | Sent back                                                 |
| ------------------------------------ | --------------------------------------------------------- |
| Changes the spec, then the skill     | Changes a skill and leaves the spec saying something else |
| One skill, one reason                | Five skills "while I was there"                           |
| A test that failed before            | "Works on my project"                                     |
| The real output of the tests, pasted | "Tests should pass"                                       |
| Shorter than what it replaces        | Longer, with the same rules                               |

## Security

Do not open a public issue for a vulnerability. See [SECURITY.md](SECURITY.md).

## License

By contributing you agree that your contribution is released under the [MIT license](LICENSE).
