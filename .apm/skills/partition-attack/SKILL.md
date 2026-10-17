---
name: partition-attack
description: Attack a durable spec or a design before any implementation and write the findings into it. Use once a spec or a design is written and before planning, or when asked to challenge, review or stress a specification.
license: MIT
---

# Attack a specification

Run this on a specification **before** implementation, not on the code after. You are a reader who did not write it and who wants it to fail now rather than in production.

Read the document you are pointed to (a durable spec or a design), the durable spec of its bounded context, the area file of its area, the invariant register and the contracts it names. Read nothing of the neighbouring bounded contexts but their contracts.

## The attacks

1. **The rules.** For each business rule, area rule and invariant that applies: build the sequence of events that breaks it. Which rule has no trigger, no expected effect, or cannot be verified as written?
2. **The siblings.** When a rule is enforced on one route, one entry point or one family of operations, list every other one that must enforce it, on every inbound surface, and check that the document says so.
3. **The access.** Which role can now see or do something it could not before? Which existing rule could this change bypass by accident?
4. **The data.** What sensitive data can appear in a response, an error, a log or an export? What does a migration expose or leave behind? Which piece of data has no documented place?
5. **The session.** What happens to someone mid-session when a permission is revoked, a resource is hidden or a status changes under them? Was what they had selected still valid?
6. **The inputs.** Which values cross a trust boundary, and which single shared definition validates them? Point out any constraint written twice.
7. **The contract.** Does the document change what the bounded context shows to its neighbours without saying so? Does it rely on something a neighbour's contract does not promise?
8. **The budget.** To implement this, must the assistant read outside its bounded context for anything but a contract? List every such file. Does the document describe two things that will not change together?
9. **The words.** Which term is used with two meanings, or has a synonym? Which term of the language is missing?

Skip an attack that plainly does not apply, and say which and why: a report that omits one reads the same whether you tried it or not.

## Output

A numbered list of findings, most severe first. For each:

- the scenario, concrete enough to be replayed;
- the impact;
- the rule, the invariant or the sentence that is missing or ambiguous.

Then the questions the document does not answer.

Write the findings and the questions **into the document**, under `Open questions`, not only in the conversation: what stays in the chat is lost. Change nothing else in it. A finding is settled by the owner, then the spec moves (`partition-spec`), then the code. Until then, a finding left open is a blocker, owned by the person who settles it, of every task that implements what it reaches (`partition-plan`): ask, choose no interim behaviour, and never rule yourself that a finding blocks nothing.

Do not propose an implementation. Do not compliment the document. If you find nothing, say what you tried and where the document was too vague to attack.
