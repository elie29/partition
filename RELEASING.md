# Releasing a version

For the maintainer. APM has no central store to upload to: a package is a Git repository, and a version is a tag. Publishing is creating the GitHub release, which creates the tag. From then on `apm install elie29/partition#vX.Y.Z` resolves it, and `apm outdated` shows it to the projects that pin an older one.

## What you need

- Push access to `github.com/elie29/partition`, and Git.
- Node.js 22 or later, for the tests. The repository's `.nvmrc` names the version it is developed on, 24.
- The [APM CLI](https://microsoft.github.io/apm), for the trial install.
- A clean working tree, up to date with `main`.
- The CI green on the release pull request, before it is merged.

No account, token or registry is needed to publish. To _install_ while the repository is private, a consumer needs read access to it and `apm auth github.com`.

## Choose the number

A consuming project depends on three things: the keys of `docs/partition.yml`, the templates, and the command lines of the scripts.

| Change | Version |
| --- | --- |
| A fix that does not change what a skill tells the assistant to do | patch: `0.1.0` to `0.1.1` |
| A new skill, a new behaviour, a new key with a default | minor: `0.1.0` to `0.2.0` |
| A skill renamed or removed, a key or a script option changed, a template whose sections moved | major: `0.1.0` to `1.0.0` |

## Steps

1. **Set the version** with the script. `## [Unreleased]` already lists what changed, one line added with each change as it lands. When it is behind, have the assistant draft it from `git log` since the last tag, and read the draft: it says what a consuming project sees, not what the commits did, and a renamed skill or a changed key in it calls for a major version. The script writes the four places that carry it: `version:` in `apm.yml`, the badge and the install commands of `README.md`, the example in `SECURITY.md`, and a new dated entry at the top of `CHANGELOG.md`: the content of `## [Unreleased]` becomes that entry, under a new empty `## [Unreleased]`.

   ```bash
   # or patch, major, or a number: npm run update-version 0.2.0
   npm run update-version minor
   ```

   Until a first entry is dated, the version in `apm.yml` is not released yet: `npm run update-version 0.1.0` releases it as it is. Then read the new changelog entry; when `## [Unreleased]` was empty, it holds a `TODO` line: write what changed in its place. The script writes files and nothing else: it does not commit, tag or push.

2. **Prove it**, and keep the output. `npm test` fails when the four places that carry the version disagree.

   ```bash
   npm test
   npm run budget
   ```

3. **Try the install** in two throwaway projects, one per target, from the local folder, before anyone else does:

   ```bash
   apm install /path/to/partition --target claude    # first project
   apm install /path/to/partition --target copilot   # second project
   apm compile                                       # second project
   ```

   Claude: twelve skills in `.claude/skills/`, `.claude/agents/spec-auditor.md`, and `.claude/rules/partition.md` with `paths: ["**"]`. Copilot: twelve skills in `.agents/skills/`, `.github/agents/spec-auditor.agent.md`, `.github/instructions/partition.instructions.md` with `applyTo: '**'`, and after `apm compile` no `AGENTS.md` and no `.github/copilot-instructions.md`. No error.

4. **Open the release pull request.** Commit the release on a branch of its own, push the branch, and open a pull request on this repository. Once its CI is green, squash-merge it: the release is one commit on `main`.

   ```bash
   git switch -c release/v0.2.0
   git add apm.yml README.md SECURITY.md CHANGELOG.md
   git commit -m "chore(release): v0.2.0"
   git push -u origin release/v0.2.0
   ```

5. **Create the GitHub release with a new tag.** On GitHub, _Releases_, _Draft a new release_, choose a tag, type the new one, starting with `v`, and create it on publish, targeting `main`, whose last commit is the squash commit of the release pull request. The title is the tag, the notes are the changelog entry, so the change is announced to those who watch the repository.

   ```bash
   git switch main && git pull             # the squash commit of the release pull request
   git tag -a v0.2.0 -m "v0.2.0"
   git push origin v0.2.0
   ```

   The release's "Source code" archives hold only the package, the front page, the content page and the images: `.gitattributes` leaves the rest out (see `CONTENT.md`). `apm install` needs nothing else.

6. **Check from the consumer's side**:

   ```bash
   git pull --tags                         # the tag GitHub created, in your clone
   apm view elie29/partition versions      # the new tag is listed
   ```

   then, in a project that uses the package, `apm outdated` and `apm update`.

Never move or delete a tag once it is pushed: the lockfile of every consuming project pins the commit behind it. A mistake is fixed by the next patch version.

## Not needed, and why

- `apm publish` uploads to a package registry. It is an experimental feature of APM and needs a registry configured; Git tags do the job without one.
- `apm marketplace` lists packages for discovery inside an organisation. Useful the day Partition is one package among several; not for a single repository.
- `apm pack` builds a plugin bundle for hosts that install from an archive instead of from Git. `apm pack --dry-run` lists what the bundle would hold.
