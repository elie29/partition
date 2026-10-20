# <bounded-context>

> **Source:** `<path or URL of the source>`
>
> **Source version:** <version, or the date for a document without one>
>
> **Provenance:** YYYY-MM-DD · <sha of the source's commit, `uncommitted`, or `external` for a URL>
>
> **Scope:** <scope, or `whole source`>
>
> **Decomposition:** see `../bounded-contexts.md`

<!-- The header above is filled by partition-shape, or partition-reshape for a fission. -->
<!-- The empty ">" lines keep each header line on its own line when the Markdown is reformatted. -->

## Business objective

<What this bounded context serves, in business language.>

## Scope

**In scope:** …

**Out of scope:** … <what is handed to another bounded context or to a third party>

## Language

One meaning per word, no synonyms. A word that changes meaning in a neighbour marks the boundary.

| Term | Meaning in this bounded context |
| ---- | ------------------------------- |

## Source parts owned

What this bounded context owns in its source. The source says what each part holds; this spec does not repeat it.

| Unit                                     | Where                              | What it is for              |
| ---------------------------------------- | ---------------------------------- | --------------------------- |
| <operationId, or requirement or section> | <link to its anchor in the source> | <one line>                  |
| <part that is not a unit, by its anchor> | <link to its anchor in the source> | <what it holds, not copied> |

## Business rules

> **TO FILL BEFORE THIS BOUNDED CONTEXT IS USED.** This section is left empty on purpose: a business rule cannot be deduced from a source or from code. While this banner stands, the bounded context is not fit for design or implementation.

<!-- Keep one banner: "TO FILL" while the section is empty, "TO VALIDATE" while it holds only copied rules. -->

> **TO VALIDATE BEFORE THIS BOUNDED CONTEXT IS USED.** The rules marked "from source" were copied word for word from the source that states them. A person confirms each one, adds the rules the source does not state, then removes this banner. Until then the bounded context is not fit for design or implementation.

| # | Rule | Trigger | Expected effect | Source |
| --- | --- | --- | --- | --- |
| BR-1 | <present tense, verifiable> | <when it applies> | <what must happen> | <from source: anchor; or workshop, document, person> |

Remove the banner once the section is filled and confirmed.

## Decisions

The decisions the source states, copied with their reason. A decision taken while building lives in the plan that took it; what it established is written in the sections above.

| Decision | Reason | Source | Date |
| -------- | ------ | ------ | ---- |

## Persistence

> **Reference:** the schema documents declared in `docs/partition.yml` (`paths.schemas`).

| Data of the source | Place in the schema | Read / Written | Note |
| ------------------ | ------------------- | -------------- | ---- |

**Data without a documented place:** <every piece of data with no match in the schema documents. Each one is an open question. Never invent a field, a collection, a type or a constraint.>

Write "No persistence" when this bounded context reads and writes nothing that is documented.

## External dependencies

<Third-party systems named by the source or the workshop, and what is asked of them. "None" otherwise.>

## Contracts with neighbours

<What this bounded context shows to the others, and what it consumes from them. A neighbour is known by this and nothing else. An API contract given for this bounded context once it exists is recorded here, never as a second source of its decomposition.>

| Neighbour | Direction | Contract | What crosses |
| --------- | --------- | -------- | ------------ |

## Applicable area rules and invariants

| Entry | What it constrains here |
| ----- | ----------------------- |

<The area rules (`AR-n`) of the area file and the entries of the invariant register (`INV-…`) that bind this bounded context. "None" otherwise. A shared rule or an invariant the source states is listed as a candidate, quoted with its anchor, until the owner validates it at its level; one that fails the admission test of the register becomes an area rule or a business rule, at the level that holds it.>

## Open questions

<Everything that is not settled and will be needed to design. One answerable question per line. This is where what would otherwise have been invented goes. An entry leaves once a person settles it, in the change that writes the answer; one no person has settled leaves only with the owner.>
