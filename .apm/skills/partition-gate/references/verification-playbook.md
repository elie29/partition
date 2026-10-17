# Verification playbook

How to turn "the diff looks fine" into evidence. Detect the stack, run the cheap checks first, and record every command with its real outcome.

## Detect the stack

```bash
ls package.json pyproject.toml requirements.txt go.mod Cargo.toml pom.xml build.gradle \
   composer.json Gemfile *.csproj Makefile 2>/dev/null
cat package.json | head -60           # read the actual "scripts" block, do not guess
cat Makefile 2>/dev/null | head -40   # projects often wrap everything here
ls .github/workflows/*.y*ml 2>/dev/null && cat .github/workflows/*.y*ml | head -80
```

The CI workflow is the ground truth for "what this project considers a passing build". Prefer replicating CI's commands over inventing your own — matching CI means your verdict matches what the merge gate will say.

## Order of operations

1. **Compile / type-check** — seconds, catches every broken signature.
2. **Lint changed files only** — noise from untouched files is not this change's problem.
3. **Targeted tests** — the modules in the blast radius.
4. **Full suite** — if runtime allows; otherwise state the runtime and that you skipped it.
5. **Diff coverage** — `scripts/diff_coverage.py`.
6. **Before/after comparison** — see below.
7. **Manual probe** — for anything the suite does not reach.

## Commands by ecosystem

`<target>` is the diff of the audit target: `REV^..REV` for a commit, `HEAD` for the working tree, `A..B` for a range, `<base>` alone for a base to the working tree.

**Node / TypeScript**

```bash
npm ci || npm install
npx tsc --noEmit                                   # type-check
npx eslint $(git diff --name-only <target> -- '*.ts' '*.tsx' '*.js')
npx jest --findRelatedTests $(git diff --name-only <target> -- '*.ts' '*.tsx' '*.js')
npx jest --coverage --coverageReporters=lcov       # -> coverage/lcov.info
npx vitest run --coverage                          # vitest equivalent
npm run build                                      # bundling can fail where tsc passes
```

**Python**

```bash
pip install -e . || pip install -r requirements.txt
python -m compileall -q .                          # syntax floor
mypy <changed_pkg> ; ruff check <changed files>
pytest <paths touching the blast radius> -x -q
pytest --cov=. --cov-report=xml                    # -> coverage.xml
python -c "import mypackage"                       # import-time errors are real outages
```

**Go**

```bash
go build ./... && go vet ./...
go test ./... -race -count=1                       # -race is the point, not optional
go test ./... -coverprofile=cover.out
```

**Java / Kotlin**

```bash
mvn -q -DskipTests compile && mvn test
mvn test jacoco:report                             # -> target/site/jacoco/jacoco.xml
./gradlew build test
```

**Rust** `cargo check && cargo clippy -- -D warnings && cargo test` **Ruby** `bundle exec rubocop <files> && bundle exec rspec <specs>` **PHP** `composer install && ./vendor/bin/phpstan analyse && ./vendor/bin/phpunit` **.NET** `dotnet build -warnaserror && dotnet test /p:CollectCoverage=true /p:CoverletOutputFormat=cobertura` **SQL migrations** — see `database-and-migrations.md`; run up, then down, then up again on a scratch database.

## Before/after comparison

The most defensible evidence, when the suite is fast enough. The baseline runs in a worktree at the base of the target — `REV^` for a commit, `HEAD` for the working tree, `A` for a range `A..B` — so the user's tree is never touched:

```bash
git worktree add --detach /tmp/base <base>
(cd /tmp/base && <test command> 2>&1 | tail -30)   # baseline, without the change
<test command> 2>&1 | tail -30                     # with the change
git worktree remove --force /tmp/base
```

Install the dependencies in the worktree first if the test command needs them.

Compare the two lists of failures:

- Failing before and after → pre-existing, not this change's regression. Say so.
- Passing before, failing after → **the regression**. This is a Blocker with proof.
- Failing before, passing after → the fix works.

## Does the new test actually catch the bug?

For a bug-fix change, copy the new test into the baseline worktree above, where the source is still without the fix, and run it there. If it passes, the test does not protect the fix, and the fix will silently rot. The user's tree is never touched.

## When you cannot run anything

Common and acceptable — offline sandbox, no dependencies, no database, proprietary toolchain. What is not acceptable is hiding it. Then:

- Say exactly which checks were impossible and why.
- Push static analysis harder: read every changed hunk with its surrounding file, trace call sites by hand, reason about the boundary values.
- Cap confidence at Medium (Low for anything touching money, auth, or data migration).
- Hand the user the exact commands to run themselves, so they can close the gap in minutes.

## Reporting results

Quote real output, trimmed:

```bash
$ npx jest --findRelatedTests src/cart/total.ts
Tests: 3 failed, 41 passed, 44 total
  ● cart total › applies percentage discount before tax
    Expected: 108.00   Received: 110.16
```

Never paraphrase a result you did not see. "Tests pass" without a command and a count is the exact sentence this skill exists to eliminate.
