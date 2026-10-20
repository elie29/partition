---
name: partition-rules
description: Create, scope or migrate the project's rule files, backend and frontend, from one source for every assistant. Use to add or change a coding rule, when rules load in every session, when the entry file grows, or to move existing rules.
license: MIT
---

# Rules

A rule is a project convention the assistant must follow: how code is written here. Rules describe the project; skills perform actions. The package ships no rule, because a generic rule produces generic code: each project writes its own, from its code and its owner's answers.

Two things make rules cost more than they give, and this skill exists for both:

- **A rule without a scope is loaded by every session**, whatever the task. A table in the entry file saying "load only when relevant" does not prevent it: the assistant loads every rule file that names no files.
- **A rule copied per assistant drifts.** Two files that say the same thing stop saying it within a month.

## One source, a scope on each

Rules live in the project's own `.apm/instructions/`, one topic per file, named `<profile>-<topic>.instructions.md`:

```markdown
---
description: 'Backend architecture: layers, dependency direction, where decisions live'
applyTo: 'src/main/**'
---
```

A rule has no `#` or `##` heading: its sections start at `###`. `apm compile` gives each rule its own level-2 heading in `AGENTS.md`, and the `description` names it.

`apm install` deploys them to each assistant in its own format, with `applyTo` turned into that assistant's scope. Never edit the deployed copies: edit the source and run `apm install` again.

- `applyTo` names the files the rule concerns, as one glob or several separated by commas. The rule is then loaded only when such a file is in play.
- Only the entry file of the project stays unscoped. It is a map: what the project is, the few rules that hold everywhere, where the rest lives. It carries no detail a scoped rule can carry.
- Backend and frontend in one repository: their scopes separate them (`backend/**`, `frontend/**`). In two repositories: each has its own rules and knows the other through the contract only.

Every line of a rule file, added, changed or removed, by any procedure below or of another skill, is shown with its file and its scope and written only after the owner validates it, as an entry of the register or of an area file is.

## Start a set of rules

1. Ask which profile: `assets/backend/` (architecture, security, testing, database, api-contract, naming) or `assets/frontend/` (architecture, design-ux, accessibility, api, testing, naming). The topics are a starting point: drop those that do not apply, add the project's own.
2. Copy the chosen files to `.apm/instructions/`, renamed `<profile>-<topic>.instructions.md` (`assets/backend/architecture.md` becomes `backend-architecture.instructions.md`).
3. Set each `applyTo` to real paths of this repository. Check that it matches files: a scope that matches nothing is a rule that never loads.
4. Answer the questions of each file from two sources only: the code as it is, and the owner. Quote the file that shows a convention. When the code shows two conventions, ask which is the rule. Never fill a question from what is usual elsewhere: an unanswered question stays a question for the owner.
5. Write each rule as one imperative line, with the reason when it is not obvious, and say how it is verified. Remove the questions and the comment once answered.
6. Run `apm install`, then `partition-budget`: the report must list no rule "without a scope". The entry file is listed by its name, and the instruction of the package as `(instruction)`: neither is a rule file.

## Add or change one rule

Find the file whose topic fits and whose `applyTo` matches only the code the line binds; add the line there. A file of that topic scoped wider does not fit: the line would load wherever that scope reaches. A line that binds part of the code, such as one bounded context, goes to a file of the same topic scoped to that part, named `<profile>-<topic>-<part>.instructions.md`, created if none exists, its scope checked to match files. Otherwise create a file only for a new topic. Before adding, look for a rule that already says it: rewrite that line rather than adding a near-duplicate, but never merge a line into one of a file scoped wider than the code it binds. A rule that binds the whole project and whose breach is a defect, not a matter of style, is a candidate for the invariant register instead (`partition-spec`); one that fails its admission test stays a line here when it says how code is shaped or what it does beside its observable behaviour (names, layout, configuration, framework, logs and other side channels), and goes to the spec when it says what a bounded context holds or shows.

Keep a rule file to what is not obvious from the code. Remove a rule that has become obvious.

## Migrate existing rules

For rules already written for one assistant. Nothing moves unless the owner asks.

1. Run `partition-budget` and list the rules without a scope, with their size.
2. For each file, propose: the topic, the scope (which paths it really concerns), and whether part of it belongs elsewhere: a long reference read once in a while is a document to open on demand, not a rule; commands to build and run belong to the README.
3. Find what is said twice across the files and across the entry file. Quote both places.
4. Present the plan: files to create in `.apm/instructions/`, scope of each, what leaves the entry file, what is left as it is. Wait for validation.
5. Move the text without rewriting it, except its headings: drop the `#` title and start the sections at `###`. Keep the old files until the owner removes them, so nothing is lost; say that while both exist the rules are loaded twice.
6. Run `apm install` and measure again. Show the every-session total before and after.

## What a rule is not

| It is                                  | It goes in                              |
| -------------------------------------- | --------------------------------------- |
| What must be true of the business      | the durable spec of the bounded context |
| What passes the admission test (above) | the invariant register                  |
| A procedure to carry out               | a skill                                 |
| The state of a piece of work           | its plan                                |
