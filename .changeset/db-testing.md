---
"@tatara/cli": minor
"create-tatara": minor
---

Generated apps use the new `@tatara/db` (`newId`, `defineSeed`, per-driver admin helpers and per-ORM `migrateDatabase` in sub-paths) and `@tatara/testing` (in-process API `client`, one database per test worker). `src/core/db/admin.ts` and `migrate.ts` become one-line re-exports naming the app's driver. `app.ts` only contains the OpenAPI and error-message callbacks when a feature needs them. `tatara upgrade` moves existing apps over (codemod `db-testing`).
