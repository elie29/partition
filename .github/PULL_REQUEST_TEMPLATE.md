<!-- One thing per pull request. A change of behaviour needs an answered issue first: see CONTRIBUTING.md. -->

## What this changes, in one sentence

## Why

<!-- The issue, or what the assistant got wrong. A typo or an obvious fix needs no issue. -->

Closes #

## Proof

```text
$ npm test
<paste the last lines>
```

<!-- When a skill, the agent or the instruction changed, paste the package budget as well. -->

```text
$ npm run budget
<paste what it printed>
```

## Checklist

- [ ] The title is a Conventional Commit: `type(scope): subject`, imperative, 72 characters at most
- [ ] One thing in this pull request
- [ ] Under 300 changed lines, or the generated or moved text is named above
- [ ] The spec (`docs/specs/partition/spec.md`) says what the package now does, and changed first
- [ ] A script change comes with a test that failed before it
- [ ] A changed description still says what the skill does and when to use it, in an engineer's words
- [ ] Every path a skill cites exists
- [ ] No language, framework or vendor named in a `SKILL.md`
- [ ] Nothing runs unasked, nothing needs installing
- [ ] `CHANGELOG.md` says what users see change, when they do
- [ ] I have read and understood every line
