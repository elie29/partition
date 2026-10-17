# Pattern grid

The rulings of this project on design patterns and structuring principles. Read it before introducing a pattern or an abstraction; replay it to audit the code. A ruling is added when a real need raises the question, never in advance.

## Criteria

Every ruling answers the criteria below. The list is the project's: add a column, remove one.

| Criterion      | Question                                                                              |
| -------------- | ------------------------------------------------------------------------------------- |
| Need now       | Does the code need it today? Name the two cases that exist, not the third that might. |
| Budget         | With it, does an ordinary change make the assistant read less, or more?               |
| Cost of change | When the business rule changes, how many files and callers move, with and without it? |
| Testability    | What becomes verifiable without starting the framework or the database?               |
| Security       | Does it centralise a control, or open a path around one?                              |

## Rulings

`adopted` · `conditional` (say when) · `rejected` · `no pattern` (the plain code stays, on purpose).

| # | Where | Pattern | Ruling | Need now | Budget | Cost of change | Testability | Security | Reason | Date |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P-1 | <context / area> | <name> | <ruling> |  |  |  |  |  | <one line> | YYYY-MM-DD |

## Audits

| Date | Rulings replayed | Conform | Deviations |
| ---- | ---------------- | ------- | ---------- |
