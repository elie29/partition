#!/usr/bin/env bash

# collect_change_context.sh — gather the raw evidence for a regression audit.
#
# Usage:
#   collect_change_context.sh --rev HEAD            [--out DIR] [--repo PATH]
#   collect_change_context.sh --range main..HEAD    [--out DIR] [--repo PATH]
#   collect_change_context.sh --range BASE          [--out DIR] [--repo PATH]   # BASE to the working tree
#   collect_change_context.sh --worktree            [--out DIR] [--repo PATH]
#
# Writes diff.patch, files.txt, stat.txt into --out (default /tmp/regression-gate)
# and prints a triage summary to stdout.
#
# Every flag it prints is a LEAD, not a finding. Confirm each one by reading the code.

set -uo pipefail

MODE=""
REV="HEAD"
RANGE=""
OUT="/tmp/regression-gate"
REPO="."

need_value () { [ $# -ge 2 ] || { echo "$1 requires a value" >&2; exit 2; }; }

while [ $# -gt 0 ]; do
  case "$1" in
    --rev)      need_value "$@"; MODE="rev";   REV="$2";   shift 2 ;;
    --range)    need_value "$@"; MODE="range"; RANGE="$2"; shift 2 ;;
    --worktree) MODE="worktree"; shift ;;
    --out)      need_value "$@"; OUT="$2";     shift 2 ;;
    --repo)     need_value "$@"; REPO="$2";    shift 2 ;;
    -h|--help)  sed -n '3,14p' "$0"; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

[ -n "$MODE" ] || MODE="rev"
cd "$REPO" || { echo "cannot cd to $REPO" >&2; exit 2; }
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "not a git repository: $REPO" >&2; exit 2; }

mkdir -p "$OUT"
DIFF="$OUT/diff.patch"

case "$MODE" in
  rev)
    if git rev-parse --verify -q "${REV}^" >/dev/null 2>&1; then
      SPEC="${REV}^..${REV}"
    else
      SPEC="$(git hash-object -t tree /dev/null)..${REV}"   # root commit
    fi
    git diff -M -C "$SPEC" > "$DIFF"
    ;;
  range)
    [ -n "$RANGE" ] || { echo "--range requires A..B or a base commit" >&2; exit 2; }
    SPEC="$RANGE"
    git diff -M -C "$RANGE" > "$DIFF"
    ;;
  worktree)
    SPEC="HEAD..worktree"
    git diff -M -C HEAD > "$DIFF"
    ;;
esac

git diff --name-status -M -C ${SPEC/..worktree/} > "$OUT/files.txt" 2>/dev/null || \
  git diff --name-status -M -C HEAD > "$OUT/files.txt"
git diff --stat -M -C ${SPEC/..worktree/} > "$OUT/stat.txt" 2>/dev/null || \
  git diff --stat -M -C HEAD > "$OUT/stat.txt"

FILES=$(awk -F'	' '{ if ($1 ~ /^[RC]/) print $3; else print $2 }' "$OUT/files.txt")

echo "=============================================================="
echo " REGRESSION GATE — change context"
echo "=============================================================="
echo "repo:    $(git rev-parse --show-toplevel)"
echo "branch:  $(git rev-parse --abbrev-ref HEAD 2>/dev/null)"
echo "target:  $SPEC"
if [ "$MODE" = "rev" ]; then
  git log -1 --format='commit:  %h%nauthor:  %an <%ae>%ndate:    %ad%nsubject: %s' "$REV"
fi
DIRTY=$(git status --porcelain | wc -l | tr -d ' ')
echo "dirty working tree: $DIRTY file(s)   <- if >0 while auditing a commit, tests do not reflect that commit alone"
UNTRACKED=$(git ls-files --others --exclude-standard | head -20)
[ -n "$UNTRACKED" ] && { echo; echo "untracked files (NOT in the diff — review separately):"; echo "$UNTRACKED" | sed 's/^/  /'; }
echo
echo "--- diffstat -------------------------------------------------"
cat "$OUT/stat.txt"
echo
echo "--- file status ----------------------------------------------"
cat "$OUT/files.txt"

echo
echo "--- deletions / renames (contract risk) ----------------------"
grep -E '^(D|R)' "$OUT/files.txt" || echo "  none"

echo
echo "--- sensitive paths ------------------------------------------"
SENSITIVE='(migrat|schema|\.sql$|auth|login|session|token|jwt|passwd|password|crypt|secret|payment|billing|invoice|charge|checkout|permission|role|acl|admin|security|cors|csrf|middleware)'
echo "$FILES" | grep -Ei "$SENSITIVE" | sed 's|^|  [sensitive]  |' || true
INFRA='(Dockerfile|docker-compose|\.ya?ml$|\.tf$|\.tfvars$|helm|k8s|kubernetes|nginx|\.github/workflows|Jenkinsfile|\.gitlab-ci|Makefile|\.env)'
echo "$FILES" | grep -Ei "$INFRA" | sed 's|^|  [infra-ci]   |' || true
DEPS='(package\.json|package-lock\.json|yarn\.lock|pnpm-lock\.yaml|requirements.*\.txt|poetry\.lock|pyproject\.toml|Pipfile|go\.mod|go\.sum|Cargo\.toml|Cargo\.lock|pom\.xml|build\.gradle|composer\.json|composer\.lock|Gemfile|Gemfile\.lock|\.csproj)'
echo "$FILES" | grep -Ei "$DEPS" | sed 's|^|  [dependency] |' || true
echo "  (empty categories print nothing)"

echo
echo "--- prod vs test balance -------------------------------------"
TESTCOUNT=$(echo "$FILES" | grep -Eic '(^|/)(tests?|specs?|__tests__)/|(\.|_)(test|spec)\.[a-z]+$|Test\.java$|_test\.go$' || true)
TOTAL=$(echo "$FILES" | grep -c . || true)
echo "  $TESTCOUNT test file(s) changed out of $TOTAL"
[ "$TESTCOUNT" = "0" ] && [ "$TOTAL" != "0" ] && echo "  ^ behavior changed with no test change: ask what proves the new behavior"

echo
echo "--- added-line heuristics (LEADS, confirm by reading) ---------"
ADDED=$(grep -E '^\+' "$DIFF" | grep -v '^+++')
probe () { # label, regex
  local hits
  hits=$(echo "$ADDED" | grep -Ei "$2" | cut -c1-160 | head -8)
  [ -n "$hits" ] && { echo "  * $1"; echo "$hits" | sed 's|^|      |'; }
}
probe "swallowed exception / ignored error" '(catch[^)]*\)\s*\{\s*\}|except[^:]*:\s*pass|catch\s*\(.*\)\s*\{\s*//|_\s*=\s*err|err\s*!=\s*nil\s*\{\s*\}|rescue\s*(=>\s*\w+)?\s*$)'
probe "debug leftover"                     '(console\.(log|debug)|debugger;|binding\.pry|byebug|var_dump|print_r|dd\(|fmt\.Print|System\.out\.print|pdb\.set_trace|breakpoint\(\))'
probe "possible hardcoded credential"      '(api[_-]?key|secret|password|passwd|token|private[_-]?key)\s*[:=]\s*["'"'"'][^"'"'"']{8,}'
probe "check disabled / bypassed"          '(verify\s*=\s*False|rejectUnauthorized:\s*false|InsecureSkipVerify|@ts-(ignore|expect-error)|eslint-disable|# *noqa|# *type: *ignore|SuppressWarnings|--no-verify|validate\s*=\s*false)'
probe "sleep / arbitrary timing"           '(sleep\(|setTimeout\(.*[0-9]{4,}|time\.Sleep|Thread\.sleep)'
probe "TODO/FIXME/HACK introduced"         '(TODO|FIXME|HACK|XXX)'
probe "broad SQL write / DDL"              '(DELETE +FROM|UPDATE +[a-z_]+ +SET|DROP +(TABLE|COLUMN|INDEX)|TRUNCATE|ALTER +TABLE)'
probe "raw SQL string interpolation"       '(SELECT|INSERT|UPDATE|DELETE)[^;]*(\+ *[a-z_]+|\$\{|% *\(|f["'"'"'])'
probe "new external/network call"          '(fetch\(|axios\.|http\.(Get|Post)|requests\.(get|post)|HttpClient|curl_exec|new URL\()'
probe "auth / permission logic"            '(isAdmin|hasRole|can[A-Z]|authorize|permission|@PreAuthorize|current_user)'

# empty handler bodies span two lines, so probe() (line-at-a-time) cannot see them
EMPTY=$(awk '/^\+.*(except|catch|rescue)/ { pending=2; prev=$0; next }
             pending>0 { if ($0 ~ /^\+[[:space:]]*(pass|\}|continue|return)?[[:space:]]*$/ || $0 ~ /^\+[[:space:]]*(pass|\{[[:space:]]*\})[[:space:]]*$/)
                          { print "      " prev; print "      " $0 } pending-- }' "$DIFF" | head -12)
[ -n "$EMPTY" ] && { echo "  * handler that catches and does nothing (multi-line)"; echo "$EMPTY"; }
echo "  (nothing listed above = no heuristic matched; absence of leads is not absence of risk)"

echo
echo "--- artifacts ------------------------------------------------"
echo "  $DIFF"
echo "  $OUT/files.txt"
echo "  $OUT/stat.txt"
echo "Next: read diff.patch in full, then run detect_test_tampering.sh."
