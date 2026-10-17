#!/usr/bin/env bash

# detect_test_tampering.sh — did this change weaken the safety net?
#
# Usage:
#   detect_test_tampering.sh --rev HEAD [--repo PATH]
#   detect_test_tampering.sh --range main..HEAD
#   detect_test_tampering.sh --range BASE          # BASE to the working tree
#   detect_test_tampering.sh --worktree
#
# A green suite proves nothing if the red tests were removed. This looks for
# tests deleted, skipped, loosened, or switched off in CI — usually innocent
# (a test that no longer applies), occasionally the whole story.

set -uo pipefail

MODE="rev"; REV="HEAD"; RANGE=""; REPO="."
need_value () { [ $# -ge 2 ] || { echo "$1 requires a value" >&2; exit 2; }; }
while [ $# -gt 0 ]; do
    case "$1" in
        --rev)      need_value "$@"; MODE="rev";   REV="$2";   shift 2 ;;
        --range)    need_value "$@"; MODE="range"; RANGE="$2"; shift 2 ;;
        --worktree) MODE="worktree"; shift ;;
        --repo)     need_value "$@"; REPO="$2";    shift 2 ;;
        -h|--help)  sed -n '3,13p' "$0"; exit 0 ;;
        *) echo "unknown argument: $1" >&2; exit 2 ;;
    esac
done

cd "$REPO" || exit 2
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "not a git repository" >&2; exit 2; }

case "$MODE" in
    rev)
        if git rev-parse --verify -q "${REV}^" >/dev/null 2>&1; then SPEC="${REV}^..${REV}";
        else SPEC="$(git hash-object -t tree /dev/null)..${REV}"; fi ;;
    range)
        [ -n "$RANGE" ] || { echo "--range requires A..B or a base commit" >&2; exit 2; }
        SPEC="$RANGE" ;;
    worktree) SPEC="HEAD" ;;
esac

DIFF=$(git diff -M -C $SPEC)
REMOVED=$(echo "$DIFF" | grep -E '^-' | grep -v '^---')
ADDED=$(echo "$DIFF" | grep -E '^\+' | grep -v '^+++')

echo "=============================================================="
echo " REGRESSION GATE — test-safety-net check ($SPEC)"
echo "=============================================================="

section () { echo; echo "--- $1"; }
show () { # regex, source
    local hits; hits=$(echo "$2" | grep -Ei "$1" | head -12)
    if [ -n "$hits" ]; then echo "$hits" | sed 's/^/   /'; return 0; else echo "   none"; return 1; fi
}

section "test files deleted"
git diff --name-status -M -C $SPEC | grep -E '^D' | \
    grep -Ei '(^|/)(tests?|specs?|__tests__)/|(\.|_)(test|spec)\.[a-z]+$|Test\.java$|_test\.go$' | sed 's/^/   /' || echo "   none"

section "test cases removed (deleted test/it/def blocks)"
show '^-.*(\b(it|test|describe|context)\s*\(|def test_|func Test[A-Z]|@Test\b|\[Test\]|\[Fact\]|it_should|scenario\s*\()' "$REMOVED"

section "assertions removed"
show '^-.*(assert|expect\(|should\.|\.to(Be|Equal|Throw|Have)|require\.(NoError|Equal)|Assert\.)' "$REMOVED"

section "tests newly skipped / ignored"
show '^\+.*((it|test|describe)\.(skip|todo|only)|xit\(|xdescribe\(|@(unittest\.)?skip|pytest\.mark\.(skip|xfail)|@Ignore|@Disabled|t\.Skip\(|\bpending\b|\.only\()' "$ADDED"

section "assertions loosened (exact -> fuzzy, or awaited-value checks dropped)"
show '^\+.*(toBeTruthy|toBeDefined|assertTrue\(true|expect\(true\)|assert True|is not None\s*$|!= *null\s*$|any\(\)|Mockito\.any)' "$ADDED"

section "snapshots regenerated"
git diff --name-status -M -C $SPEC | grep -Ei '\.snap$|__snapshots__|\.approved\.|\.golden' | sed 's/^/   /' || echo "   none"

section "CI / coverage thresholds changed"
git diff --name-status -M -C $SPEC | grep -Ei '(\.github/workflows|\.gitlab-ci|Jenkinsfile|azure-pipelines|circleci|jest\.config|vitest\.config|pytest\.ini|setup\.cfg|tox\.ini|codecov|sonar|\.nycrc|jacoco)' | sed 's/^/   /' || echo "   none"
show '^[-+].*(coverageThreshold|fail_under|--cov-fail-under|minimum_coverage|continue-on-error|--no-verify|ignore-failures|\|\| true)' "$DIFF"

section "test timeouts extended / retries added"
show '^\+.*(timeout\s*[:=]\s*[0-9]{4,}|jest\.setTimeout|retries\s*[:=]\s*[1-9]|flaky|--retry)' "$ADDED"

echo
echo "=============================================================="
echo "Interpretation: each hit needs a reason in the audit report."
echo "'Deleted because the feature was removed' is fine. 'Skipped to get"
echo "CI green' is a Blocker. If tests were removed, check whether the"
echo "behavior they guarded is still covered anywhere else."
