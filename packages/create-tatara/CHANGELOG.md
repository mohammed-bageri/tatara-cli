# create-tatara

## 0.10.0

### Minor Changes

- b0727b7: The app owns its auth. Generated apps keep auth in `src/modules/users` (built with `createAuthInstance`), compose HTTP in `src/apps/http.ts`, and with the admin add-on get a `staff` module with its own better-auth. Requests name their org (`requireOrg()`, `x-org-id`); a Keycloak token's `organization` claim decides which orgs its user may act in; authz has no default org, so single-tenant apps set `singleTenant`. `tatara upgrade` moves existing apps (codemod 0.10.0). The MySQL test reset deletes rows instead of truncating.

### Patch Changes

- Updated dependencies [b0727b7]
  - @tatara/cli@0.10.0

## 0.9.2

### Patch Changes

- ae73adc: Label better-auth routes as "better-auth" in `tatara routes`. Routes tagged "Auth" (from better-auth's merged OpenAPI document) now show their auth provider instead of "authenticated" or "public", making them easily identifiable. Also uses operation description as fallback when summary is missing.
- Updated dependencies [ae73adc]
  - @tatara/cli@0.9.2

## 0.9.1

### Patch Changes

- 60c3459: Fix `tatara routes` to include better-auth endpoints. The command now fetches the OpenAPI spec from `/openapi.json` instead of calling `getOpenAPI31Document` directly, ensuring routes added via async extend callbacks are included. Also improves guard labeling for API-key security schemes.
- Updated dependencies [60c3459]
  - @tatara/cli@0.9.1

## 0.9.0

### Minor Changes

- fd669b1: Generated apps are smaller:
  - tatara's own wiring tests no longer go into apps; the e2e matrix runs them.
  - `@tatara/authz` ships the Prisma and Drizzle stores (`prismaAuthzStore(db)`, `drizzleAuthzStore(db, tables)`).
  - The db, authz, email, storage and jobs commands and seeds come from their packages. Packages declare them in a `"tatara"` field, and `tatara sync` wires them into `src/generated`. An app's own command with the same name wins.
  
  `tatara upgrade` now bumps every `@tatara/*` dependency to this CLI's version and installs before syncing. The 0.9.0 codemods remove the copies that are no longer needed.

### Patch Changes

- Updated dependencies [fd669b1]
  - @tatara/cli@0.9.0

## 0.8.0

### Minor Changes

- b9ff8c7: `tatara eject <package> [--with-dependents]` copies a package's source into `src/ejected/<name>` and points the app's imports at it. After that, `tatara upgrade`, `sync` and the generators use the app's copy. Library packages now ship their `src` (without tests), so they can be ejected.

### Patch Changes

- Updated dependencies [b9ff8c7]
  - @tatara/cli@0.8.0

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
