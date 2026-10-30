---
"@tatara/cli": minor
"create-tatara": minor
---

Generated apps use `@tatara/auth` (guards, principal middleware, OpenAPI merge, dev outbox, test helpers) and `@tatara/keycloak` (the `keycloakTokens()` plugin and test signer). `tatara upgrade` runs the 0.5.0 `auth-package` codemod, which moves unchanged files and reports customised ones.
