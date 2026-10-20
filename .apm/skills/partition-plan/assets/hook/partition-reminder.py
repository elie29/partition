#!/usr/bin/env python3

"""Remind the assistant to close a plan when one is marked done or work is committed.

Reads the hook payload on stdin and prints a hookSpecificOutput JSON object when the event is a
plausible "a plan just finished" or "work is being committed" signal. Prints nothing otherwise, so
the hook stays silent on every unrelated tool call. It reads nothing else and writes nothing.

Usage: partition-reminder.py <PreToolUse|PostToolUse>
"""

import json
import re
import sys

PLANS_DIR = "/plans/"

# Matches the plan header line once the plan is finished: "> **Status:** done"
PLAN_DONE = re.compile(r"^\s*>?\s*\*{0,2}\s*status\s*:?\s*\*{0,2}\s*:?\s*done\b", re.IGNORECASE | re.MULTILINE)

# Matches "git commit" in a Bash command, alone or chained: the settings filter is not relied on alone.
GIT_COMMIT = re.compile(r"(^|[\s;&|(])git(\s+-\S+(\s+[^\s-]\S*)?)*\s+commit\b")

REMINDER = (
    "%s Close it as the partition-plan skill says. First a partition-gate verdict on its changes: if the "
    "plan records none, set its Status back to in progress and run the gate before anything else (HOLD "
    "keeps the plan in progress). Then list the statements the work established, move those "
    "that are true for one bounded context into its durable spec, those the bounded contexts of one area "
    "share into its area file, and run the others through the admission test of the invariant register "
    "(partition-spec, references/invariants.md). Show the owner every entry you would write in the area "
    "file or the register, and write it only once validated; then report the identifiers touched and "
    "the candidates rejected, even when none was admitted. When what users install, run or configure "
    "changed, those who build and maintain the project included, realign the README with partition-readme."
)


def written_text(tool_input):
    """Text this Write/Edit call is putting into the file."""
    return "%s%s" % (tool_input.get("content") or "", tool_input.get("new_string") or "")


def reason(payload):
    """Why the closing of a plan might be due, or None to stay silent."""
    tool_input = payload.get("tool_input") or {}
    if payload.get("tool_name") == "Bash":
        if GIT_COMMIT.search(str(tool_input.get("command") or "")):
            return "A commit is about to be created."
        return None

    path = str(tool_input.get("file_path") or "").replace("\\", "/")

    if PLANS_DIR in path and path.endswith(".md") and PLAN_DONE.search(written_text(tool_input)):
        return "A plan has just been marked done."
    return None


def main():
    event = sys.argv[1] if len(sys.argv) > 1 else "PostToolUse"
    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return
    if not isinstance(payload, dict):
        return

    why = reason(payload)
    if not why:
        return

    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": event,
            "additionalContext": REMINDER % why,
        }
    }))


if __name__ == "__main__":
    main()
