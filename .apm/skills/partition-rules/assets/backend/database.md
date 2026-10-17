---
description: 'Database: schema changes, migrations, queries'
applyTo: '<migrations and persistence code>'
---

<!-- Answer each question from the code and from the owner. One line per rule, in the imperative.
     Delete a question that does not apply here. Delete this comment and the questions when done.
     A rule nobody can check is not a rule: say how each one is verified. -->

- How is a schema change delivered, and how are migrations named and ordered?
- May a migration that has run be edited?
- Which engines must each migration support?
- Who may write a query by hand, and under what condition?
- How is concurrent modification handled?
- What is the source of truth for the documented schema?

### Verification

- Which command fails when one of these rules is broken?
