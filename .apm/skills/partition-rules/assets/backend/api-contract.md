---
description: 'API contract: the contract is the source, generated code is never edited'
applyTo: '<controllers, DTOs, the contract files>'
---

<!-- Answer each question from the code and from the owner. One line per rule, in the imperative.
     Delete a question that does not apply here. Delete this comment and the questions when done.
     A rule nobody can check is not a rule: say how each one is verified. -->

- Which file is the source of truth for the API, and where is it?
- What is generated from it, and where does the generated code live?
- In which order does an API change happen (contract, generation, code)?
- Where do shared constraints live so that no route duplicates them?
- What makes a change breaking, and what does a breaking change require?
- Which endpoints must never appear in the exposed contract?

### Verification

- Which command fails when one of these rules is broken?
