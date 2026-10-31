# create-tatara

## 0.7.0

### Minor Changes

- 994eb9d: Generated apps use `@tatara/storage`, `@tatara/email`, `@tatara/i18n` and `@tatara/jobs`. Each add-on keeps one short config file (`src/core/<addon>/index.ts` or `send.ts`), and the worker and cron apps call `startWorker`/`startCron`. `tatara upgrade` runs the 0.7.0 `addon-packages` codemod, which moves each add-on on its own.

### Patch Changes

- Updated dependencies [994eb9d]
  - @tatara/cli@0.7.0

## 0.6.0

### Minor Changes

- 2324281: Generated apps with the permission system use `@tatara/authz`: `src/core/authz/index.ts` creates the app's `authz` from its store, catalog and built-in roles, and the authorization routes come from the package. The ORM store stays in the app. `tatara upgrade` runs the 0.6.0 `authz-package` codemod.

### Patch Changes

- Updated dependencies [2324281]
  - @tatara/cli@0.6.0

## 0.5.0

### Minor Changes

- fa60688: Generated apps use `@tatara/auth` (guards, principal middleware, OpenAPI merge, dev outbox, test helpers) and `@tatara/keycloak` (the `keycloakTokens()` plugin and test signer). `tatara upgrade` runs the 0.5.0 `auth-package` codemod, which moves unchanged files and reports customised ones.

### Patch Changes

- Updated dependencies [fa60688]
  - @tatara/cli@0.5.0

## 0.4.0

### Minor Changes

- 6fac954: Generated apps use the new `@tatara/db` (`newId`, `defineSeed`, per-driver admin helpers and per-ORM `migrateDatabase` in sub-paths) and `@tatara/testing` (in-process API `client`, one database per test worker). `src/core/db/admin.ts` and `migrate.ts` become one-line re-exports naming the app's driver. `app.ts` only contains the OpenAPI and error-message callbacks when a feature needs them. `tatara upgrade` moves existing apps over (codemod `db-testing`).

### Patch Changes

- Updated dependencies [6fac954]
  - @tatara/cli@0.4.0

## 0.3.0

### Minor Changes

- 23bec93: Generated apps use the new `@tatara/http` package (`createApp`, `mountRoutes`, `serveOpenApi`, `handleErrors`, `startServer`, errors and the response envelope) instead of copied files; `app.ts` stays in the app as short, plain-Hono wiring. Browser clients can read better-auth's `set-auth-token` header. `tatara upgrade` moves existing apps onto it (codemod `http-package`).

### Patch Changes

- Updated dependencies [23bec93]
  - @tatara/cli@0.3.0
