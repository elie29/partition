#!/usr/bin/env python3

"""diff_coverage.py — which lines that this change ADDED are actually executed by tests?

Overall coverage is nearly useless for a regression audit: a repo at 85% tells you
nothing about the 40 lines that just changed. Diff coverage does, and it is the single
most decisive number in a ship/no-ship decision.

Usage:
    python3 diff_coverage.py --coverage coverage.xml --rev HEAD
    python3 diff_coverage.py --coverage lcov.info --range main..HEAD
    python3 diff_coverage.py --coverage jacoco.xml --worktree --repo /path/to/repo
    python3 diff_coverage.py --coverage cover.out --rev HEAD --fail-under 80

Supported report formats (auto-detected): lcov (.info), Cobertura (coverage.xml,
pytest-cov, .NET, PHP), JaCoCo XML, Go coverprofile.

Generate the report first, e.g.:
    pytest --cov=. --cov-report=xml
    jest --coverage --coverageReporters=lcov
    go test ./... -coverprofile=cover.out
    mvn test jacoco:report
"""

import argparse
import os
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
from collections import defaultdict

# --------------------------------------------------------------------------- git


def run_git(args, repo):
    # git writes UTF-8 whatever the locale; text=True alone would decode with the locale code page
    return subprocess.run(["git", "-C", repo] + args, capture_output=True,
                          encoding="utf-8", errors="replace")


def git(args, repo):
    r = run_git(args, repo)
    if r.returncode != 0:
        sys.exit(f"git {' '.join(args)} failed: {r.stderr.strip()}")
    return r.stdout


def changed_lines(repo, mode, rev, rng):
    """Return {path: set(added line numbers)} using a zero-context diff."""
    if mode == "rev":
        parent = run_git(["rev-parse", "--verify", "-q", rev + "^"], repo)
        spec = [f"{rev}^..{rev}"] if parent.returncode == 0 else [
            git(["hash-object", "-t", "tree", "/dev/null"], repo).strip() + f"..{rev}"]
    elif mode == "range":
        spec = [rng]
    else:
        spec = ["HEAD"]

    out = git(["diff", "-U0", "-M", "-C"] + spec, repo)
    result = defaultdict(set)
    path = None
    for line in out.splitlines():
        if line.startswith("+++ "):
            p = unquote_path(line[4:].strip())
            path = None if p == "/dev/null" else re.sub(r"^b/", "", p)
        elif line.startswith("@@") and path:
            m = re.search(r"\+(\d+)(?:,(\d+))?", line)
            if m:
                start = int(m.group(1))
                count = int(m.group(2)) if m.group(2) is not None else 1
                for n in range(start, start + count):
                    result[path].add(n)
    return result


GIT_ESCAPES = {"a": 7, "b": 8, "t": 9, "n": 10, "v": 11, "f": 12, "r": 13}


def unquote_path(p):
    r"""Undo git's C-style quoting of a path holding unusual bytes: "b/caf\303\251.py"."""
    if len(p) < 2 or not (p.startswith('"') and p.endswith('"')):
        return p
    body, out, i = p[1:-1], bytearray(), 0
    while i < len(body):
        if body[i] == "\\" and i + 1 < len(body):
            octal = re.match(r"[0-7]{3}", body[i + 1:i + 4])
            if octal:
                out.append(int(octal.group(0), 8))
                i += 4
            else:
                out.append(GIT_ESCAPES.get(body[i + 1], ord(body[i + 1])))
                i += 2
        else:
            out.extend(body[i].encode("utf-8"))
            i += 1
    return out.decode("utf-8", errors="replace")


# ---------------------------------------------------------------- report parsers


def parse_lcov(text):
    cov, cur = defaultdict(dict), None
    for line in text.splitlines():
        line = line.strip()
        if line.startswith("SF:"):
            cur = line[3:]
        elif line.startswith("DA:") and cur:
            try:
                n, hits = line[3:].split(",")[:2]
                cov[cur][int(n)] = int(float(hits))
            except ValueError:
                pass
        elif line == "end_of_record":
            cur = None
    return cov


def parse_cobertura(root):
    cov = defaultdict(dict)
    sources = [s.text.strip() for s in root.findall(".//sources/source") if s.text]
    for cls in root.iter("class"):
        fn = cls.get("filename")
        if not fn:
            continue
        keys = [fn] + [os.path.join(s, fn) for s in sources]
        for ln in cls.iter("line"):
            try:
                n, hits = int(ln.get("number")), int(float(ln.get("hits", 0)))
            except (TypeError, ValueError):
                continue
            for k in keys:
                cov[k][n] = max(cov[k].get(n, 0), hits)
    return cov


def parse_jacoco(root):
    cov = defaultdict(dict)
    for pkg in root.iter("package"):
        pkg_name = pkg.get("name", "")
        for sf in pkg.iter("sourcefile"):
            path = os.path.join(pkg_name, sf.get("name", ""))
            for ln in sf.iter("line"):
                try:
                    n = int(ln.get("nr"))
                    covered = int(ln.get("ci", 0))
                except (TypeError, ValueError):
                    continue
                cov[path][n] = covered
    return cov


def parse_go(text):
    cov = defaultdict(dict)
    for line in text.splitlines():
        if line.startswith("mode:") or not line.strip():
            continue
        m = re.match(r"(.+):(\d+)\.\d+,(\d+)\.\d+ \d+ (\d+)", line)
        if not m:
            continue
        path, start, end, count = m.group(1), int(m.group(2)), int(m.group(3)), int(m.group(4))
        for n in range(start, end + 1):
            cov[path][n] = max(cov[path].get(n, 0), count)
    return cov


def load_coverage(path):
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        text = f.read()
    head = text[:4000]
    if "SF:" in head or path.endswith(".info"):
        return parse_lcov(text), "lcov"
    if head.lstrip().startswith("mode:"):
        return parse_go(text), "go coverprofile"
    if "<" in head:
        root = ET.fromstring(text)
        if root.tag == "report" or root.find(".//sourcefile") is not None:
            return parse_jacoco(root), "jacoco"
        return parse_cobertura(root), "cobertura"
    sys.exit(f"unrecognised coverage format: {path}")


# ------------------------------------------------------------------- matching


def match_path(changed_path, cov_keys_index):
    """Coverage reports use their own path conventions. Match on longest common suffix.

    A suffix keeps at least one directory: a bare file name would match another file of
    the same name elsewhere, and report coverage it does not have."""
    norm = changed_path.replace("\\", "/")
    if norm in cov_keys_index:
        return cov_keys_index[norm]
    parts = norm.split("/")
    for i in range(len(parts) - 1):
        suffix = "/".join(parts[i:])
        hit = cov_keys_index.get(suffix)
        if hit:
            return hit
    return None


def build_index(cov):
    """Map every path suffix -> the report's own key, so 'src/a/b.py' finds 'coverage: /app/src/a/b.py'.

    Suffixes are read with '/', the key is kept as the report wrote it: a key with backslashes, as
    JaCoCo or lcov write them on Windows, is still the one that holds the lines."""
    index = {}
    for key in cov:
        norm = key.replace("\\", "/")
        parts = norm.split("/")
        for i in range(len(parts) - 1):
            index.setdefault("/".join(parts[i:]), key)
        index[norm] = key
    return index


SOURCE_EXT = re.compile(
    r"\.(py|js|jsx|ts|tsx|mjs|cjs|go|java|kt|rb|php|cs|c|cc|cpp|h|hpp|rs|scala|swift|vue|svelte)$")


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--coverage", required=True, help="path to lcov/cobertura/jacoco/go report")
    ap.add_argument("--repo", default=".")
    g = ap.add_mutually_exclusive_group()
    g.add_argument("--rev", default=None, help="commit to audit (default HEAD)")
    g.add_argument("--range", dest="rng", default=None, help="A..B")
    g.add_argument("--worktree", action="store_true", help="uncommitted changes vs HEAD")
    ap.add_argument("--fail-under", type=float, default=None,
                    help="exit 1 if diff coverage is below this percentage")
    ap.add_argument("--include-nonsource", action="store_true",
                    help="also report files with non-source extensions")
    args = ap.parse_args()

    mode = "range" if args.rng else ("worktree" if args.worktree else "rev")
    rev = args.rev or "HEAD"

    changed = changed_lines(args.repo, mode, rev, args.rng)
    cov, fmt = load_coverage(args.coverage)
    index = build_index(cov)

    print("=" * 62)
    print(f" DIFF COVERAGE — {fmt} report: {args.coverage}")
    print("=" * 62)

    total_cov = total_lines = 0
    unmatched, results = [], []

    for path in sorted(changed):
        if not args.include_nonsource and not SOURCE_EXT.search(path):
            continue
        lines = changed[path]
        key = match_path(path, index)
        if key is None:
            unmatched.append(path)
            continue
        file_cov = cov[key]
        measured = sorted(n for n in lines if n in file_cov)
        if not measured:
            unmatched.append(path)
            continue
        covered = [n for n in measured if file_cov[n] > 0]
        uncovered = [n for n in measured if file_cov[n] == 0]
        total_cov += len(covered)
        total_lines += len(measured)
        results.append((path, len(covered), len(measured), uncovered))

    if not results and not unmatched:
        print("\nNo changed source lines found in the diff. Nothing to measure.")
        return 0

    print(f"\n{'file':<52}{'covered':>10}{'%':>7}")
    print("-" * 69)
    for path, c, m, _ in results:
        pct = 100.0 * c / m if m else 0.0
        print(f"{path[-52:]:<52}{f'{c}/{m}':>10}{pct:>6.0f}%")

    for path, c, m, uncovered in results:
        if uncovered:
            print(f"\nUNCOVERED changed lines in {path}:")
            print("  " + compress_ranges(uncovered))

    if unmatched:
        print("\nNOT MEASURED (absent from the coverage report — treat as 0% until proven otherwise):")
        for p in unmatched:
            print(f"  {p}")
        print("  Causes: file excluded from the coverage config, test run did not import it,")
        print("  the report predates the change, or a path-prefix mismatch.")

    pct = 100.0 * total_cov / total_lines if total_lines else 0.0
    print("\n" + "=" * 62)
    print(f" DIFF COVERAGE: {total_cov}/{total_lines} changed lines executed = {pct:.1f}%")
    print(f" files not measured at all: {len(unmatched)}")
    print("=" * 62)
    print(" Covered != correct: it means a test ran the line, not that a test would")
    print(" have failed had the line been wrong. Uncovered changed lines, however,")
    print(" are unverified by definition — list them in the audit report.")

    if args.fail_under is not None and pct < args.fail_under:
        print(f"\nFAIL: diff coverage {pct:.1f}% is below --fail-under {args.fail_under}")
        return 1
    return 0


def compress_ranges(nums):
    out, start, prev = [], nums[0], nums[0]
    for n in nums[1:]:
        if n == prev + 1:
            prev = n
            continue
        out.append(str(start) if start == prev else f"{start}-{prev}")
        start = prev = n
    out.append(str(start) if start == prev else f"{start}-{prev}")
    return ", ".join(out)


if __name__ == "__main__":
    sys.exit(main())
