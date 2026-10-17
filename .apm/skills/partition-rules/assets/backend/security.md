---
description: 'Backend security: authentication, authorization, data exposure'
applyTo: '<the backend source files>'
---

<!-- Answer each question from the code and from the owner. One line per rule, in the imperative.
     Delete a question that does not apply here. Delete this comment and the questions when done.
     A rule nobody can check is not a rule: say how each one is verified. -->

- Where is authorization enforced, and where is it never enough to enforce it?
- How is the caller identified, and which component trusts what?
- Which data must never appear in a response, an error, a log or an export?
- Which inputs cross a trust boundary, and which single definition validates each?
- Where do secrets live, and what proves none is in the code?

### Verification

- Which command fails when one of these rules is broken?
