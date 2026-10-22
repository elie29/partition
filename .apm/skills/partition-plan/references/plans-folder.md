# Finding the plans folder

Read when `docs/partition.yml` declares no `paths.plans`, or does not exist.

1. Nothing is declared there, but an instruction of the project names one folder: the team has decided. Use it, say which, and write it as `paths.plans` in `docs/partition.yml`.
2. Nothing names it: look for `docs/plans/`.
   - It exists: use it, say which, and write it as `paths.plans` in `docs/partition.yml`.
   - It does not: stop and ask the owner once, then write the answer there. Never search for a folder on your own: tools keep plans in folders of their own (`docs/superpowers/plans/`, `_bmad/`, others), and a plan opened in the wrong one is a second state of the work.
3. If `docs/partition.yml` does not exist, create it with that one key under the first line of the template, which links the schema, rewritten for the project's target as its second line says (the full template is `partition-budget`'s `assets/partition.yml`); `partition-budget` fills the rest with the owner (its _Configuration_).
