# What a reshape writes in the specs

The specs move with the code, in the same plan. Nothing is deleted: a spec that loses its bounded context is frozen under a banner, and its folder is deleted by a person, once what it holds by hand has a new home. Nothing written by hand is copied by the assistant: a person carries it over. `<specs>` is `paths.specs` in `docs/partition.yml`; the path of a spec, of an area file and of `bounded-contexts.md` is the one `partition-spec` gives.

## Fission

`<bc>` becomes `<bc>` and `<bc-new>`.

- **Spec of `<bc-new>`** — created from the template of the `partition-spec` skill, `assets/spec.md`. Its `Source parts owned` lists the units it takes, with their links.
- **Spec of `<bc>`** — the units that leave are taken out of its `Source parts owned`. Each rule that leaves goes where the precondition on rules sent it (`SKILL.md`, _Preconditions_), in the same change.
- **`bounded-contexts.md`** — a line for `<bc-new>` in `Bounded contexts retained`, with the criteria that justify it; in `Coverage`, the units that moved pass to `<bc-new>`; the `Decided` line and, when the record kept a point against a criterion, its line in `Kept against the criteria`. A line of `Decisions not to split` or `Alternatives rejected` the fission overturns moves to `History`, dated, so that the record never contradicts itself.

## Merge

`<bc-a>` absorbs `<bc-b>`.

- **Spec of `<bc-a>`** — its derived sections are regenerated on the union of the units; `Persistence` receives the lines of `<bc-b>` it does not already carry (addition only); its hand-written sections stay intact, **no business rule transferred**. The area rules that bound only `<bc-a>` and `<bc-b>` become business rules of `<bc-a>`, carried by a person, and leave the area file. Banner at the head, removed by a person once the carry-over is done:

  ```markdown
  > **Status:** absorbed `<bc-b>` on YYYY-MM-DD. The hand-written sections of `../<bc-b>/spec.md` (objective, scope, language, business rules, dependencies, contracts with neighbours, invariants, questions) are to be carried over here by a human.
  ```

- **Spec of `<bc-b>`** — kept and frozen: its derived sections, `Source version` and `Provenance` are no longer updated. A "merge proposed" banner, if there is one, is replaced by:

  ```markdown
  > **Status:** merged into `<bc-a>` on YYYY-MM-DD. Frozen spec: its derived sections are no longer kept up to date. It remains the source of its hand-written sections until they are carried over into `../<bc-a>/spec.md`. See `../bounded-contexts.md#history`.
  ```

- **Folder of `<bc-b>`** — kept. Its deletion is a person's decision, after the carry-over. Until then `<bc-b>` stays declared in `docs/partition.yml`, with its area; its entry is taken out once the folder is deleted.
- **`bounded-contexts.md`** — in `Bounded contexts retained`, the line of `<bc-a>` is updated (units, criteria, justification) and the line of `<bc-b>` is taken out, then carried into `Decisions not to split` (units, criteria failing, "merge of YYYY-MM-DD into `<bc-a>`", with the rule that called for it: R6, or R4 when shared data or rules prevail); in `Coverage`, the units of `<bc-b>` pass to `<bc-a>`. The deltas that follow no longer count `<bc-b>`. The `Decided` line and, when the record kept a point against a criterion, its line in `Kept against the criteria`.

## Removal

`<bc>` has nothing left.

- **Spec of `<bc>`** — kept and frozen: its derived sections, `Source version` and `Provenance` are no longer updated; its hand-written sections stay intact. A "removal proposed" banner, if there is one, is replaced by:

  ```markdown
  > **Status:** removed on YYYY-MM-DD — no unit is attached to it any more. Frozen spec: its hand-written sections (business rules included) are to be archived or reassigned by a human. See `../bounded-contexts.md#history`.
  ```

- **Folder of `<bc>`** — kept. Its deletion is a person's decision. Until then `<bc>` stays declared in `docs/partition.yml`, with its area; its entry is taken out once the folder is deleted.
- **`bounded-contexts.md`** — the line of `<bc>` is taken out of `Bounded contexts retained`. It is not carried into `Decisions not to split`, which only speaks of units kept together: the trace of the removal is the `History` line. The deltas that follow no longer count `<bc>`.

## Move

A unit passes from `<bc>` to `<bc-to>`: it leaves the derived sections of `<bc>`, joins those of `<bc-to>`, and its `Coverage` line changes. A rule that only that unit carried moves with it, by a person.

## The area file

After a merge, a removal or a move, read the area file of each area the reshape touched. An area rule that now binds only one bounded context, and a word only one bounded context uses, come down to that bounded context's spec, carried by a person, and leave the area file: a rule to `Business rules`, a word to `Language`. An area file left with no rule and no word is deleted by a person; the area then loads none. A fission adds bounded contexts to an area and brings nothing down.

## History

Each reshape adds a line to the `## History` section of `bounded-contexts.md`, creating the section if it is absent. Its `Nature` is `fission`, `merge`, `removal` or `move`; its `Detail` names the bounded contexts (`<bc-b>` absorbed by `<bc-a>`, criteria lost; a bounded context removed, its units and what became of them; a unit, its bounded context of departure and of arrival). It is the only place where the dated _why_ of a reshape is recorded; the specs carry only the current state.

## At closing

- **Merges carried out** — for each, the hand-written sections of `<bc-b>` to carry over into `<bc-a>`, then the folder of `<bc-b>` to delete by hand.
- **Removals carried out** — for each, the hand-written sections, business rules included, to archive or to reassign, then the folder to delete by hand.
- **Area entries to bring down** — each area rule or word left to one bounded context, and the spec it goes to; then each area file left empty, to delete by hand.

## Anti-patterns

| Do not | Do |
| --- | --- |
| Delete the spec or the folder of a bounded context absorbed by a merge or removed | Freeze the spec under a banner, leave the folder, report it at closing |
| Copy the business rules of the absorbed bounded context into the absorbing one | Leave the carry-over to a person, banner on the absorbing spec |
| Copy a rule both halves of a fission need into both specs | Give it one home, as the precondition on rules says |
| Leave in the area file a rule or a word one bounded context alone holds after the reshape | Bring it down to that spec, by a person |
| Keep an area file with no rule and no word | Have a person delete it |
