# Getting started with Partition

Partition is the companion of one repository with one business domain. It keeps one durable spec per bounded context, so the assistant works from what is true now. It measures the Context Budget and splits a context once it grows too big, so the assistant holds only what the task needs.

## Who this series is for

You are a tech lead deciding whether to adopt Partition for a repository, or about to introduce it to your team. You know your codebase and your AI assistants; you do not know the package yet. The series tells you what Partition is for, what it will and will not do to your repository, and how to start, on a new project or an existing one. Each article gives you what you need to act, then links to the [step-by-step guide](https://github.com/elie29/partition/tree/main/docs/guides/a-project-step-by-step) for every detail.

## What Partition is not

- It is not a model of a whole estate. It companions one repository with one business domain, not a whole ERP, CRM or enterprise ontology.
- It does not decide for you. People write or confirm the business rules, the architect draws the boundaries, and the owner validates every spec change.
- It does not rewrite your code. It shapes the code that comes next, and proposes changes to existing code through a plan that nothing carries out without your confirmation.

## Reading order

1. [Why Partition](01-why-partition.md): why an assistant loses accuracy as a project grows, the three practices that answer it, the Context Budget, and what Partition is not.
2. [The repository map](02-repository-map.md): every folder and file of a project using Partition, what it holds, who puts a document there, when, and who reads it; what you fill, what Partition creates, and where your technical stack is written.
3. [Set up a project](03-set-up.md): install the package, let Partition write `docs/partition.yml` with you, take the first measure of the Context Budget, and give each rule a scope.
4. [Create a bounded context](04-create-a-bounded-context.md): from a source to one durable spec per bounded context, the boundary decided by the architect, the business rules confirmed by a person, the architecture as a C4 model, the spec attacked before planning, and a spec written before Partition read as a source like any other.
5. [Deliver through a plan](05-deliver-through-a-plan.md): one plan per feature and bounded context as the state of the work, the plan written before every reply, a resume from the plan alone after a cleared session, and the closing through the gate, the spec and the README.
6. [Change at any moment](06-change-at-any-moment.md): the spec moves first when code and spec disagree, a new version of a source brought into the specs, a request that contradicts a rule stopped before code, a scope extended, and a context that changes form from thin to rich.
7. [Reshape when it grows](07-reshape-when-it-grows.md): what raises a reshape, the scheduled assessment of the Context Budget, the architect deciding every boundary, the preconditions, and each move carried by a plan and proven a move: a fission, a new area, a move, two merges, a removal and a promotion.
8. [Adopt Partition on an existing project](08-adopt-on-an-existing-project.md): the sources and the perimeter of the repository gathered once with an AI assistant, outside the package; then Partition from the install on, as on any project; the existing code kept, its spec leading, a disagreement settled in the spec first and a boundary the code breaks reshaped by the architect's decision.
9. [Where a rule lands](09-where-a-rule-lands.md): the levels a rule can live at (the plan, the durable spec, the area file, the invariant register), the admission test, who places a rule and who validates it, what each level costs, and the ladder of Rule C, with Rule B going the other way.
