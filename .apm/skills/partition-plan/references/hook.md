# Enabling the reminder hook

The hook in `assets/hook/` reads the hook input, prints one message and touches nothing. It knows a plan by a `plans/` folder in its path: when `paths.plans` in `docs/partition.yml` names a folder otherwise, say that only the commit reminder fires.

1. Find Python 3: run `python3 --version`, then `python --version`, then `py -3 --version`. The first that prints `Python 3.` is the interpreter. None does: say the hook cannot run here, and stop before copying anything.
2. Copy `assets/hook/partition-reminder.py` to `.claude/hooks/partition-reminder.py`.
3. Merge the two entries of `assets/hook/settings.json` into the `hooks` of `.claude/settings.json`, keeping whatever is already there, with `<python>` replaced by that interpreter.
4. Say that removing those two entries disables it, and that the interpreter written is this machine's: a teammate on another system may need another one in their copy. Say too that a package update does not refresh the copy: copy `assets/hook/partition-reminder.py` again after each update.
