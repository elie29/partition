# Reading an API contract

The reader of an OpenAPI contract. Unit: one operation, named by its `operationId`. A contract is read where it lives: any file of the repository, whatever its folder. `paths.contracts` in `docs/partition.yml` (default `docs/contracts`) is the default folder where a pasted contract, or one read from a URL, is saved. The procedures `references/decompose.md` and `references/delta.md` speak the vocabulary of an API contract (operation, `operationId`, tag, `components` schema): for this source it applies as written.

## The script

`scripts/contract.mjs` reads JSON contracts and does the mechanical work: provenance, inventory, coupling matrix, semantic diff. Its commands are listed in the `Commands` section of each procedure. A YAML contract is converted to JSON first, into a temporary file outside the contracts folder that is not committed.

The script reads files, not URLs. A contract at a URL is saved first to `<contracts>/<name>.json`, under a name the owner gives, validated by the owner and committed alone, as a pasted contract is; its provenance is then that commit.

## Scope

`scope` (and `extend` in the delta) is a list of entries separated by `;`, each prefixed `tag:` or `operationId:`, compared exactly with the contract. The syntax and its checks are in `references/decompose.md`, _Scope syntax_ and _Blocking preconditions_.

## Measuring C2, C5 and C6

- **C2 — root aggregate.** The root aggregate is the **terminal resource** of the path: its last segment that is not a `{…}` parameter (e.g. `/orders` vs `…/products` vs `/invoices`). The segments before it (`countries/{countryCode}`, `customers/{customerId}`…) are addressing context, not aggregates. Only exception: the terminal resource is a **sub-resource**, and the operation belongs to the parent aggregate, when the segment **immediately** before it is a `{…}` identifier and the resource placed just before that identifier is itself the terminal resource of another operation in scope (e.g. `/orders/{orderId}/status-history` as soon as an operation ends with `/orders`). Only that immediate identifier counts: `orders/{orderId}` at the head of `/orders/{orderId}/shipments/{shipmentId}/parcels` does not make `…/parcels` a sub-resource of `/orders`. The `inventory` command prints the terminal resource and whether it is a sub-resource.
- **C5 — dependencies.** Unnamed dependencies and inter-contract references never satisfy C5: see step 2 of `references/decompose.md`.
- **C6 — shared schemas.** `components` schemas and inline duplicated structures shared between operations, the project's common error envelope excluded: the coupling matrix of step 2 of `references/decompose.md`.

## What is pointed to

The spec of a context lists the operations it owns in `Source parts owned`: `operationId`, a link to the contract, one line on what it is for. Paths, parameters, request and response fields, status codes and error codes stay in the contract. Business rules are not stated by an OpenAPI contract: its `Business rules` section keeps the "TO FILL" banner, unless the contract's descriptions state a rule word for word, which is then copied, marked "from source".

A statement the contract makes outside any operation (in the description of the contract, of a tag or of a `components` schema or property) is anchored by the JSON Pointer of the `description` that states it, e.g. `/components/schemas/Loan/properties/returnDate/description`. That anchor is written whole wherever the entry is copied or quoted, never shortened to a property path; the contract is named by its link, as for an operation.
