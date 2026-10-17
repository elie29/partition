---
description: 'Backend architecture: layers, dependency direction, where decisions live'
applyTo: '<the backend source files, e.g. src/main/**>'
---

<!-- Answer each question from the code and from the owner. One line per rule, in the imperative.
     Delete a question that does not apply here. Delete this comment and the questions when done.
     A rule nobody can check is not a rule: say how each one is verified. -->

- Which layers exist, and where does each live?
- Which layer may depend on which? What is forbidden?
- Where are business decisions taken? Where must they never be?
- How does one bounded context reach another?
- Which inbound surfaces exist, and do they all go through the same application services?
- What may the innermost layer import from the framework, if anything?

### Verification

- Which command fails when one of these rules is broken?
