# Dependency checks that fail the build

One per ecosystem. Use the one the project already has; otherwise propose one and let the owner choose. In every case the rules are generated from the layer map of `docs/partition.yml`, and the check runs in the same command as the tests.

| Ecosystem | Tool | Where the rules live |
| --- | --- | --- |
| Java, Kotlin | ArchUnit | a test class, run with the unit tests |
| .NET | NetArchTest, ArchUnitNET | a test class |
| JavaScript, TypeScript | dependency-cruiser, ESLint `no-restricted-imports` | a configuration file |
| PHP | Deptrac | `deptrac.yaml` |
| Python | import-linter | a contracts section in the project configuration |
| Go | go-arch-lint, depguard | a configuration file |

Whatever the tool:

- one rule per line of `allowed`, and a default that forbids the rest;
- in a rich hexagon, a rule that the domain imports nothing from outside itself, with the framework annotations the owner explicitly accepts listed one by one;
- a rule that no hexagon imports from another;
- written so that adding a hexagon needs no change to the rules;
- an exception is added only with the owner's explicit validation, and is recorded in the plan.
