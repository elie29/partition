---
description: 'Frontend API access: the contract, clients, errors'
applyTo: '<services and models that call the API>'
---

<!-- Answer each question from the code and from the owner. One line per rule, in the imperative.
     Delete a question that does not apply here. Delete this comment and the questions when done.
     A rule nobody can check is not a rule: say how each one is verified. -->

- Which contract does the frontend consume, and is client code generated from it?
- Where are calls made, and where are they forbidden?
- How are responses validated or typed at the boundary?
- How is each family of error handled and shown?
- Which validation is only for the user's comfort, and which does the backend guarantee?

### Verification

- Which command fails when one of these rules is broken?
