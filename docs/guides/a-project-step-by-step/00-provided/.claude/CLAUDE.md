# partition-commerce

Spring Boot service that sells products from price lists and bills them.

## Build

- `./mvnw clean install` builds and runs every test.

## Rules

1. Constructor injection only; no field injection.
2. A controller never calls a repository.
3. One package per bounded context under `com.commerce`.
4. The domain does not import Spring.
5. Every schema change is a new Flyway file `V<n>__<what>.sql`; a migration already merged is never edited.
6. Tests: JUnit 5 and AssertJ; one test class per use case.
7. The HTTP API is generated from its OpenAPI contract; a controller implements the generated interface.
8. Never log a payment card number.
9. Plans live in `docs/plans/`, not in `docs/superpowers/plans/`.
