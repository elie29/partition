# Reading a document source

The reader of a PRD, an existing spec, or a described context saved as a file. Unit: one requirement or story, or one section when the document identifies none, named by its anchor. A part that only records decisions, defines terms or gives context is not a unit: the decisions it states are copied, the rest is pointed to. Source folder: `paths.sources` in `docs/partition.yml` (default `docs/sources`).

The procedures `references/decompose.md` and `references/delta.md` speak the vocabulary of an API contract. For a document, read: _unit_ for operation, _anchor_ for `operationId`, _section_ for tag, _the source_ for the contract, _entity_ for schema. `scripts/contract.mjs` does not apply: what it computes, you do by reading, as this file says.

## Preconditions

The blocking preconditions of the procedures hold, read for a document:

| Precondition | If it fails |
| --- | --- |
| `source` is supplied, as a real file under `<sources>/` or a URL | Stop and ask; show the files of `<sources>/`. Never guess, even when a single file is present. |
| The file exists and is readable, or the URL can be read | Stop and report it. A URL that cannot be read: ask the owner to save the document under `<sources>/`. |
| If `scope` or `extend` is supplied: every entry respects the scope syntax below and every anchor exists | Stop, quote the entry, show the anchors that exist. |
| The source has at least one unit with a stable anchor in the scope | Stop: there is nothing to decompose until the owner gives the parts their anchors. |

## Anchors

A unit is named by the identifier the document gives it (`REQ-12`, `US-4`), otherwise by the slug of its heading (`#refund-a-paid-order`). An anchor is quoted exactly, never shortened or renamed.

A part with no stable anchor (no identifier, a heading repeated or missing) is not given one: list it in `Gaps detected` with the question "which anchor should this part carry?". It is analysed only once the owner has answered, in the source.

## Scope

`scope` (and `extend` in the delta) is a list of anchors separated by `;`, each prefixed `section:` (the heading and everything under it) or `unit:` (one requirement or story). Absent means whole source. An anchor that is not in the source stops the procedure: show the anchors that exist, never retain a close one.

## Inventory

There is no script: build the table by reading the source, restricted to the scope.

| Anchor | Kind | One line | Entity it acts on, quoted | Rules, invariants, decisions it states |
| ------ | ---- | -------- | ------------------------- | -------------------------------------- |

The total is written as for an API: `n in scope / N in the source`. The `Coverage` table of `bounded-contexts.md` has one line per unit, in scope or not.

## Measuring C2, C5 and C6

- **C2** — the root aggregate of a unit is the business entity it acts on, as the source names it. Quote the sentence. Two words for one entity are one entity only when the source says so; otherwise it is an open question.
- **C5** — a third party counts only when the source names it.
- **C6** — units share when they read or write the same entity or the same piece of data, as the source names it.

## What is copied, and what is pointed to

Copied word for word into the spec, with the anchor as source, only when the source **states** it:

- a business rule: a condition and what must happen, true for the context. It goes to `Business rules`, marked "from source", under the "TO VALIDATE" banner;
- an invariant: true across the project. It goes to `Applicable area rules and invariants` as a candidate and through the admission test of the register (`partition-spec`); one that fails it becomes an area rule or a business rule, at the level that holds it;
- a decision: a choice made, with the reason the source gives for it. It goes to `Decisions`, dated by the version or date of the source. A choice the source records without its reason is not a decision: it is pointed to, and asked in `Open questions` only when it leaves something unsettled.

When the source marks its rules, a marked sentence is the whole rule (a sentence after `Rule:`, an item of a list of rules): the sentences around it are not copied with it.

Everything else is pointed to from `Source parts owned`, the sentences a source leaves unmarked among marked rules included. A sentence that only suggests a rule is not a rule: put the question in `Open questions`.

## Provenance and changes

A source in the repository is recorded by the sha of its last commit (`git log -1 --format=%H -- <file>`); modified and not committed, `uncommitted`. The delta compares the recorded sha with the current file by `git diff <sha> -- <file>` and lists the units added, removed, renamed (anchor changed) and modified, by anchor. They are classified as in step 3 of `references/delta.md`, read for a document:

| Change | Nature |
| --- | --- |
| A unit of the recorded scope removed, or its anchor renamed | **Breaking**: stop and ask how to rewrite the scope |
| A modified unit whose requirement, condition or entity changed | **Breaking** when it withdraws or tightens what was asked, **additive** when it only adds |
| A unit added | **Additive**: routed by the criteria, as an added operation is |
| Wording, order or an example only | **Neutral**, unless it names a new third party or changes the vocabulary: then re-check R1 |

A copied rule, invariant or decision that the source changed or removed is reported, never rewritten: a person confirmed it. Step 5 of the delta searches the code by the unit's anchor and by the words of the entity it acts on.

A source at a URL is recorded with its version or the date it was read, and `external` as provenance. Its changes cannot be compared: at a delta, ask the owner what changed, or to save the new version as a file.
