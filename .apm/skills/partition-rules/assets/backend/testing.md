---
description: 'Backend testing: test types, entry points, what is and is not tested'
applyTo: '<the backend test files, e.g. src/test/**>'
---

<!-- Answer each question from the code and from the owner. One line per rule, in the imperative.
     Delete a question that does not apply here. Delete this comment and the questions when done.
     A rule nobody can check is not a rule: say how each one is verified. -->

- Which kinds of tests exist, and what does each start (nothing, the framework, a database)?
- Through which entry point is each layer tested?
- What is never tested on its own, and what is never tested at all (the framework, a library)?
- How are tests named?
- Which command runs one test, one class, the whole suite?
- What coverage is required, per layer?

### Verification

- Which command fails when one of these rules is broken?
