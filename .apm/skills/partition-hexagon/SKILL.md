---
name: partition-hexagon
description: Choose or change the form of a hexagon, thin or rich, and its layer map, and check dependency direction against that map. Use when creating a module or a bounded context, when a business rule enters the spec of a hexagon whose form is declared, before writing or changing a form, its reason or a layer map in docs/partition.yml, when business logic leaks into an adapter, or to review architecture conformance.
license: MIT
---

# Hexagons

A bounded context is made of one or several hexagons: ports-and-adapters units. Every dependency on the outside goes through an interface (a port) and an adapter. That is what lets a component become a container later without rewriting its callers. The form inside the hexagon depends on how much the business has to say.

## Two forms

**Thin: no domain layer.** Use cases drive ports; data travels as plain structures. There is no folder of business objects, because there is no business behaviour to put in them: the hexagon reads, writes, translates or relays. Ports and adapters stay, in full.

**Rich: a domain model.** Business objects hold behaviour and protect their own state. The domain depends on nothing: no framework, no persistence, no transport.

Choose per hexagon, with the owner, and write the choice and its reason in `docs/partition.yml`, under the entry of its bounded context in `contexts:` (`hexagons:` with `form` and `reason`). A form with no reason is not a decision.

| The durable spec of the context shows                                       | Form |
| --------------------------------------------------------------------------- | ---- |
| Rules that only check inputs, map fields or filter                          | thin |
| No state that changes over time under rules                                 | thin |
| A status that moves under conditions, with transitions that are forbidden   | rich |
| Rules that tie several pieces of data together and must hold at every write | rich |
| The same calculation needed by several use cases                            | rich |

Read the `Business rules` of the spec to decide, not the code. While that section still carries its banner, the form cannot be chosen: say so, and give no reading of the rules against the table.

**Thin is not permission to skip the ports.** The shortcut that destroys the architecture is a use case that calls a database or an HTTP client directly because "there is no domain anyway".

**Change the form from thin to rich** when a rule of a `rich` row of the table enters the spec. A change of form, not a promotion: it is a decision recorded with its reason in the plan and in `docs/partition.yml`, then carried out by the first tasks of the plan of the behaviour that needs it, not by a plan of its own. Those tasks move into the domain layer the code of the hexagon it takes, and prove the move before any behaviour is built on the domain layer: the expected result written first, no behaviour added or changed, next to the real output of the verification command, and the [check](#check) of the layer map finding no dependency of the domain layer on anything outside it. Do not grow a domain layer by accretion, one "small check" at a time, inside use cases or adapters.

## The layer map

Each hexagon declares its layers and the dependencies allowed between them, under its bounded context:

```yaml
contexts:
  - id: orders
    hexagons:
      - id: orders
        form: thin
        reason: reads and writes two tables, no state to protect
        layers:
          inbound: src/orders/inbound/**
          application: src/orders/application/**
          outbound: src/orders/outbound/**
        allowed:
          - inbound -> application
          - outbound -> application # outbound implements the ports the application defines
```

The names of the layers are the project's. A rich hexagon adds its domain layer and what may depend on it. Whatever is not in `allowed` is forbidden; the application layer depends on its own ports and on nothing outside. If the map is missing, write it with the owner from the project's architecture rule; do not infer it from the folders.

## Check

1. Read the map of the hexagon.
2. For each layer, list what its files import or reference, and match each target against the layers.
3. Report every dependency that is not allowed, with `file:line` and the two layers. No finding without a line.
4. Report also, with `file:line`:
   - a business decision taken in an adapter or an inbound layer (a branch on business state);
   - a use case that reaches a database, a file or a network client without a port;
   - in a rich hexagon, a domain file that imports anything from outside the domain;
   - one hexagon importing from another instead of going through a contract;
   - in a thin hexagon, business behaviour accumulating in use cases: the sign that the form is wrong.
5. Say what you did not check and why.

Change nothing while checking. A finding is fixed through a plan, and when the code departs from the map beyond the scope of the current change, point it out and ask before refactoring.

## Make the build say it

A check by reading catches what is there today. The rule must fail the build when a forbidden dependency is introduced. If the project has no such check, propose one with the tool of its ecosystem (LOAD `references/build-checks.md`) and generate its rules from the layer map, so the map stays the one source.
