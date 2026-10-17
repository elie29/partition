# Regression taxonomy

Work through the classes that apply to the change. Each entry gives the _diff-level signature_ (what to grep/read for) and the _production failure_ it becomes. Findings must always be phrased as the failure, not the signature: "removed the `status` filter, so cancelled orders now appear in the daily revenue export" — not "changed a where clause".

Contents: 1 Logic · 2 Contracts · 3 Data & persistence · 4 State & concurrency · 5 Performance & resources · 6 Error handling · 7 Security · 8 Config & deploy · 9 Frontend · 10 Async & integration · 11 Tests as evidence

---

## 1. Behavioral / logic

| Signature in the diff | Failure |
| --- | --- |
| Comparison operator flipped (`<` ↔ `<=`, `>` ↔ `>=`) | Off-by-one at the boundary; the one row/day/item at the edge is included or lost |
| Boolean condition reordered, `&&`/`\|\|` swapped, negation added | Inverted access rules, silently wrong branches |
| Early `return`/`continue`/`break` added or removed | Skipped side effects downstream (audit log not written, cache not invalidated) |
| Default value or fallback changed (`?? 0`, `or []`, `COALESCE`) | Silent zeroes/empties instead of errors; wrong aggregates |
| Number type changed (float↔decimal↔int), rounding or currency math edited | Money that does not reconcile; the classic 0.1+0.2 class of bug |
| Date/time handling: timezone, `now()`, UTC conversion, date arithmetic | Off-by-one-day, DST duplicates/gaps, midnight-boundary reports |
| Sort/order changed or removed | Non-deterministic pagination, duplicated or missing rows across pages |
| Loop bounds, slicing, or index arithmetic | Off-by-one, truncated last element |
| Copy/paste of a nearby block with one variable not renamed | The wrong field is read/written; typically passes shallow tests |

Always test the change mentally against: 0, 1, negative, null/undefined, empty collection, single element, very large, duplicate keys, unicode/emoji, leading or trailing whitespace.

## 2. Contracts & compatibility

The highest-yield class, because CI usually cannot see the other side of the contract.

- **Function/method signature**: parameter added, removed, reordered, or made required; return type or shape changed; optional made mandatory. Enumerate call sites (Phase 2).
- **HTTP API**: field renamed or removed from a response; type changed (`"12"` → `12`); nullability changed; status code changed; new required request field; validation tightened; pagination or default limit changed; error body reshaped. Mobile clients and third-party integrations cannot be redeployed with you.
- **Events / queues / webhooks**: payload schema changed, topic or routing key renamed, ordering or partition key changed, consumer group semantics changed. In-flight messages produced by the old code will be consumed by the new code, and vice versa.
- **Library/package exports**: removed or renamed export, changed default export, semver implications for downstream consumers.
- **Serialization**: cached blobs, sessions, JWT claims, protobuf field numbers, `serialVersionUID`. Old serialized data must still deserialize.
- **CLI / config keys**: renamed flags or env vars break deployment scripts that live in another repo.

For each contract change ask: _who else reads this, and do they get deployed at the same instant?_ If the answer is "no" or "unknown", it is at minimum a SHIP WITH CONDITIONS with an expand-contract plan.

## 3. Data & persistence

- Query semantics: `JOIN` → `LEFT JOIN`, a `WHERE` predicate removed, `DISTINCT` dropped, `GROUP BY` altered, `LIMIT` added — each changes row counts and therefore downstream totals.
- ORM traps: lazy vs eager loading changed (N+1 or over-fetching), cascade delete added, `save()` inside a loop, transaction boundary moved, autocommit assumptions, session/identity-map reuse.
- Transactions: work moved outside a transaction; a partial-failure path that now leaves half-written state; missing idempotency on a retried operation; nested transactions/savepoints.
- Isolation & locking: read-modify-write without `SELECT ... FOR UPDATE` or optimistic version check; lock ordering changed (deadlock); long transaction now spanning an external call.
- Indexes: a query changed so an existing index no longer applies (leading column, function on a column, implicit cast, `OR` chain) — correct results, 100× slower.
- Data integrity: constraint or unique index removed; validation moved from DB to application only; encoding/collation change; nullable column now written with nulls that readers do not expect.
- Caching: key format changed while old keys survive; TTL raised; invalidation path removed; cache written before the DB commit succeeds.

## 4. State & concurrency

- New shared mutable state: module-level variable, singleton, static field, class attribute mutated per request.
- Check-then-act without atomicity (stock, balance, unique username, rate limit) — the two-requests-in-the-same-millisecond scenario.
- Async/await misuse: missing `await`, floating promise, `Promise.all` swallowing a rejection, fire-and-forget writes, `async` in a `forEach`.
- Thread-safety: non-thread-safe client (e.g. a date formatter, a connection) shared across threads/goroutines; unguarded map access.
- Order dependence introduced between requests, jobs, or test cases.
- Retries without idempotency keys → duplicate charges, duplicate emails, duplicate rows.

## 5. Performance & resources

- New query, external call, or heavy computation inside a loop → N+1 against DB or API.
- A `SELECT` that lost its `LIMIT`, or loads a whole table into memory.
- Synchronous work added to a hot path or to a request handler.
- Unbounded growth: cache without eviction, list appended per event, retained closure, subscription never removed.
- Connections/handles/files opened without a guaranteed close path.
- Algorithmic complexity: nested iteration over collections that grow with production data (fine on 50 fixtures, fatal on 5M rows).
- Timeout or retry policy changed; missing backoff turns a blip into a self-inflicted DDoS.
- Bundle size / cold-start impact of a new heavy dependency.

## 6. Error handling

- Exception now swallowed (`catch {}`, `except: pass`, ignored `err`) — the failure becomes invisible and the data becomes wrong.
- Error type or message changed, and something upstream matches on it.
- Error path added that leaves partial state (file written, row inserted, payment taken).
- Errors previously propagated now converted to a default value.
- Logging of errors removed, or a log line added that prints secrets/PII.
- Failure of a non-critical dependency now fails the whole request (or the reverse: a critical failure now passes silently).

## 7. Security

- AuthN/AuthZ: a check removed, moved after the side effect, or applied to only some branches; role/permission comparison loosened; object-level ownership check missing (IDOR).
- Injection surface: string-built SQL, shell command with user input, unescaped HTML/`dangerouslySetInnerHTML`, template injection, path traversal from user-supplied filenames.
- Secrets: credentials committed, secret logged, token placed in a URL/query string, key added to a client-side bundle.
- Transport/validation weakened: TLS verification disabled, certificate pinning removed, CORS widened to `*`, CSRF protection removed, cookie flags (`HttpOnly`, `Secure`, `SameSite`) changed.
- Crypto: algorithm downgraded, static IV/salt, `Math.random()` for tokens, hash swapped for a fast one.
- Deserialization of untrusted input; new file upload path without type/size limits.
- Dependency added: is it maintained, is it the package it claims to be (typosquat), does the lockfile change include transitive upgrades nobody reviewed?
- New endpoint or route: does it inherit the auth middleware, or was it registered outside the protected group?

## 8. Config & deployment

- New required env var without a default → the app boots fine locally and crashes in prod.
- Default changed in code while the deployed config still carries the old explicit value (or vice versa).
- Feature flag default flipped, or a flag removed while still referenced elsewhere.
- Resource limits, replica counts, health-check paths, readiness/liveness probes changed.
- Build config: target runtime, module format, tree-shaking, source maps, minification affecting runtime behavior.
- Lockfile churn out of proportion to the intended dependency change.

## 9. Frontend-specific

- Hook dependency arrays: missing dependency (stale closure) or over-broad (render loop).
- Effect cleanup removed → duplicate subscriptions, memory leaks.
- Key prop changed/removed in lists → wrong DOM reuse, lost input state.
- State derived during render vs in an effect; controlled ↔ uncontrolled input switch.
- Route or query-param contract changed → dead bookmarks and broken deep links.
- Accessibility regression: label/aria removed, focus trap broken, keyboard path lost.
- Client-side validation tightened while the server relaxed, or the reverse.
- SSR/hydration mismatch introduced (`window`/`document` at module scope, non-deterministic render).

## 10. Async, jobs & integrations

- Scheduled job cadence or window changed; overlapping runs now possible.
- Job made non-idempotent, or a dedupe key removed.
- Backwards compatibility of queued payloads (see §2) during the deploy window.
- Third-party API version/SDK bump: read the changelog, do not assume patch-level safety.
- Webhook signature verification, replay protection, or ordering assumptions changed.

## 11. Tests as evidence

Judge the test changes as rigorously as the code changes:

- Do the new tests fail against the _old_ code? If a test passes with and without the fix, it does not protect the fix. When feasible, verify this in a `git worktree` at the base of the target, with the new tests copied in (see `verification-playbook.md`): the user's tree is never touched.
- Do they assert the actual invariant, or only that the function returned something?
- Are the boundaries from §1 covered, or just the happy path?
- Are mocks now asserting on the mock rather than on behavior?
- Was a test changed to match new (possibly wrong) output rather than the behavior being fixed? An updated snapshot or expected value in the same commit as a bug fix deserves a direct look.
- Any test skipped, deleted, or loosened (see `detect_test_tampering.sh`) must be explained in the report.
