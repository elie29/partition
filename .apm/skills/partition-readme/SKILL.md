---
name: partition-readme
description: Updates a project's README based on the latest code modifications (git history and diff), syncing every impacted section — features, installation, usage, API, configuration. Use this skill whenever the user asks to update, refresh, sync, or bring a README (or the project's main documentation page) up to date after recent changes, commits, a release, or a refactoring — even if they simply say "update the readme", "the readme is outdated", or "document the latest changes". Applies to any git repository containing a README.
license: MIT
---

# Update README

Bring a project's README back in sync with the actual state of the code, based on what has changed since the README was last updated. The goal is not to rewrite the README, but to realign it with the code: a reader following the README should end up with a project that works exactly as described.

## Where the README stands

The README is a derived document: it is rebuilt from the code and is never the source of anything. This skill changes the README only, never the code and never a durable spec. Where the README and a durable spec disagree on a behaviour, the spec rules: report the gap in Step 5, do not settle it in the README.

## Step 1 — Locate the README and the git reference point

1. Find the README: `README.md` at the repository root by default. If the user pointed at a specific path or sub-project (monorepo), use that one. If several READMEs exist and the target is ambiguous, ask. Hold the path found in a variable: `README=<path>`.
2. Find the last commit that touched the README:

   ```bash
   LAST=$(git log -1 --format=%H -- "$README")
   ```

   This is the reference point: everything that changed after this commit is potentially undocumented.

Edge cases:

- **No git repository**: tell the user, and offer to update the README by simply comparing its content against the current code.
- **No README**: offer to create one from the code (project structure, package manifest, entry points).
- **README never committed** (file present but absent from history): use the root of the history as the reference, or compare the README against the current code as a whole.

## Step 2 — Collect the changes since that reference

Gather an overview before reading anything in detail:

```bash
git log --oneline $LAST..HEAD
git diff --stat $LAST   # committed and uncommitted changes since $LAST
git status --short     # also lists new files not yet tracked
```

If `$LAST..HEAD` is empty and the working tree is clean, the README is already up to date with the history: say so and change nothing (unless a quick read reveals an obvious mismatch between README and code — flag it before fixing).

If the history since `$LAST` is very large, rely first on `--stat` and the commit messages to target which files to examine, rather than reading the entire diff.

## Step 3 — Analyze the documentation impact

Read the diff of the relevant files (`git diff $LAST -- <files>`, which includes the uncommitted changes) and classify the changes by what they imply for the README. Typical points of attention:

- **New features or commands** → Features / Usage sections.
- **Public API changes** (signatures, endpoints, exports) → code examples and API section. Check every README example that touches the modified API.
- **Dependencies, versions, prerequisites** (package manifests and lockfiles, container files, runtime versions) → Installation / Prerequisites section.
- **Configuration** (environment variables, config files, CLI options) → Configuration section.
- **Scripts and tooling** (package or build scripts, CI, build or test commands) → Development / Contributing sections.
- **Breaking changes** → call them out explicitly in the README, don't just fix things silently.
- **Removals**: whatever was removed from the code must be removed from the README. A README documenting a dead option is worse than an incomplete one.

Never document from commit messages alone: they tell you where to look, but the code is the source of truth. Before stating that a command, option, or function exists, verify it in the current code.

## Step 4 — Update the README

Editing principles:

- **Respect what's there**: keep the README's language (detect it and write in that same language), its structure, tone, level of detail, badges, and formatting. The result should look like a README maintained by its author, not rewritten by someone else.
- **Targeted edits**: only modify the sections impacted by the identified changes. Don't rephrase correct passages out of stylistic preference.
- **Accuracy over completeness**: every command, path, option name, or code snippet written into the README must exist as-is in the project. When in doubt, verify in the sources; never invent.
- **Create a section only when needed**: if a significant change has no natural home (e.g. the project's first environment variable), create one, following the structural conventions already in place.
- If the README contains a changelog/history section, add the notable changes there; otherwise, don't create one without an explicit request.

## Step 5 — Report back

Finish with a brief summary for the user: which sections were modified and why (which code change motivated what), any mismatches detected but left uncorrected due to uncertainty, and any open questions (e.g. "command X disappeared from the code, I removed its docs — was that intentional?"). Don't paste the entire README into the reply.
