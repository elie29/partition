# Database, migrations & rollout safety

Read this whenever the change touches schema, migrations, bulk data, or anything that must survive a rolling deploy. Application bugs get rolled back; data damage does not.

## The rolling-deploy invariant

For a window of minutes to hours, **old code and new code run simultaneously against the same database and the same queues.** Every schema change must therefore satisfy:

1. Old code keeps working against the new schema (until it is fully drained).
2. New code works against the old schema (it may start before migration completes, and it must survive a rollback).

This forces **expand → migrate → contract**:

| Intent | Wrong (one shot) | Right (three deploys) |
| --- | --- | --- |
| Rename `email` → `email_address` | `ALTER TABLE ... RENAME COLUMN` | add new column → dual-write + backfill → switch reads → stop writing old → drop old |
| Drop a column | `DROP COLUMN` in the same release | stop reading (deploy) → stop writing (deploy) → drop (later release) |
| Add a required field | `ADD COLUMN NOT NULL` | add nullable → backfill → add constraint (validated separately) → make required in code |
| Change a type | `ALTER TYPE` in place | add new column → dual-write → backfill → cut over → drop |

A single-deploy rename or drop is a **Blocker** in any system with more than one replica, or with any client that is not deployed in lockstep.

## Migration mechanics to inspect

- **Locking.** Which statements take `ACCESS EXCLUSIVE` / `ALTER TABLE` metadata locks? On PostgreSQL, adding a column with a volatile default, changing a type, or adding a validated constraint rewrites or fully locks the table. On MySQL/InnoDB, check whether the operation is `INPLACE` or `COPY` for that version. On a large hot table, a lock held behind a long-running read query queues every subsequent query — an outage from a "fast" DDL.
- **Table rewrite.** `ALTER TABLE ... ALTER COLUMN TYPE`, adding a `NOT NULL` with a non-constant default on older engines, changing collation. Estimate time from row count, not from the local fixture.
- **Index creation.** `CREATE INDEX` without `CONCURRENTLY` (PostgreSQL) blocks writes for the duration. `CONCURRENTLY` cannot run inside a transaction — check the migration framework is not wrapping it. Also check for a failed-invalid index left behind by an aborted concurrent build.
- **Constraints.** Prefer `ADD CONSTRAINT ... NOT VALID` then `VALIDATE CONSTRAINT` (short lock, long scan without blocking writes). A blocking `CHECK`/`FOREIGN KEY` validation on a big table is a stall.
- **Backfills.** Must be batched (a few thousand rows per transaction, with a sleep), resumable, and idempotent. A single `UPDATE` over millions of rows means a giant transaction, replication lag, table bloat, and no way to stop it cleanly.
- **Lock/statement timeouts.** Migrations should set a short `lock_timeout` so they fail fast rather than freezing the table behind a queue of blocked queries. Check the framework's defaults.
- **Reversibility.** Is there a real `down`? Does it lose data? A drop is one-way regardless of what the down migration claims — the data is gone. Say so explicitly in the report.
- **Transactional DDL.** PostgreSQL supports it; MySQL does not — a MySQL migration that fails midway leaves a half-applied schema that must be repaired by hand. Multi-statement MySQL migrations are riskier than they look.
- **Replicas.** Long DDL and large backfills generate lag; read replicas serving the app will fall behind and serve stale data, or the app will time out waiting.
- **Ordering.** Does the code deploy assume the migration already ran? What if the migration job is slower than the pod rollout? State the required order explicitly.

## Query-level regressions

- Does the changed query still hit an index? Watch for a function applied to a column, implicit type casts, leading wildcards, `OR` chains, or a new column that is not part of the composite index's leading edge. Read `EXPLAIN (ANALYZE, BUFFERS)` if a database is reachable; otherwise reason from the index definitions in the schema.
- Row-count semantics: `LEFT JOIN` → `JOIN`, a removed predicate, a lost `DISTINCT`, `GROUP BY` changes, an added `LIMIT` without a deterministic `ORDER BY`.
- N+1 introduced by an ORM relation change (lazy vs eager, `select_related`/`includes`/`JOIN FETCH` removed).
- New unbounded fetch: a query without a `LIMIT` whose result set grows with production data.
- Connection pool pressure: work added inside a transaction, a transaction now spanning an HTTP call, a per-request client instantiated in a loop.

## Data correctness

- Backfill logic must be verified against real edge cases: nulls, duplicates, orphans, historic rows written by older code versions, soft-deleted rows.
- Are `updated_at` triggers or audit tables fired by the backfill in a way that pollutes downstream consumers (ETL, CDC, search indexers)?
- Downstream systems reading the table directly — data warehouse, BI, CDC pipeline, search index — are consumers of this schema contract even though they are not in the repo.
- Multi-tenant scoping: does every new query carry the tenant/account predicate?

## Rollout & rollback assessment

Answer these in the report:

1. **Deploy order** — migration before code, or after? What breaks if they invert?
2. **Rollback path** — redeploy the previous artifact and everything works? Or has data already been transformed in place, events published, or third-party state changed (one-way door)?
3. **Blast containment** — feature flag, canary, percentage rollout, kill switch. For a risky change without one, "add a flag" is a legitimate ship condition.
4. **Detection** — which metric or alert fires if the specific failure scenarios from the findings occur? Error rate, latency p99, row counts, business KPI, replication lag. If nothing would catch it, that is a finding.
5. **Recovery** — is there a backup/PITR window covering the change, and has anyone confirmed the restore path for the affected tables?
6. **Timing** — a locking migration during peak hours is a different risk from the same migration at 03:00 with a maintenance window.

## Verifying a migration locally

```bash
# scratch database, not the dev one everyone shares
<migrate up>            # apply
<migrate down>          # revert
<migrate up>            # re-apply: proves reversibility and idempotence
# then, with the OLD application code running against the NEW schema:
<run the old code's test suite>   # proves the N-1 invariant
```

If none of this is runnable in the current environment, say so and hand the user this checklist as the remaining work — an unverified migration is never a clean SHIP.
