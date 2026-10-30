# create-tatara

## 0.3.0

### Minor Changes

- 23bec93: Generated apps use the new `@tatara/http` package (`createApp`, `mountRoutes`, `serveOpenApi`, `handleErrors`, `startServer`, errors and the response envelope) instead of copied files; `app.ts` stays in the app as short, plain-Hono wiring. Browser clients can read better-auth's `set-auth-token` header. `tatara upgrade` moves existing apps onto it (codemod `http-package`).

### Patch Changes

- Updated dependencies [23bec93]
  - @tatara/cli@0.3.0
