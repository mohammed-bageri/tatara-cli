# @tatara/email

## 0.3.0

### Minor Changes

- 6bcea69: `@tatara/notifications`: `notify({ orgId, to, notification, data })` for in-app, email, SMS and push. Recipients are a user, users, a role or a permission; delivery goes through jobs (fan-out, then one delivery per user), each channel once per recipient, deduped by `idempotencyKey`. `defineNotification` templates in `notifications/*.ts`, Drizzle and Prisma stores, Twilio and FCM senders (console fallbacks). `@tatara/email`: a Mailgun driver and `defineEmail` templates. New `notifications` add-on (brings jobs and the cache): the inbox routes, push tokens, `SMS_DRIVER`/`PUSH_DRIVER`. Codemod 0.11.0 `email-v2`.

### Patch Changes

- Updated dependencies [315003d]
  - @tatara/core@0.1.2

## 0.2.0

### Minor Changes

- fd669b1: Generated apps are smaller:
  - tatara's own wiring tests no longer go into apps; the e2e matrix runs them.
  - `@tatara/authz` ships the Prisma and Drizzle stores (`prismaAuthzStore(db)`, `drizzleAuthzStore(db, tables)`).
  - The db, authz, email, storage and jobs commands and seeds come from their packages. Packages declare them in a `"tatara"` field, and `tatara sync` wires them into `src/generated`. An app's own command with the same name wins.
  
  `tatara upgrade` now bumps every `@tatara/*` dependency to this CLI's version and installs before syncing. The 0.9.0 codemods remove the copies that are no longer needed.
